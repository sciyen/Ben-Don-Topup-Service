/**
 * Batch Checkout Service
 * Implements partial batch spend logic — processes only valid rows,
 * skips rows with insufficient balance or invalid amounts.
 *
 * Execution model:
 *   1. Filter out invalid rows (amount <= 0, insufficient balance)
 *   2. Sequential append for valid rows only
 *   3. If mid-append failure → stop, return error (no rollback in append-only model)
 */
const { v4: uuidv4 } = require('uuid');
const { getAllTransactions, findByIdempotencyKey, appendTransaction } = require('./sheetsService');
const { computeBatchBalances } = require('./balanceService');
const { appendLog, appendBatchHeader } = require('./docsService');

/**
 * Validates and executes a batch checkout, processing only valid rows.
 * Invalid rows (amount <= 0 or insufficient balance) are skipped, not rejected.
 *
 * @param {Array<{customer: string, amount: number, note: string}>} rows - Checkout rows.
 * @param {string} idempotencyKey - Unique key for the entire batch.
 * @param {string} cashierEmail - Verified email of the cashier.
 * @returns {Promise<Object>} Result with processed/skipped counts and details.
 * @throws {Object} Error with { statusCode, message } on hard failures only.
 */
async function executeBatchCheckout(rows, idempotencyKey, cashierEmail) {
    // 1. Basic input validation
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw { statusCode: 400, message: 'Rows array is required and must not be empty' };
    }

    // 2. Check batch idempotency key
    const isDuplicate = await findByIdempotencyKey(idempotencyKey);
    if (isDuplicate) {
        throw { statusCode: 409, message: 'Duplicate batch: idempotency key already exists' };
    }

    // 3. Fetch the entire ledger ONCE
    const allTransactions = await getAllTransactions();

    // 4. Compute current balances for all involved customers
    const uniqueCustomers = [...new Set(rows.map((r) => (r.customer || '').trim()).filter(Boolean))];
    const currentBalances = await computeBatchBalances(uniqueCustomers, allTransactions);

    // 5. Simulate deductions and partition rows into valid/skipped
    //    Handles duplicate customers within the same batch cumulatively.
    const simulatedBalances = { ...currentBalances };
    const validRows = [];
    const skippedRows = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const customer = (row.customer || '').trim();
        const amount = row.amount;

        // Skip: missing customer
        if (!customer) {
            skippedRows.push({ index: i + 1, customer: customer || '(empty)', reason: 'Missing customer name' });
            continue;
        }

        // Skip: invalid amount
        if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
            skippedRows.push({ index: i + 1, customer, reason: `Invalid amount: ${amount}` });
            continue;
        }

        // Skip: insufficient balance
        const currentBal = simulatedBalances[customer] || 0;
        if (currentBal < amount) {
            skippedRows.push({ index: i + 1, customer, reason: `Insufficient balance: ${currentBal} < ${amount}` });
            continue;
        }

        // Valid — deduct in simulation for cumulative check
        simulatedBalances[customer] = currentBal - amount;
        validRows.push(row);
    }

    // If no valid rows remain, return early (not an error — just nothing to process)
    if (validRows.length === 0) {
        return {
            status: 'success',
            transactionCount: 0,
            skippedCount: skippedRows.length,
            skippedRows,
            transactionIDs: [],
            timestamp: new Date().toISOString(),
        };
    }

    // 6. Execute valid rows sequentially
    const timestamp = new Date().toISOString();
    const transactionIDs = [];

    // 6a. Write batch header to Google Doc
    await appendBatchHeader(idempotencyKey, timestamp, validRows.length);

    // 6b. Append each valid SPEND transaction
    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const transactionId = uuidv4();
        transactionIDs.push(transactionId);

        const transactionData = {
            timestamp,
            transactionId,
            customer: row.customer.trim(),
            type: 'SPEND',
            amount: -row.amount, // Convert to negative for ledger
            cashierEmail,
            note: (row.note || '').trim(),
            idempotencyKey, // Same batch key for all rows
        };

        try {
            await appendTransaction(transactionData);
            await appendLog(transactionData);
        } catch (error) {
            console.error(`Batch checkout failed at valid row ${i + 1}:`, error.message);
            throw {
                statusCode: 500,
                message: `Batch partially failed at row ${i + 1} of ${validRows.length}. ${i} rows were committed. Error: ${error.message}`,
            };
        }
    }

    console.log(`✅ Batch checkout ${idempotencyKey.slice(0, 8)}… | ${validRows.length}/${rows.length} rows by ${cashierEmail} (${skippedRows.length} skipped)`);

    return {
        status: 'success',
        transactionCount: validRows.length,
        skippedCount: skippedRows.length,
        skippedRows,
        transactionIDs,
        timestamp,
    };
}

module.exports = { executeBatchCheckout };
