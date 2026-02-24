/**
 * Authorization Service
 * Manages user auth against the AuthorizedUsers sheet tab.
 *
 * Sheet "AuthorizedUsers" expected columns:
 * A: name | B: email | C: role | D: active | E: password_hash
 *
 * Roles:
 *   cashier — can top-up, spend, view balance
 *   admin   — can top-up, spend, view balance
 *   viewer  — can view balance and transactions only
 *   buyer   — default role for self-registered users
 */
const { google } = require('googleapis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');

const SALT_ROUNDS = 10;

// Role sets for different permission levels
const WRITE_ROLES = ['cashier', 'admin'];         // Can perform top-up and spend
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
        range: 'AuthorizedUsers!A:E',
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

        // Columns: A=name, B=email, C=role, D=active, E=password_hash
        for (let i = 1; i < rows.length; i++) {
            const [, rowEmail, role, active] = rows[i];

            if (rowEmail && rowEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
                if (active && active.toLowerCase().trim() !== 'true') {
                    return { authorized: false, reason: 'User account is deactivated' };
                }

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
 * Retrieves user info for the given email.
 * @param {string} email
 * @returns {Promise<{name, email, role, active} | null>}
 */
async function getUserInfo(email) {
    const rows = await getAllAuthorizedUsers();

    for (let i = 1; i < rows.length; i++) {
        const [name, rowEmail, role, active] = rows[i];
        if (rowEmail && rowEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
            return {
                name: (name || '').trim(),
                email: rowEmail.trim(),
                role: (role || '').toLowerCase().trim(),
                active: (active || '').toLowerCase().trim() === 'true',
            };
        }
    }

    return null;
}

/**
 * Authenticates a user by email and password.
 * Returns a signed JWT on success.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: {name, email, role}}>}
 * @throws {{ statusCode: number, message: string }}
 */
async function loginUser(email, password) {
    const rows = await getAllAuthorizedUsers();

    for (let i = 1; i < rows.length; i++) {
        const [name, rowEmail, role, active, passwordHash] = rows[i];

        if (rowEmail && rowEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
            // Check if active
            if (active && active.toLowerCase().trim() !== 'true') {
                throw { statusCode: 403, message: 'User account is deactivated' };
            }

            // Check password
            if (!passwordHash) {
                throw { statusCode: 401, message: 'No password set. Please contact an administrator.' };
            }

            const match = await bcrypt.compare(password, passwordHash);
            if (!match) {
                throw { statusCode: 401, message: 'Invalid email or password' };
            }

            // Issue JWT
            const userPayload = {
                email: rowEmail.trim(),
                name: (name || '').trim(),
                role: (role || '').toLowerCase().trim(),
            };

            const token = jwt.sign(userPayload, config.jwtSecret, {
                expiresIn: config.jwtExpiresIn,
            });

            return { token, user: userPayload };
        }
    }

    throw { statusCode: 401, message: 'Invalid email or password' };
}

/**
 * Registers a new user by appending to the AuthorizedUsers sheet.
 * Rejects if the email already exists.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} password - plaintext (will be hashed)
 * @returns {Promise<{success: boolean, message: string}>}
 * @throws {{ statusCode: number, message: string }}
 */
async function registerUser(name, email, password) {
    // 1. Validate email domain
    if (config.allowedEmailDomains.length > 0) {
        const domain = email.split('@')[1]?.toLowerCase().trim();
        if (!domain || !config.allowedEmailDomains.includes(domain)) {
            throw { statusCode: 400, message: `Only emails from these domains are allowed: ${config.allowedEmailDomains.join(', ')}` };
        }
    }

    // 2. Check for duplicate email
    const rows = await getAllAuthorizedUsers();
    for (let i = 1; i < rows.length; i++) {
        const rowEmail = (rows[i][1] || '').toLowerCase().trim();
        if (rowEmail === email.toLowerCase().trim()) {
            throw { statusCode: 409, message: 'This email is already registered' };
        }
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Append new row: [name, email, buyer, TRUE, passwordHash]
    const sheets = getSheetsClientReadWrite();
    await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'AuthorizedUsers!A:E',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [[name.trim(), email.trim(), 'buyer', 'TRUE', passwordHash]],
        },
    });

    console.log(`✅ Registered new user: ${name.trim()} (${email.trim()}) as buyer`);
    return { success: true, message: 'Registration successful' };
}

/**
 * Returns a list of all active user names.
 * @returns {Promise<string[]>}
 */
async function getAllUserNames() {
    const rows = await getAllAuthorizedUsers();
    const names = [];
    for (let i = 1; i < rows.length; i++) {
        const [name, , , active] = rows[i];
        if (name && (active || '').toLowerCase().trim() === 'true') {
            names.push(name.trim());
        }
    }
    return names;
}

module.exports = { checkAuthorization, registerUser, loginUser, getUserInfo, getAllUserNames, WRITE_ROLES, READ_ROLES };
