import { useState, useEffect, useCallback } from 'react';
import { getBalance, getTransactions, postStaged, getStaged } from '../api';
import './MyAccount.css';

/**
 * MyAccount page — view for buyers (and other roles).
 * Shows balance lookup, staged money controls, and transaction history.
 */
function MyAccount({ user, userInfo, onLogout }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [searchName, setSearchName] = useState(userInfo?.name || '');
    const [message, setMessage] = useState(null);

    // Staged money state
    const [stagedAmount, setStagedAmount] = useState(0);
    const [stageInput, setStageInput] = useState('');
    const [stageLoading, setStageLoading] = useState(false);
    const [stageMessage, setStageMessage] = useState(null);

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
            fetchStagedAmount();
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

    async function fetchStagedAmount() {
        try {
            const result = await getStaged(user.token);
            setStagedAmount(result.stagedAmount || 0);
        } catch (err) {
            // Silently fail — staged amount defaults to 0
            console.error('Failed to fetch staged amount:', err.message);
        }
    }

    async function handleStage(e) {
        e.preventDefault();
        const amount = parseFloat(stageInput);
        if (isNaN(amount) || amount < 0) {
            setStageMessage({ type: 'error', text: 'Enter a valid amount (≥ 0)' });
            return;
        }

        setStageLoading(true);
        setStageMessage(null);
        try {
            const result = await postStaged(amount, user.token);
            setStagedAmount(result.stagedAmount);
            setBalance(result.balance);
            setStageInput('');
            setStageMessage({ type: 'success', text: `Staged $${new Intl.NumberFormat('en-US').format(result.stagedAmount)}` });
        } catch (err) {
            setStageMessage({ type: 'error', text: err.message });
        } finally {
            setStageLoading(false);
        }
    }

    async function handleClearStaged() {
        setStageLoading(true);
        setStageMessage(null);
        try {
            const result = await postStaged(0, user.token);
            setStagedAmount(result.stagedAmount);
            setStageInput('');
            setStageMessage({ type: 'success', text: 'Staged amount cleared' });
        } catch (err) {
            setStageMessage({ type: 'error', text: err.message });
        } finally {
            setStageLoading(false);
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

            {/* Stage Money Card */}
            <div className="myaccount-stage-card">
                <div className="stage-header">
                    <div className="stage-label">Staged Money</div>
                    <div className="stage-hint">Release funds for cashier checkout</div>
                </div>
                <div className="stage-current">
                    <span className="stage-current-label">Currently Staged:</span>
                    <span className={`stage-current-amount ${stagedAmount > 0 ? 'active' : ''}`}>
                        ${new Intl.NumberFormat('en-US').format(stagedAmount)}
                    </span>
                </div>
                <form className="stage-form" onSubmit={handleStage}>
                    <div className="stage-input-wrap">
                        <span className="stage-input-prefix">$</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={stageInput}
                            onChange={(e) => setStageInput(e.target.value)}
                            placeholder="Amount to stage"
                            className="stage-input"
                            disabled={stageLoading}
                        />
                    </div>
                    <div className="stage-btns">
                        <button
                            type="submit"
                            className="btn-stage"
                            disabled={stageLoading || !stageInput}
                        >
                            {stageLoading ? '⏳' : '📌 Stage'}
                        </button>
                        {stagedAmount > 0 && (
                            <button
                                type="button"
                                className="btn-unstage"
                                onClick={handleClearStaged}
                                disabled={stageLoading}
                            >
                                Clear Staged
                            </button>
                        )}
                    </div>
                </form>
                {stageMessage && (
                    <p className={`stage-msg ${stageMessage.type}`}>{stageMessage.text}</p>
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
