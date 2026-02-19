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
 * @param {number} data.amount
 * @param {string} data.paymentMethod
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
            `Customer: ${data.customer}`,
            `Amount: ${data.amount}`,
            `Payment Method: ${data.paymentMethod}`,
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

module.exports = { appendLog };
