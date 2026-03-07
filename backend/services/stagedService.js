/**
 * Staged Money Service
 * In-memory store for staged (pre-authorized) amounts.
 *
 * Buyers "stage" a portion of their balance to authorize cashier checkout.
 * Cashiers can only spend from staged amounts, not directly from balances.
 *
 * Behavior:
 *   - setStaged(customer, amount) replaces the current staged amount
 *   - deductStaged(customer, amount) atomically deducts from staged
 *   - Staged amounts reset to 0 on server restart (acceptable — buyers re-stage quickly)
 */

// In-memory store: Map<normalizedCustomerName, stagedAmount>
const stagedAmounts = new Map();

/**
 * Normalize customer name for consistent lookups.
 * @param {string} name
 * @returns {string}
 */
function normalize(name) {
    return (name || '').toLowerCase().trim();
}

/**
 * Get the current staged amount for a customer.
 * @param {string} customer
 * @returns {number} Staged amount (0 if none staged).
 */
function getStagedAmount(customer) {
    return stagedAmounts.get(normalize(customer)) || 0;
}

/**
 * Set the staged amount for a customer (replaces previous value).
 * @param {string} customer
 * @param {number} amount - Must be >= 0.
 */
function setStaged(customer, amount) {
    const key = normalize(customer);
    if (amount <= 0) {
        stagedAmounts.delete(key);
    } else {
        stagedAmounts.set(key, amount);
    }
}

/**
 * Atomically deduct from a customer's staged amount.
 * Returns true if deduction succeeded, false if insufficient staged amount.
 *
 * @param {string} customer
 * @param {number} amount - Amount to deduct (positive).
 * @returns {boolean} Whether the deduction was successful.
 */
function deductStaged(customer, amount) {
    const key = normalize(customer);
    const current = stagedAmounts.get(key) || 0;

    if (current < amount) {
        return false;
    }

    const remaining = current - amount;
    if (remaining <= 0) {
        stagedAmounts.delete(key);
    } else {
        stagedAmounts.set(key, remaining);
    }
    return true;
}

/**
 * Get staged amounts for multiple customers.
 * @param {string[]} customers
 * @returns {Object} Map of { customerName: stagedAmount }.
 */
function getStagedBatch(customers) {
    const result = {};
    for (const name of customers) {
        result[name] = getStagedAmount(name);
    }
    return result;
}

module.exports = { getStagedAmount, setStaged, deductStaged, getStagedBatch };
