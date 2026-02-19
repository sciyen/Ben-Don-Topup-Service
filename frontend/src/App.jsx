import { useState, useCallback, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

/**
 * Root application component.
 * Manages auth state and routes between Login and Dashboard views.
 */
function App() {
  const [user, setUser] = useState(null); // { email, name, picture, token }

  /**
   * Called after successful Google Sign-In.
   * Stores user info and token in memory.
   */
  const handleLogin = useCallback((credential) => {
    // Decode the JWT to get user info (for display only — backend verifies)
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
    // Revoke Google session
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  return (
    <div className="app">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
