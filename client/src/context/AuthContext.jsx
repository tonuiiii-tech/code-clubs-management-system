import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { can as canDo } from '@code-clubs/shared/permissions';
import * as authService from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    authService.restoreSession().then((restored) => {
      setUser(restored);
      setReady(true);
    });
  }, []);

  const login = useCallback(
    async (email, password) => setUser(await authService.login(email, password)),
    [],
  );
  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  /** For showing or hiding UI only. The server always enforces permissions (D1-3). */
  const can = useCallback((permission) => canDo(user, permission), [user]);

  const value = useMemo(
    () => ({ user, ready, login, logout, can }),
    [user, ready, login, logout, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
