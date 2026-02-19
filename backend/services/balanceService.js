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

module.exports = { computeCustomerBalance };
