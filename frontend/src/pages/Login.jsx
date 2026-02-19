import { useEffect, useRef } from 'react';
import './Login.css';

/**
 * Login page component.
 * Renders the Google Sign-In button using Google Identity Services.
 */
function Login({ onLogin }) {
    const googleButtonRef = useRef(null);

    useEffect(() => {
        // Load the Google Identity Services script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google?.accounts?.id) {
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
            }
        };
        document.head.appendChild(script);

        return () => {
            // Cleanup: remove script on unmount
            const existingScript = document.querySelector(
                'script[src="https://accounts.google.com/gsi/client"]'
            );
            if (existingScript) existingScript.remove();
        };
    }, [onLogin]);

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-icon">💰</div>
                <h1>Ben-Don Top-Up</h1>
                <p className="login-subtitle">Internal Cash Accounting System</p>
                <div className="login-divider"></div>
                <p className="login-prompt">Sign in with your Google account to continue</p>
                <div ref={googleButtonRef} className="google-btn-container"></div>
            </div>
            <div className="login-footer">
                <p>Internal use only · Authorized personnel</p>
            </div>
        </div>
    );
}

export default Login;
