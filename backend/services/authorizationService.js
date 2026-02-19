/**
 * Authorization Service
 * Checks user permissions against the AuthorizedUsers sheet tab.
 *
 * Sheet "AuthorizedUsers" expected columns:
 * A: email | B: role | C: active
 */
const { google } = require('googleapis');
const config = require('../config');

// Roles allowed to perform top-up transactions
const TOP_UP_ROLES = ['cashier', 'admin'];

/**
 * Gets an authenticated Google Sheets client using the service account.
 */
function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
}

/**
 * Checks whether the given email is authorized to perform a top-up.
 * @param {string} email - The user's verified email address.
 * @returns {Promise<{authorized: boolean, reason?: string}>}
 */
async function checkAuthorization(email) {
    try {
        const sheets = getSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: 'AuthorizedUsers!A:C',
        });

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            return { authorized: false, reason: 'No authorized users configured' };
        }

        // Skip header row, find matching email
        for (let i = 1; i < rows.length; i++) {
            const [rowEmail, role, active] = rows[i];

            if (rowEmail && rowEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
                // Check if user is active
                if (active && active.toLowerCase().trim() !== 'true') {
                    return { authorized: false, reason: 'User account is deactivated' };
                }

                // Check if role permits top-up
                if (!role || !TOP_UP_ROLES.includes(role.toLowerCase().trim())) {
                    return { authorized: false, reason: `Role '${role}' does not have top-up permission` };
                }

                return { authorized: true };
            }
        }

        return { authorized: false, reason: 'Email not found in authorized users list' };
    } catch (error) {
        console.error('Authorization check failed:', error.message);
        throw new Error('Failed to verify user authorization');
    }
}

module.exports = { checkAuthorization };
