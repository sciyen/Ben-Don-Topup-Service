/**
 * Balance Service
 * Computes customer balance dynamically from the append-only ledger.
 *
 * Accounting model:
 *   balance = sum(all transaction amounts for a given customer)
 *   TOPUP → positive amount
 *   SPEND → negative amount
 *
 * No stored balance — always computed from the full transaction history.
 */
const { getAllTransactions } = require('./sheetsService');
const { validateCustomerName } = require('./authorizationService');

/**
 * Computes the current balance for a customer by summing all their
 * transaction amounts from the Transactions sheet.
 *
 * @param {string} customerName - The customer name to look up (case-insensitive).
 * @returns {Promise<number>} The customer's current balance. Returns 0 if customer not found.
 */
async function computeCustomerBalance(customerName) {
    const transactions = await getAllTransactions();

    const normalizedName = customerName.toLowerCase().trim();

    // Sum all amounts for matching customer
    const balance = transactions
        .filter((tx) => tx.customer.toLowerCase().trim() === normalizedName)
        .reduce((sum, tx) => sum + tx.amount, 0);

    return balance;
}

/**
 * Computes balances for multiple customers in a single ledger fetch.
 * Returns null for customers that are not registered (unknown accounts).
 *
 * @param {string[]} customerNames - Array of customer names.
 * @param {Array<Object>} [existingTransactions] - Optional pre-fetched transactions to avoid redundant reads.
 * @returns {Promise<Object>} Map of { customerName: balance | null }.
 */
async function computeBatchBalances(customerNames, existingTransactions = null) {
    const transactions = existingTransactions || await getAllTransactions();

    const balances = {};

    for (const name of customerNames) {
        // Check if customer is a known account
        const validation = await validateCustomerName(name);
        if (!validation.valid) {
            balances[name] = null;
            continue;
        }

        const normalizedName = name.toLowerCase().trim();

        balances[name] = transactions
            .filter((tx) => tx.customer.toLowerCase().trim() === normalizedName)
            .reduce((sum, tx) => sum + tx.amount, 0);
    }

    return balances;
}

module.exports = { computeCustomerBalance, computeBatchBalances };
