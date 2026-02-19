import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { postTopUp, postSpend, getTransactions, getBalance } from '../api';
import './Dashboard.css';

/**
 * Dashboard page component.
 * Shows transaction history, balance lookup, and top-up / spend forms.
 */
function Dashboard({ user, onLogout }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

    // Mode toggle: 'topup' or 'spend'
    const [mode, setMode] = useState('topup');

    // Form state
    const [customer, setCustomer] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    // Balance state
    const [balance, setBalance] = useState(null); // null = not looked up yet
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [balanceCustomer, setBalanceCustomer] = useState(''); // tracks which customer the balance is for

    /**
     * Fetch recent transactions from the backend.
     */
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTransactions(user.token, 10);
            setTransactions(data);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            if (err.message.includes('401') || err.message.includes('token')) {
                onLogout();
            }
        } finally {
            setLoading(false);
        }
    }, [user.token, onLogout]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    /**
     * Fetch balance for the current customer in the form.
     * Debounced: triggered when customer field loses focus or on demand.
     */
    const fetchBalance = useCallback(async (customerName, force = false) => {
        if (!customerName || customerName.trim().length === 0) {
            setBalance(null);
            setBalanceCustomer('');
            return;
        }

        const trimmed = customerName.trim();
        // Don't re-fetch if already showing balance for same customer (unless forced)
        if (!force && trimmed === balanceCustomer) return;

        try {
            setBalanceLoading(true);
            const result = await getBalance(trimmed, user.token);
            setBalance(result.balance);
            setBalanceCustomer(trimmed);
        } catch (err) {
            console.error('Failed to fetch balance:', err);
            setBalance(null);
            setBalanceCustomer('');
        } finally {
            setBalanceLoading(false);
        }
    }, [user.token, balanceCustomer]);

    /**
     * Calculate today's totals from loaded transactions.
     */
    const todayTopups = transactions
        .filter((t) => {
            const txDate = new Date(t.timestamp).toDateString();
            const today = new Date().toDateString();
            return txDate === today && t.type === 'TOPUP';
        })
        .reduce((sum, t) => sum + t.amount, 0);

    const todaySpends = transactions
        .filter((t) => {
            const txDate = new Date(t.timestamp).toDateString();
            const today = new Date().toDateString();
            return txDate === today && t.type === 'SPEND';
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    /**
     * Handle form submission — routes to the correct endpoint based on mode.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        // Client-side validation
        const parsedAmount = parseFloat(amount);
        if (!customer.trim()) {
            setMessage({ type: 'error', text: 'Customer name is required' });
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setMessage({ type: 'error', text: 'Amount must be a positive number' });
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                customer: customer.trim(),
                amount: parsedAmount,
                note: note.trim(),
                idempotencyKey: uuidv4(),
            };

            const submitFn = mode === 'topup' ? postTopUp : postSpend;
            const result = await submitFn(payload, user.token);

            const label = mode === 'topup' ? 'Top-Up' : 'Spend';
            setMessage({
                type: 'success',
                text: `✅ ${label} ${result.transactionID.slice(0, 8)}… recorded successfully`,
            });

            // Clear form
            setAmount('');
            setNote('');

            // Refresh data
            await fetchTransactions();
            // Force re-fetch balance for the same customer
            await fetchBalance(customer.trim(), true);
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Format a timestamp for display.
     */
    const formatTime = (ts) => {
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return ts;
        }
    };

    /**
     * Format currency amount.
     */
    const formatAmount = (amt) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amt);
    };

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <span className="header-icon">💰</span>
                    <h1>Ben-Don Top-Up</h1>
                </div>
                <div className="header-right">
                    <div className="user-info">
                        {user.picture && (
                            <img src={user.picture} alt="" className="user-avatar" />
                        )}
                        <span className="user-name">{user.name}</span>
                    </div>
                    <button className="btn-logout" onClick={onLogout}>
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                {/* Stats Row */}
                <div className="stats-row">
                    <div className="stat-card stat-topup">
                        <div className="stat-label">Today's Top-Ups</div>
                        <div className="stat-value stat-positive">+{formatAmount(todayTopups)}</div>
                    </div>
                    <div className="stat-card stat-spend">
                        <div className="stat-label">Today's Spending</div>
                        <div className="stat-value stat-negative">-{formatAmount(todaySpends)}</div>
                    </div>
                    <div className="stat-card stat-count">
                        <div className="stat-label">Recent Transactions</div>
                        <div className="stat-value">{transactions.length}</div>
                    </div>
                </div>

                <div className="dashboard-grid">
                    {/* Transaction Form */}
                    <section className="card form-card">
                        {/* Mode Toggle */}
                        <div className="mode-toggle">
                            <button
                                className={`mode-btn ${mode === 'topup' ? 'active-topup' : ''}`}
                                onClick={() => { setMode('topup'); setMessage(null); }}
                            >
                                ⬆️ Top-Up
                            </button>
                            <button
                                className={`mode-btn ${mode === 'spend' ? 'active-spend' : ''}`}
                                onClick={() => { setMode('spend'); setMessage(null); }}
                            >
                                ⬇️ Spend
                            </button>
                        </div>

                        {/* Balance Display */}
                        {balance !== null && (
                            <div className="balance-card">
                                <div className="balance-label">Balance: {balanceCustomer}</div>
                                <div className={`balance-value ${balance <= 0 ? 'balance-zero' : ''}`}>
                                    {formatAmount(balance)}
                                </div>
                            </div>
                        )}

                        {message && (
                            <div className={`alert alert-${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="topup-form">
                            <div className="form-group">
                                <label htmlFor="customer">Customer</label>
                                <input
                                    id="customer"
                                    type="text"
                                    value={customer}
                                    onChange={(e) => {
                                        setCustomer(e.target.value);
                                        // Reset balance when customer changes
                                        if (e.target.value.trim() !== balanceCustomer) {
                                            setBalance(null);
                                            setBalanceCustomer('');
                                        }
                                    }}
                                    onBlur={() => fetchBalance(customer)}
                                    placeholder="Enter customer name"
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="amount">Amount</label>
                                <input
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0.01"
                                    step="0.01"
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="note">Note (optional)</label>
                                <input
                                    id="note"
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={mode === 'topup' ? 'e.g. February top-up' : 'e.g. Purchase of materials'}
                                    disabled={submitting}
                                />
                            </div>

                            <button
                                type="submit"
                                className={`btn-submit ${mode === 'spend' ? 'btn-spend' : ''}`}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <span className="spinner">⏳</span>
                                ) : mode === 'topup' ? (
                                    '💸 Submit Top-Up'
                                ) : (
                                    '🛒 Submit Spend'
                                )}
                            </button>
                        </form>
                    </section>

                    {/* Transaction List */}
                    <section className="card transactions-card">
                        <h2>Recent Transactions</h2>

                        {loading ? (
                            <div className="loading">Loading transactions…</div>
                        ) : transactions.length === 0 ? (
                            <div className="empty-state">
                                <p>No transactions yet</p>
                            </div>
                        ) : (
                            <div className="transactions-list">
                                {transactions.map((tx) => (
                                    <div key={tx.transactionId} className="tx-item">
                                        <div className="tx-main">
                                            <div className="tx-left">
                                                <span className={`tx-type-badge ${tx.type === 'TOPUP' ? 'badge-topup' : 'badge-spend'}`}>
                                                    {tx.type === 'TOPUP' ? '⬆' : '⬇'}
                                                </span>
                                                <span className="tx-customer">{tx.customer}</span>
                                            </div>
                                            <div className={`tx-amount ${tx.amount >= 0 ? 'tx-positive' : 'tx-negative'}`}>
                                                {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)}
                                            </div>
                                        </div>
                                        <div className="tx-details">
                                            <span className={`tx-type ${tx.type === 'TOPUP' ? 'type-topup' : 'type-spend'}`}>
                                                {tx.type}
                                            </span>
                                            <span className="tx-time">{formatTime(tx.timestamp)}</span>
                                        </div>
                                        {tx.note && <div className="tx-note">{tx.note}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
