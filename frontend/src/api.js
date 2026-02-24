/**
 * API client module
 * Handles all HTTP communication with the backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * POST /api/login — Authenticate with email + password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: {name, email, role}}>}
 */
export async function postLogin(email, password) {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Login failed with status ${res.status}`);
    return json;
}

/**
 * POST /api/register — Register a new user account
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function postRegister(name, email, password) {
    const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Registration failed with status ${res.status}`);
    return json;
}

/**
 * GET /api/me — Get current user profile (name, email, role)
 * @param {string} token - JWT token
 * @returns {Promise<{name: string, email: string, role: string, active: boolean}>}
 */
export async function getMe(token) {
    const res = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Request failed with status ${res.status}`);
    return json;
}

/**
 * POST /api/topup — Submit a new top-up transaction
 * @param {Object} data - { customer, amount, note, idempotencyKey }
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Response data
 */
export async function postTopUp(data, token) {
    const res = await fetch(`${API_BASE}/api/topup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}

/**
 * POST /api/spend — Submit a spend (deduction) transaction
 * @param {Object} data - { customer, amount, note, idempotencyKey }
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Response data
 */
export async function postSpend(data, token) {
    const res = await fetch(`${API_BASE}/api/spend`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}

/**
 * GET /api/balance?customer=xxx — Look up customer balance
 */
export async function getBalance(customer, token) {
    const res = await fetch(
        `${API_BASE}/api/balance?customer=${encodeURIComponent(customer)}`,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}

/**
 * GET /api/transactions — Get recent transactions
 */
export async function getTransactions(token, limit = 20) {
    const res = await fetch(`${API_BASE}/api/transactions?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json.transactions || [];
}

/**
 * POST /api/balance/batch — Batch balance lookup
 */
export async function postBatchBalances(customers, token) {
    const res = await fetch(`${API_BASE}/api/balance/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customers }),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}

/**
 * POST /api/checkout/batch — Batch checkout
 */
export async function postBatchCheckout(rows, idempotencyKey, token) {
    const res = await fetch(`${API_BASE}/api/checkout/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows, idempotencyKey }),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}
