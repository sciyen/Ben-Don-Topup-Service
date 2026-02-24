/**
 * Authorization Service
 * Checks user permissions against the AuthorizedUsers sheet tab.
 *
 * Sheet "AuthorizedUsers" expected columns:
 * A: name | B: email | C: role | D: active
 *
 * Roles:
 *   cashier — can top-up, spend, view balance
 *   admin   — can top-up, spend, view balance
 *   viewer  — can view balance and transactions only
 *   buyer   — default role for self-registered users
 */
const { google } = require('googleapis');
const config = require('../config');

// Role sets for different permission levels
const WRITE_ROLES = ['cashier', 'admin'];        // Can perform top-up and spend
const READ_ROLES = ['cashier', 'admin', 'viewer', 'buyer']; // Can view balance and transactions

/**
 * Gets an authenticated Google Sheets client (read-only).
 */
function getSheetsClientReadOnly() {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
}

/**
 * Gets an authenticated Google Sheets client (read-write).
 */
function getSheetsClientReadWrite() {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

/**
 * Fetches all rows from the AuthorizedUsers sheet.
 * @returns {Promise<Array<string[]>>} Rows including header.
 */
async function getAllAuthorizedUsers() {
    const sheets = getSheetsClientReadOnly();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'AuthorizedUsers!A:D',
    });
    return response.data.values || [];
}

/**
 * Checks whether the given email is authorized for the specified action.
 * @param {string} email - The user's verified email address.
 * @param {string[]} [requiredRoles] - Roles that grant access. Defaults to WRITE_ROLES.
 * @returns {Promise<{authorized: boolean, reason?: string}>}
 */
async function checkAuthorization(email, requiredRoles = WRITE_ROLES) {
    try {
        const rows = await getAllAuthorizedUsers();

        if (!rows || rows.length === 0) {
            return { authorized: false, reason: 'No authorized users configured' };
        }

        // Skip header row, find matching email
        // Columns: A=name, B=email, C=role, D=active
        for (let i = 1; i < rows.length; i++) {
            const [, rowEmail, role, active] = rows[i];

            if (rowEmail && rowEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
                // Check if user is active
                if (active && active.toLowerCase().trim() !== 'true') {
                    return { authorized: false, reason: 'User account is deactivated' };
                }

                // Check if role permits the requested action
                const userRole = (role || '').toLowerCase().trim();
                if (!requiredRoles.includes(userRole)) {
                    return { authorized: false, reason: `Role '${role}' does not have permission for this action` };
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

/**
 * Registers a new user by appending to the AuthorizedUsers sheet.
 * Rejects if the email already exists.
 *
 * @param {string} name - User's display name.
 * @param {string} email - User's Gmail address.
 * @returns {Promise<{success: boolean, message: string}>}
 * @throws {Object} { statusCode, message } on failure.
 */
async function registerUser(name, email) {
    // 1. Fetch all existing users to check for duplicates
    const rows = await getAllAuthorizedUsers();

    // Columns: A=name, B=email, C=role, D=active
    for (let i = 1; i < rows.length; i++) {
        const rowEmail = (rows[i][1] || '').toLowerCase().trim();
        if (rowEmail === email.toLowerCase().trim()) {
            throw { statusCode: 409, message: 'This email is already registered' };
        }
    }

    // 2. Append new row: [name, email, buyer, TRUE]
    const sheets = getSheetsClientReadWrite();
    await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'AuthorizedUsers!A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [[name.trim(), email.trim(), 'buyer', 'TRUE']],
        },
    });

    console.log(`✅ Registered new user: ${name.trim()} (${email.trim()}) as buyer`);
    return { success: true, message: 'Registration successful' };
}

module.exports = { checkAuthorization, registerUser, WRITE_ROLES, READ_ROLES };
