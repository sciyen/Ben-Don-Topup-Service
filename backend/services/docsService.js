/**
 * Google Docs Service
 * Appends formatted transaction logs to a Google Doc.
 */
const { google } = require('googleapis');
const config = require('../config');

/**
 * Gets an authenticated Google Docs client.
 */
function getDocsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/documents'],
    });
    return google.docs({ version: 'v1', auth });
}

/**
 * Appends a formatted transaction log entry to the end of the Google Doc.
 * @param {Object} data - Transaction data.
 * @param {string} data.timestamp
 * @param {string} data.transactionId
 * @param {string} data.customer
 * @param {string} data.type          - 'TOPUP' or 'SPEND'
 * @param {number} data.amount        - positive for TOPUP, negative for SPEND
 * @param {string} data.cashierEmail
 * @param {string} data.note
 */
async function appendLog(data) {
    try {
        const docs = getDocsClient();

        // Build the formatted log entry
        const logEntry = [
            '─────────────────────────',
            `Timestamp: ${data.timestamp}`,
            `Transaction ID: ${data.transactionId}`,
            `Type: ${data.type}`,
            `Customer: ${data.customer}`,
            `Amount: ${data.amount}`,
            `Cashier: ${data.cashierEmail}`,
            `Note: ${data.note}`,
            '─────────────────────────',
            '', // blank line after entry
        ].join('\n');

        // Get the current document to find the end index
        const doc = await docs.documents.get({ documentId: config.docId });
        const endIndex = doc.data.body.content.reduce((max, element) => {
            return Math.max(max, element.endIndex || 0);
        }, 0);

        // Insert text at the end of the document
        await docs.documents.batchUpdate({
            documentId: config.docId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex - 1 }, // Insert before the final newline
                            text: '\n' + logEntry,
                        },
                    },
                ],
            },
        });
    } catch (error) {
        console.error('Failed to append log to Google Doc:', error.message);
        throw new Error('Failed to write transaction log');
    }
}

/**
 * Appends a batch checkout header marker to the Google Doc.
 * This is written once before the individual transaction entries.
 * @param {string} batchId - The batch idempotency key.
 * @param {string} timestamp - ISO 8601 timestamp.
 * @param {number} rowCount - Number of rows in the batch.
 */
async function appendBatchHeader(batchId, timestamp, rowCount) {
    try {
        const docs = getDocsClient();

        const header = [
            '',
            '═════════════════════════',
            'BATCH CHECKOUT',
            `Batch ID: ${batchId}`,
            `Timestamp: ${timestamp}`,
            `Rows: ${rowCount}`,
            '═════════════════════════',
        ].join('\n');

        const doc = await docs.documents.get({ documentId: config.docId });
        const endIndex = doc.data.body.content.reduce((max, element) => {
            return Math.max(max, element.endIndex || 0);
        }, 0);

        await docs.documents.batchUpdate({
            documentId: config.docId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex - 1 },
                            text: '\n' + header,
                        },
                    },
                ],
            },
        });
    } catch (error) {
        console.error('Failed to append batch header to Google Doc:', error.message);
        throw new Error('Failed to write batch header log');
    }
}

module.exports = { appendLog, appendBatchHeader };
