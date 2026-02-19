/**
 * Google Sheets Service
 * Handles all interactions with the Transactions sheet.
 *
 * Sheet "Transactions" columns (fixed order):
 * A: Timestamp | B: TransactionID | C: Customer | D: Type | E: Amount
 * F: CashierEmail | G: Note | H: IdempotencyKey
 *
 * Type ∈ { TOPUP, SPEND }
 * Amount: positive for TOPUP, negative for SPEND
 */
const { google } = require('googleapis');
const config = require('../config');

const SHEET_NAME = 'Transactions';
const COLUMNS = 'A:H';

/**
 * Gets an authenticated Google Sheets client with read/write access.
 */
function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

/**
 * Checks if an idempotency key already exists in the Transactions sheet.
 * Scans column H (IdempotencyKey) for a match.
 * @param {string} key - The idempotency key to check.
 * @returns {Promise<boolean>} True if key already exists.
 */
async function findByIdempotencyKey(key) {
    try {
        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: `${SHEET_NAME}!H:H`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return false;

        // Skip header row, check for matching key
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0] === key) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Idempotency check failed:', error.message);
        throw new Error('Failed to check for duplicate transaction');
    }
}

/**
 * Appends a transaction row to the Transactions sheet.
 * @param {Object} data - Transaction data.
 * @param {string} data.timestamp
 * @param {string} data.transactionId
 * @param {string} data.customer
 * @param {string} data.type        - 'TOPUP' or 'SPEND'
 * @param {number} data.amount      - positive for TOPUP, negative for SPEND
 * @param {string} data.cashierEmail
 * @param {string} data.note
 * @param {string} data.idempotencyKey
 */
async function appendTransaction(data) {
    try {
        const sheets = getSheetsClient();

        const row = [
            data.timestamp,
            data.transactionId,
            data.customer,
            data.type,
            data.amount,
            data.cashierEmail,
            data.note,
            data.idempotencyKey,
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: config.spreadsheetId,
            range: `${SHEET_NAME}!${COLUMNS}`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [row],
            },
        });
    } catch (error) {
        console.error('Failed to append transaction:', error.message);
        throw new Error('Failed to save transaction to spreadsheet');
    }
}

/**
 * Retrieves all transaction rows from the sheet.
 * Used internally by balance computation and transaction listing.
 * @returns {Promise<Array<Object>>} Array of transaction objects (oldest first).
 */
async function getAllTransactions() {
    try {
        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: `${SHEET_NAME}!${COLUMNS}`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return []; // No data rows (only header)

        // Skip header, map to objects
        return rows.slice(1).map((row) => ({
            timestamp: row[0] || '',
            transactionId: row[1] || '',
            customer: row[2] || '',
            type: row[3] || '',
            amount: parseFloat(row[4]) || 0,
            cashierEmail: row[5] || '',
            note: row[6] || '',
        }));
    } catch (error) {
        console.error('Failed to get transactions:', error.message);
        throw new Error('Failed to retrieve transactions');
    }
}

/**
 * Retrieves the last N transactions, ordered newest first.
 * @param {number} limit - Maximum number of transactions to return.
 * @returns {Promise<Array<Object>>} Array of transaction objects.
 */
async function getTransactions(limit = 20) {
    const all = await getAllTransactions();
    return all.reverse().slice(0, limit);
}

module.exports = { findByIdempotencyKey, appendTransaction, getTransactions, getAllTransactions };
