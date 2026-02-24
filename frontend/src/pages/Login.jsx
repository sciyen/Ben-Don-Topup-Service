import { useState, useEffect, useRef } from 'react';
import { postRegister } from '../api';
import './Login.css';

/**
 * Login page component with registration support.
 * Tab-based UI: Sign In / Register
 */
function Login({ onLogin }) {
    const googleButtonRef = useRef(null);
    const [tab, setTab] = useState('login'); // 'login' | 'register'

    // Registration state
    const [regName, setRegName] = useState('');
    const [regToken, setRegToken] = useState(null);
    const [regEmail, setRegEmail] = useState('');
    const [regLoading, setRegLoading] = useState(false);
    const [regMessage, setRegMessage] = useState(null);
    const [gsiReady, setGsiReady] = useState(false);

    useEffect(() => {
        // Load the Google Identity Services script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google?.accounts?.id) {
                setGsiReady(true);
            }
        };
        document.head.appendChild(script);

        return () => {
            const existingScript = document.querySelector(
                'script[src="https://accounts.google.com/gsi/client"]'
            );
            if (existingScript) existingScript.remove();
        };
    }, []);

    // Initialize GSI for login tab
    useEffect(() => {
        if (!gsiReady || tab !== 'login' || !googleButtonRef.current) return;

        window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: (response) => {
                if (response.credential) {
                    onLogin(response.credential);
                }
            },
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'filled_blue',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: 300,
        });
    }, [gsiReady, tab, onLogin]);

    const regGoogleBtnRef = useRef(null);

    // Initialize GSI for register tab — renders a button (not prompt)
    useEffect(() => {
        if (!gsiReady || tab !== 'register' || !regGoogleBtnRef.current || regToken) return;

        window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: (response) => {
                if (response.credential) {
                    setRegToken(response.credential);
                    try {
                        const payload = JSON.parse(atob(response.credential.split('.')[1]));
                        setRegEmail(payload.email || '');
                        setRegName(payload.name || '');
                    } catch { /* ignore */ }
                    setRegMessage({ type: 'success', text: 'Google account verified! Fill in your name and click Register.' });
                }
            },
        });

        window.google.accounts.id.renderButton(regGoogleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signup_with',
            width: 300,
        });
    }, [gsiReady, tab, regToken]);

    async function handleRegister(e) {
        e.preventDefault();
        if (!regToken || !regName.trim()) return;

        setRegLoading(true);
        setRegMessage(null);

        try {
            await postRegister(regName.trim(), regToken);
            setRegMessage({ type: 'success', text: '✅ Registration successful! You can now sign in.' });
            setRegToken(null);
            setRegEmail('');
            setRegName('');

            // Auto-switch to login tab after 2 seconds
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
                        onClick={() => { setTab('login'); setRegMessage(null); }}
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
                    <>
                        <p className="login-prompt">Sign in with your Google account to continue</p>
                        <div ref={googleButtonRef} className="google-btn-container" />
                    </>
                )}

                {/* Register tab */}
                {tab === 'register' && (
                    <div className="register-section">
                        {!regToken ? (
                            <>
                                <p className="login-prompt">First, verify your Google account</p>
                                <div ref={regGoogleBtnRef} className="google-btn-container" />
                            </>
                        ) : (
                            <form className="register-form" onSubmit={handleRegister}>
                                <div className="register-field">
                                    <label htmlFor="reg-email">Email (from Google)</label>
                                    <input
                                        id="reg-email"
                                        type="email"
                                        value={regEmail}
                                        disabled
                                        className="register-input disabled"
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="reg-name">Display Name</label>
                                    <input
                                        id="reg-name"
                                        type="text"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        placeholder="Enter your display name"
                                        className="register-input"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn-register"
                                    disabled={regLoading || !regName.trim()}
                                >
                                    {regLoading ? '⏳ Registering…' : '📝 Register'}
                                </button>
                            </form>
                        )}

                        {regMessage && (
                            <p className={`register-msg ${regMessage.type}`}>
                                {regMessage.text}
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className="login-footer">
                <p>Internal use only · Authorized personnel</p>
            </div>
        </div>
    );
}

export default Login;
