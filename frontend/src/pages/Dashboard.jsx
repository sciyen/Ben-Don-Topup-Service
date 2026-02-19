import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { postTopUp, getTransactions } from '../api';
import './Dashboard.css';

/**
 * Dashboard page component.
 * Shows transaction history, today's total, and the top-up form.
 */
function Dashboard({ user, onLogout }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text }

    // Form state
    const [customer, setCustomer] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [note, setNote] = useState('');

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
            // If auth fails, trigger logout
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
     * Calculate today's total from loaded transactions.
     */
    const todayTotal = transactions
        .filter((t) => {
            const txDate = new Date(t.timestamp).toDateString();
            const today = new Date().toDateString();
            return txDate === today;
        })
        .reduce((sum, t) => sum + t.amount, 0);

    /**
     * Handle form submission.
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
            const result = await postTopUp(
                {
                    customer: customer.trim(),
                    amount: parsedAmount,
                    paymentMethod,
                    note: note.trim(),
                    idempotencyKey: uuidv4(),
                },
                user.token
            );

            setMessage({
                type: 'success',
                text: `✅ Transaction ${result.transactionID.slice(0, 8)}… recorded successfully`,
            });

            // Clear form
            setCustomer('');
            setAmount('');
            setPaymentMethod('Cash');
            setNote('');

            // Refresh transaction list
            await fetchTransactions();
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
                    <div className="stat-card stat-today">
                        <div className="stat-label">Today's Total</div>
                        <div className="stat-value">{formatAmount(todayTotal)}</div>
                    </div>
                    <div className="stat-card stat-count">
                        <div className="stat-label">Recent Transactions</div>
                        <div className="stat-value">{transactions.length}</div>
                    </div>
                </div>

                <div className="dashboard-grid">
                    {/* Top-Up Form */}
                    <section className="card form-card">
                        <h2>New Top-Up</h2>

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
                                    onChange={(e) => setCustomer(e.target.value)}
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
                                <label htmlFor="paymentMethod">Payment Method</label>
                                <select
                                    id="paymentMethod"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="QR Payment">QR Payment</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="note">Note (optional)</label>
                                <input
                                    id="note"
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="e.g. February top-up"
                                    disabled={submitting}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-submit"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <span className="spinner">⏳</span>
                                ) : (
                                    '💸 Submit Top-Up'
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
                                            <div className="tx-customer">{tx.customer}</div>
                                            <div className="tx-amount">
                                                {formatAmount(tx.amount)}
                                            </div>
                                        </div>
                                        <div className="tx-details">
                                            <span className="tx-method">{tx.paymentMethod}</span>
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
