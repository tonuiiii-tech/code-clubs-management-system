import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { can as canDo } from '@code-clubs/shared/permissions';
import * as authService from '../services/authService.js';
import { purgeExpired } from '../offline/index.js';
import { rememberUser } from '../offline/registry.js';
import { updateMyProfile } from '../services/usersService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Local data not synced for 14 days is deleted before anything else (D3-2).
    purgeExpired()
      .catch(() => {})
      .then(() => authService.restoreSession())
      .then((restored) => {
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
  const updateProfile = useCallback(async (changes) => {
    const { data } = await updateMyProfile(changes);
    setUser(data);
    rememberUser(data);
    return data;
  }, []);
  /** The server ends every session after a password change, so the user signs in again. */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await authService.changePassword(currentPassword, newPassword);
    setUser(null);
  }, []);

  /** For showing or hiding UI only. The server always enforces permissions (D1-3). */
  const can = useCallback((permission) => canDo(user, permission), [user]);

  const value = useMemo(
    () => ({ user, ready, login, logout, updateProfile, changePassword, can }),
    [user, ready, login, logout, updateProfile, changePassword, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
