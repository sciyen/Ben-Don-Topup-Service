/**
 * Google Sheets Service
 * Handles all interactions with the Transactions sheet.
 *
 * Sheet "Transactions" columns (fixed order):
 * A: Timestamp | B: TransactionID | C: Customer | D: Amount
 * E: PaymentMethod | F: CashierEmail | G: Note | H: IdempotencyKey
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
 * @param {number} data.amount
 * @param {string} data.paymentMethod
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
            data.amount,
            data.paymentMethod,
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
 * Retrieves the last N transactions, ordered newest first.
 * @param {number} limit - Maximum number of transactions to return.
 * @returns {Promise<Array<Object>>} Array of transaction objects.
 */
async function getTransactions(limit = 20) {
    try {
        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: `${SHEET_NAME}!${COLUMNS}`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return []; // No data rows (only header)

        // Skip header, map to objects, reverse for newest first
        const transactions = rows
            .slice(1) // skip header
            .map((row) => ({
                timestamp: row[0] || '',
                transactionId: row[1] || '',
                customer: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                paymentMethod: row[4] || '',
                cashierEmail: row[5] || '',
                note: row[6] || '',
            }))
            .reverse()
            .slice(0, limit);

        return transactions;
    } catch (error) {
        console.error('Failed to get transactions:', error.message);
        throw new Error('Failed to retrieve transactions');
    }
}

module.exports = { findByIdempotencyKey, appendTransaction, getTransactions };
