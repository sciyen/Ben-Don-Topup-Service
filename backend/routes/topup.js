/**
 * Top-up API Routes
 * POST /api/topup  — Execute a cash top-up transaction
 * GET  /api/transactions — Retrieve recent transactions
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const { checkAuthorization } = require('../services/authorizationService');
const { findByIdempotencyKey, appendTransaction, getTransactions } = require('../services/sheetsService');
const { appendLog } = require('../services/docsService');

const router = express.Router();

/**
 * POST /api/topup
 * Execute a cash top-up transaction.
 *
 * Body: { customer, amount, paymentMethod, note, idempotencyKey }
 * Headers: Authorization: Bearer <ID_TOKEN>
 */
router.post('/topup', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // 1. Authorize user
        const authResult = await checkAuthorization(email);
        if (!authResult.authorized) {
            return res.status(403).json({ error: `Forbidden: ${authResult.reason}` });
        }

        // 2. Validate input
        const { customer, amount, paymentMethod, note, idempotencyKey } = req.body;

        if (!customer || typeof customer !== 'string' || customer.trim().length === 0) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        if (!paymentMethod || typeof paymentMethod !== 'string' || paymentMethod.trim().length === 0) {
            return res.status(400).json({ error: 'Payment method is required' });
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

        const transactionData = {
            timestamp,
            transactionId,
            customer: customer.trim(),
            amount,
            paymentMethod: paymentMethod.trim(),
            cashierEmail: email,
            note: (note || '').trim(),
            idempotencyKey,
        };

        // 5. Append to Google Sheet
        await appendTransaction(transactionData);

        // 6. Append to Google Doc
        await appendLog(transactionData);

        // 7. Return success
        console.log(`✅ Transaction ${transactionId} recorded by ${email}`);
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
 * GET /api/transactions
 * Retrieve the last N transactions.
 * Query params: limit (default 20)
 */
router.get('/transactions', verifyToken, async (req, res) => {
    try {
        const { email } = req.user;

        // Authorize user (any role with active status can view)
        const authResult = await checkAuthorization(email);
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
