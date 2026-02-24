import { useState, useEffect, useCallback } from 'react';
import { getBalance, getTransactions } from '../api';
import './MyAccount.css';

/**
 * MyAccount page — read-only view for buyers.
 * Shows balance lookup (by their own name) and transaction history.
 */
function MyAccount({ user, userInfo, onLogout }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [searchName, setSearchName] = useState(userInfo?.name || '');
    const [message, setMessage] = useState(null);

    // Fetch recent transactions
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTransactions(user.token, 20);
            setTransactions(data);
        } catch (err) {
            if (err.message.includes('401')) onLogout();
        } finally {
            setLoading(false);
        }
    }, [user.token, onLogout]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Auto-lookup balance for the user's registered name
    useEffect(() => {
        if (userInfo?.name) {
            lookupBalance(userInfo.name);
        }
    }, [userInfo?.name, user.token]);

    async function lookupBalance(name) {
        if (!name || !name.trim()) return;
        setBalanceLoading(true);
        setMessage(null);
        try {
            const result = await getBalance(name.trim(), user.token);
            setBalance(result.balance);
            setSearchName(name.trim());
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
            setBalance(null);
        } finally {
            setBalanceLoading(false);
        }
    }

    function handleSearch(e) {
        e.preventDefault();
        lookupBalance(searchName);
    }

    // Filter transactions to show only the user's own
    const myTransactions = transactions.filter(
        (t) => t.customer?.toLowerCase() === (searchName || userInfo?.name || '').toLowerCase()
    );

    return (
        <div className="myaccount-page">
            {/* Header */}
            <div className="myaccount-header">
                <div className="myaccount-user">
                    {user.picture && (
                        <img src={user.picture} alt="" className="myaccount-avatar" />
                    )}
                    <div>
                        <h2 className="myaccount-name">{userInfo?.name || user.name}</h2>
                        <p className="myaccount-email">{user.email}</p>
                        <span className="myaccount-role">role: {userInfo?.role || '—'}</span>
                    </div>
                </div>
                <button className="btn-logout" onClick={onLogout}>Logout</button>
            </div>

            {/* Balance Card */}
            <div className="myaccount-balance-card">
                <div className="balance-label">Current Balance</div>
                <div className="balance-amount">
                    {balanceLoading ? (
                        <span className="balance-loading">Loading…</span>
                    ) : balance !== null ? (
                        `$${new Intl.NumberFormat('en-US').format(balance)}`
                    ) : (
                        '—'
                    )}
                </div>
                {userInfo?.role !== 'buyer' && (
                    <form className="balance-search" onSubmit={handleSearch}>
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder="Enter name to look up"
                            className="balance-search-input"
                        />
                        <button type="submit" className="btn-search" disabled={balanceLoading}>
                            🔍
                        </button>
                    </form>
                )}
                {message && (
                    <p className={`balance-msg ${message.type}`}>{message.text}</p>
                )}
            </div>

            {/* Transaction History */}
            <div className="myaccount-history">
                <h3>Transaction History {searchName && `— ${searchName}`}</h3>

                {loading ? (
                    <div className="history-loading">Loading transactions…</div>
                ) : myTransactions.length === 0 ? (
                    <div className="history-empty">No transactions found.</div>
                ) : (
                    <div className="history-table-wrap">
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myTransactions.map((t, i) => (
                                    <tr key={t.transactionId || i}>
                                        <td className="col-date">
                                            {new Date(t.timestamp).toLocaleString('zh-TW', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </td>
                                        <td>
                                            <span className={`type-badge ${(t.type || '').toLowerCase()}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className={`col-amount ${parseFloat(t.amount) >= 0 ? 'positive' : 'negative'}`}>
                                            {parseFloat(t.amount) >= 0 ? '+' : ''}
                                            {new Intl.NumberFormat('en-US').format(t.amount)}
                                        </td>
                                        <td className="col-note">{t.note || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyAccount;
