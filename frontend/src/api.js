/**
 * API client module
 * Handles all HTTP communication with the backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * POST /api/topup — Submit a new top-up transaction
 * @param {Object} data - { customer, amount, note, idempotencyKey }
 * @param {string} token - Google ID token
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
 * @param {string} token - Google ID token
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
 * @param {string} customer - Customer name
 * @param {string} token - Google ID token
 * @returns {Promise<Object>} { customer, balance }
 */
export async function getBalance(customer, token) {
    const res = await fetch(
        `${API_BASE}/api/balance?customer=${encodeURIComponent(customer)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json;
}

/**
 * GET /api/transactions — Retrieve recent transactions
 * @param {string} token - Google ID token
 * @param {number} limit - Max transactions to return
 * @returns {Promise<Array>} Array of transaction objects
 */
export async function getTransactions(token, limit = 20) {
    const res = await fetch(`${API_BASE}/api/transactions?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
    }

    return json.transactions;
}

/**
 * POST /api/balance/batch — Look up balances for multiple customers
 * @param {string[]} customers - Array of customer names
 * @param {string} token - Google ID token
 * @returns {Promise<Object>} Map of { customerName: balance }
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
 * POST /api/checkout/batch — Execute an atomic batch checkout
 * @param {Array<{customer: string, amount: number, note: string}>} rows
 * @param {string} idempotencyKey
 * @param {string} token - Google ID token
 * @returns {Promise<Object>} Result with status, transactionCount, transactionIDs
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
