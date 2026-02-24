import { useState, useCallback, useEffect } from 'react';
import { getMe } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AutoCheckout from './pages/AutoCheckout';
import MyAccount from './pages/MyAccount';
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
  const [user, setUser] = useState(null);     // { email, name, picture, token }
  const [userInfo, setUserInfo] = useState(null); // { name, email, role, active }
  const [page, setPage] = useState(null);     // set after role is known
  const [roleLoading, setRoleLoading] = useState(false);

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

  // Fetch user role after login
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchRole() {
      setRoleLoading(true);
      try {
        const info = await getMe(user.token);
        if (!cancelled) {
          setUserInfo(info);
          // Set default page based on role
          const role = (info.role || '').toLowerCase();
          if (role === 'buyer' || role === 'viewer') {
            setPage('account');
          } else {
            setPage('dashboard');
          }
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err.message);
        // If user not found, they may not be registered
        if (!cancelled) {
          setUserInfo(null);
          setPage('account'); // fallback to account page
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
    setPage(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  // Determine which tabs are visible
  const role = (userInfo?.role || '').toLowerCase();
  const canWrite = role === 'cashier' || role === 'admin';

  if (!user) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
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
      {/* Navigation Tabs */}
      <nav className="app-nav">
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
          </>
        )}
        <button
          className={`nav-tab ${page === 'account' ? 'nav-active' : ''}`}
          onClick={() => setPage('account')}
        >
          👤 My Account
        </button>
      </nav>

      {page === 'dashboard' && canWrite && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
      {page === 'checkout' && canWrite && (
        <AutoCheckout user={user} onNavigate={setPage} />
      )}
      {page === 'account' && (
        <MyAccount user={user} userInfo={userInfo} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
