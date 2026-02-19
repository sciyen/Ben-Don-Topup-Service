import { useState, useCallback } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AutoCheckout from './pages/AutoCheckout';
import './App.css';

/**
 * Root application component.
 * Manages auth state and routes between Login, Dashboard, and Auto Checkout.
 */
function App() {
  const [user, setUser] = useState(null); // { email, name, picture, token }
  const [page, setPage] = useState('dashboard'); // 'dashboard' | 'checkout'

  /**
   * Called after successful Google Sign-In.
   */
  const handleLogin = useCallback((credential) => {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      setUser({
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || null,
        token: credential,
      });
    } catch {
      console.error('Failed to decode token');
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setPage('dashboard');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  const handleNavigate = useCallback((target) => {
    setPage(target);
  }, []);

  if (!user) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Navigation Tabs */}
      <nav className="app-nav">
        <button
          className={`nav-tab ${page === 'dashboard' ? 'nav-active' : ''}`}
          onClick={() => setPage('dashboard')}
        >
          💰 Dashboard
        </button>
        <button
          className={`nav-tab ${page === 'checkout' ? 'nav-active' : ''}`}
          onClick={() => setPage('checkout')}
        >
          🧾 Auto Checkout
        </button>
      </nav>

      {page === 'dashboard' ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <AutoCheckout user={user} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default App;
