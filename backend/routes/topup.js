/**
 * API Routes
 * POST /api/topup         — Execute a cash top-up transaction
 * POST /api/spend         — Execute a spend (deduction) transaction
 * GET  /api/balance       — Look up customer balance
 * GET  /api/transactions  — Retrieve recent transactions
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const { checkAuthorization, WRITE_ROLES, READ_ROLES } = require('../services/authorizationService');
const { findByIdempotencyKey, appendTransaction, getTransactions } = require('../services/sheetsService');
const { appendLog } = require('../services/docsService');
const { computeCustomerBalance } = require('../services/balanceService');

const router = express.Router();

/**
 * POST /api/topup
 * Execute a cash top-up transaction.
 *
 * Body: { customer, amount, note, idempotencyKey }
 * Headers: Authorization: Bearer <ID_TOKEN>
 */
router.post('/topup', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // 1. Authorize user (cashier or admin)
        const authResult = await checkAuthorization(email, WRITE_ROLES);
        if (!authResult.authorized) {
            return res.status(403).json({ error: `Forbidden: ${authResult.reason}` });
        }

        // 2. Validate input
        const { customer, amount, note, idempotencyKey } = req.body;

        if (!customer || typeof customer !== 'string' || customer.trim().length === 0) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
            return res.status(400).json({ error: 'Idempotency key is required' });
        }

        // 3. Check for duplicate transaction
        const isDuplicate = await findByIdempotencyKey(idempotencyKey);
        if (isDuplicate) {
            return res.status(409).json({ error: 'Duplicate transaction: idempotency key already exists' });
        }

        // 4. Generate server-side values
        const timestamp = new Date().toISOString();
        const transactionId = uuidv4();

        // Backend enforces: TOPUP type with positive amount
        const transactionData = {
            timestamp,
            transactionId,
            customer: customer.trim(),
            type: 'TOPUP',
            amount, // positive, validated above
            cashierEmail: email,
            note: (note || '').trim(),
            idempotencyKey,
        };

        // 5. Append to Google Sheet
        await appendTransaction(transactionData);

        // 6. Append to Google Doc
        await appendLog(transactionData);

        // 7. Return success
        console.log(`✅ TOPUP ${transactionId} | ${customer.trim()} +${amount} by ${email}`);
        return res.status(200).json({
            status: 'success',
            transactionID: transactionId,
            timestamp,
        });
    } catch (error) {
        console.error('Top-up error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/spend
 * Execute a spend (deduction) transaction.
 *
 * Body: { customer, amount, note, idempotencyKey }
 *   - amount must be positive (backend converts to negative)
 * Headers: Authorization: Bearer <ID_TOKEN>
 */
router.post('/spend', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // 1. Authorize user (cashier or admin only)
        const authResult = await checkAuthorization(email, WRITE_ROLES);
        if (!authResult.authorized) {
            return res.status(403).json({ error: `Forbidden: ${authResult.reason}` });
        }

        // 2. Validate input
        const { customer, amount, note, idempotencyKey } = req.body;

        if (!customer || typeof customer !== 'string' || customer.trim().length === 0) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
            return res.status(400).json({ error: 'Idempotency key is required' });
        }

        // 3. Check for duplicate transaction
        const isDuplicate = await findByIdempotencyKey(idempotencyKey);
        if (isDuplicate) {
            return res.status(409).json({ error: 'Duplicate transaction: idempotency key already exists' });
        }

        // 4. Overdraft prevention: check balance before spending
        const currentBalance = await computeCustomerBalance(customer.trim());
        if (currentBalance < amount) {
            return res.status(409).json({
                error: 'Insufficient balance',
                currentBalance,
                requestedAmount: amount,
            });
        }

        // 5. Generate server-side values
        const timestamp = new Date().toISOString();
        const transactionId = uuidv4();

        // Backend enforces: SPEND type with NEGATIVE amount
        const transactionData = {
            timestamp,
            transactionId,
            customer: customer.trim(),
            type: 'SPEND',
            amount: -amount, // convert to negative for ledger
            cashierEmail: email,
            note: (note || '').trim(),
            idempotencyKey,
        };

        // 6. Append to Google Sheet
        await appendTransaction(transactionData);

        // 7. Append to Google Doc
        await appendLog(transactionData);

        // 8. Return success
        console.log(`✅ SPEND ${transactionId} | ${customer.trim()} -${amount} by ${email}`);
        return res.status(200).json({
            status: 'success',
            transactionID: transactionId,
            timestamp,
        });
    } catch (error) {
        console.error('Spend error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/balance?customer=xxx
 * Look up the current balance for a customer.
 * Authentication required. Authorized roles: cashier, admin, viewer.
 */
router.get('/balance', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // Authorize user (viewer or above can check balance)
        const authResult = await checkAuthorization(email, READ_ROLES);
        if (!authResult.authorized) {
            return res.status(403).json({ error: `Forbidden: ${authResult.reason}` });
        }

        const customer = req.query.customer;
        if (!customer || customer.trim().length === 0) {
            return res.status(400).json({ error: 'Customer query parameter is required' });
        }

        const balance = await computeCustomerBalance(customer.trim());

        return res.status(200).json({
            customer: customer.trim(),
            balance,
        });
    } catch (error) {
        console.error('Balance lookup error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/transactions
 * Retrieve the last N transactions.
 * Query params: limit (default 20)
 */
router.get('/transactions', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // Authorize user (viewer or above can view transactions)
        const authResult = await checkAuthorization(email, READ_ROLES);
        if (!authResult.authorized) {
            return res.status(403).json({ error: `Forbidden: ${authResult.reason}` });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const transactions = await getTransactions(limit);

        return res.status(200).json({ transactions });
    } catch (error) {
        console.error('Get transactions error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
