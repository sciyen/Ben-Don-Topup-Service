import { useState } from 'react';
import { postLogin, postRegister } from '../api';
import './Login.css';

/**
 * Login page component with email/password authentication.
 * Tab-based UI: Sign In / Register
 */
function Login({ onLogin }) {
    const [tab, setTab] = useState('login'); // 'login' | 'register'

    // Login state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginMessage, setLoginMessage] = useState(null);

    // Registration state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [regLoading, setRegLoading] = useState(false);
    const [regMessage, setRegMessage] = useState(null);

    async function handleLogin(e) {
        e.preventDefault();
        if (!loginEmail.trim() || !loginPassword) return;

        setLoginLoading(true);
        setLoginMessage(null);

        try {
            const result = await postLogin(loginEmail.trim(), loginPassword);
            // result = { token, user: { name, email, role } }
            onLogin(result.token, result.user);
        } catch (err) {
            setLoginMessage({ type: 'error', text: err.message });
        } finally {
            setLoginLoading(false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        if (!regName.trim() || !regEmail.trim() || !regPassword) return;

        const confirmed = window.confirm(
            `Is "${regName.trim()}" the exact display name you use on dinbendon?\n\nThis must match exactly for checkout to work. You can not modify this later.`
        );
        if (!confirmed) return;

        setRegLoading(true);
        setRegMessage(null);

        try {
            await postRegister(regName.trim(), regEmail.trim(), regPassword);
            setRegMessage({ type: 'success', text: '✅ Registration successful! You can now sign in.' });
            setRegName('');
            setRegEmail('');
            setRegPassword('');
            setTimeout(() => setTab('login'), 2000);
        } catch (err) {
            setRegMessage({ type: 'error', text: err.message });
        } finally {
            setRegLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-icon">💰</div>
                <h1>Ben-Don Top-Up</h1>
                <p className="login-subtitle">Internal Cash Accounting System</p>

                {/* Tab switcher */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${tab === 'login' ? 'active' : ''}`}
                        onClick={() => { setTab('login'); setLoginMessage(null); }}
                    >
                        Sign In
                    </button>
                    <button
                        className={`login-tab ${tab === 'register' ? 'active' : ''}`}
                        onClick={() => { setTab('register'); setRegMessage(null); }}
                    >
                        Register
                    </button>
                </div>

                <div className="login-divider" />

                {/* Login tab */}
                {tab === 'login' && (
                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="auth-field">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="auth-input"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="auth-input"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-auth-submit"
                            disabled={loginLoading || !loginEmail.trim() || !loginPassword}
                        >
                            {loginLoading ? '⏳ Signing in…' : '🔑 Sign In'}
                        </button>
                        {loginMessage && (
                            <p className={`auth-msg ${loginMessage.type}`}>{loginMessage.text}</p>
                        )}
                    </form>
                )}

                {/* Register tab */}
                {tab === 'register' && (
                    <form className="auth-form" onSubmit={handleRegister}>
                        <div className="auth-field">
                            <label htmlFor="reg-name">DinBenDon User Name</label>
                            <input
                                id="reg-name"
                                type="text"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                placeholder="Your display name"
                                className="auth-input"
                                required
                                autoFocus
                            />
                            <span className="auth-hint">⚠️ Must match your exact name on dinbendon</span>
                        </div>
                        <div className="auth-field">
                            <label htmlFor="reg-email">Email</label>
                            <input
                                id="reg-email"
                                type="email"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="auth-input"
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="reg-password">Password</label>
                            <div className="auth-input-wrap">
                                <input
                                    id="reg-password"
                                    type={showRegPassword ? 'text' : 'password'}
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="auth-input"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    className="btn-toggle-pw"
                                    onClick={() => setShowRegPassword(!showRegPassword)}
                                    tabIndex={-1}
                                >
                                    {showRegPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="btn-auth-submit btn-register"
                            disabled={regLoading || !regName.trim() || !regEmail.trim() || regPassword.length < 6}
                        >
                            {regLoading ? '⏳ Registering…' : '📝 Register'}
                        </button>
                        {regMessage && (
                            <p className={`auth-msg ${regMessage.type}`}>{regMessage.text}</p>
                        )}
                    </form>
                )}
            </div>
            <div className="login-footer">
                <p>Internal use only · Authorized personnel</p>
            </div>
        </div>
    );
}

export default Login;
