import { useState, useCallback, useEffect } from 'react';
import { getMe } from './api';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import AutoCheckout from './pages/AutoCheckout';
import MyAccount from './pages/MyAccount';
import InstallPlugin from './pages/InstallPlugin';
import './App.css';

/**
 * Root application component.
 * Manages auth state and routes between pages based on user role.
 *
 * Roles & page access:
 *   buyer  → My Account only
 *   viewer → My Account only
 *   cashier / admin → Dashboard, Auto Checkout, My Account
 */
function App() {
  const [user, setUser] = useState(null);       // { email, name, role, token }
  const [userInfo, setUserInfo] = useState(null); // { name, email, role, active }
  const [page, setPage] = useState('home');
  const [roleLoading, setRoleLoading] = useState(false);

  /**
   * Called after successful login.
   * @param {string} token - JWT
   * @param {Object} loginUser - { name, email, role } from login response
   */
  const handleLogin = useCallback((token, loginUser) => {
    setUser({
      email: loginUser.email,
      name: loginUser.name,
      picture: null,
      token,
    });
  }, []);

  // Fetch full user profile after login
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchRole() {
      setRoleLoading(true);
      try {
        const info = await getMe(user.token);
        if (!cancelled) {
          setUserInfo(info);
          const role = (info.role || '').toLowerCase();
          if (role === 'buyer' || role === 'viewer') {
            setPage('home');
          } else {
            setPage('home');
          }
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err.message);
        if (!cancelled) {
          setUserInfo(null);
          setPage('account');
        }
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }

    fetchRole();
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setUserInfo(null);
    setPage('home');
  }, []);

  const role = (userInfo?.role || '').toLowerCase();
  const canWrite = role === 'cashier' || role === 'admin';

  if (!user) {
    const currentPage = page === 'login' ? 'login' : 'home';
    return (
      <div className="app">
        <nav className="app-nav">
          <button
            className={`nav-tab ${currentPage === 'home' ? 'nav-active' : ''}`}
            onClick={() => setPage('home')}
          >
            🏠 Home
          </button>
          <button
            className={`nav-tab ${currentPage === 'login' ? 'nav-active' : ''}`}
            onClick={() => setPage('login')}
          >
            🔑 Login
          </button>
        </nav>
        {currentPage === 'home' && <Home />}
        {currentPage === 'login' && <Login onLogin={handleLogin} />}
      </div>
    );
  }

  if (roleLoading || !page) {
    return (
      <div className="app">
        <div className="app-loading">Loading user profile…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="app-nav">
        <button
          className={`nav-tab ${page === 'home' ? 'nav-active' : ''}`}
          onClick={() => setPage('home')}
        >
          🏠 Home
        </button>
        {canWrite && (
          <>
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
            <button
              className={`nav-tab ${page === 'plugin' ? 'nav-active' : ''}`}
              onClick={() => setPage('plugin')}
            >
              🔌 Install Plugin
            </button>
          </>
        )}
        <button
          className={`nav-tab ${page === 'account' ? 'nav-active' : ''}`}
          onClick={() => setPage('account')}
        >
          👤 My Account
        </button>
      </nav>

      {page === 'home' && (
        <Home />
      )}
      {page === 'dashboard' && canWrite && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
      {page === 'checkout' && canWrite && (
        <AutoCheckout user={user} onNavigate={setPage} />
      )}
      {page === 'plugin' && canWrite && (
        <InstallPlugin user={user} />
      )}
      {page === 'account' && (
        <MyAccount user={user} userInfo={userInfo} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
