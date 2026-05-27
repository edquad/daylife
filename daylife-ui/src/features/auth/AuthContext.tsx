import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '../../lib/api';
import { loadData, resolveHouseholdType, beginFreshSignup, endFreshSignup, clearAccountData } from '../../lib/storage';
import { clearUnlock, markUserUnlocked } from '../../lib/pin';
import { queryClient } from '../../lib/queryClient';
import { createAccount, resolveAccountId, setActiveAccountId, getActiveAccountId, normalizeUsername } from '../../lib/accounts';
import { loadGitHubConfig, saveGitHubConfig, syncNow } from '../../lib/githubSync';

export interface SignupInput {
  username: string;
  name: string;
  pin?: string;
}

export interface LoginInput {
  username: string;
  pin?: string;
}

export interface ResetPinInput {
  username: string;
  recoveryCode: string;
  newPin: string;
}

interface AuthContextType {
  user: User | null;
  setupComplete: boolean;
  pendingRecoveryCode: string | null;
  acknowledgeRecoveryCode: () => void;
  signup: (input: SignupInput) => Promise<string | undefined>;
  login: (input: LoginInput) => Promise<void>;
  resetPin: (input: ResetPinInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);

  const refreshFromStorage = () => {
    const data = loadData();
    setSetupComplete(data.setupComplete);
  };

  useEffect(() => {
    refreshFromStorage();
    const savedToken = api.getToken();
    if (savedToken && getActiveAccountId()) {
      api.get<User>('/auth/me')
        .then((u) => {
          setUser(u);
          markUserUnlocked(u.id);
          api.post('/connections/sync-inbox').catch(() => undefined);
        })
        .catch(() => api.setToken(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const onDataChange = () => refreshFromStorage();
    window.addEventListener('daylife-data-changed', onDataChange);
    return () => window.removeEventListener('daylife-data-changed', onDataChange);
  }, []);

  const signup = async ({ username, name, pin }: SignupInput) => {
    clearUnlock();
    api.setToken(null);
    setUser(null);
    beginFreshSignup();

    const accountId = await createAccount(username);
    setActiveAccountId(accountId);
    clearAccountData();
    saveGitHubConfig({ lastSha: undefined, lastSyncedAt: undefined });

    const res = await api.post<{ token: string; user: User; recoveryCode?: string }>('/auth/signup', {
      username: normalizeUsername(username),
      name: name.trim(),
      pin: pin?.trim() || undefined,
    });
    api.setToken(res.token);
    markUserUnlocked(res.user.id);
    setUser(res.user);
    endFreshSignup();
    refreshFromStorage();

    try {
      await syncNow(loadGitHubConfig());
    } catch {
      /* local account still works */
    }

    try {
      await api.post('/connections/sync-inbox');
    } catch {
      /* inbox optional */
    }
    await queryClient.invalidateQueries();
    if (res.recoveryCode) setPendingRecoveryCode(res.recoveryCode);
    return res.recoveryCode;
  };

  const acknowledgeRecoveryCode = () => setPendingRecoveryCode(null);

  const resetPin = async ({ username, recoveryCode, newPin }: ResetPinInput) => {
    clearUnlock();
    api.setToken(null);
    setUser(null);

    const accountId = await resolveAccountId(username);
    if (!accountId) {
      throw new Error('No account with that username.');
    }

    setActiveAccountId(accountId);
    clearAccountData();
    saveGitHubConfig({ lastSha: undefined, lastSyncedAt: undefined });

    try {
      await syncNow(loadGitHubConfig());
    } catch {
      throw new Error('Could not load your account from cloud. Check connection and try again.');
    }

    await api.post('/auth/forgot-pin', {
      username: normalizeUsername(username),
      recoveryCode,
      newPin,
    });

    try {
      await syncNow(loadGitHubConfig());
    } catch {
      /* PIN saved locally; cloud push will retry */
    }

    await login({ username, pin: newPin });
  };

  const login = async ({ username, pin }: LoginInput) => {
    clearUnlock();
    api.setToken(null);
    setUser(null);

    const accountId = await resolveAccountId(username);
    if (!accountId) {
      throw new Error('No account with that username. Sign up first.');
    }

    setActiveAccountId(accountId);
    clearAccountData();
    saveGitHubConfig({ lastSha: undefined, lastSyncedAt: undefined });

    try {
      await syncNow(loadGitHubConfig());
    } catch {
      throw new Error('Could not load your data from cloud. Check connection and try again.');
    }

    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      username: normalizeUsername(username),
      pin: pin?.trim() || undefined,
    });
    api.setToken(res.token);
    markUserUnlocked(res.user.id);
    setUser(res.user);
    refreshFromStorage();

    try {
      await api.post('/connections/sync-inbox');
    } catch {
      /* inbox sync is best-effort */
    }

    await queryClient.invalidateQueries();
  };

  const logout = () => {
    clearUnlock();
    api.setToken(null);
    setUser(null);
    setActiveAccountId(null);
  };

  const refreshUser = async () => {
    const me = await api.get<User>('/auth/me');
    setUser(me);
    refreshFromStorage();
  };

  return (
    <AuthContext.Provider value={{
      user,
      setupComplete,
      pendingRecoveryCode,
      acknowledgeRecoveryCode,
      signup,
      login,
      resetPin,
      logout,
      refreshUser,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
