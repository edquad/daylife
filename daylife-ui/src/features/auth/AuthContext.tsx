import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User, HouseholdInfo } from '../../lib/api';
import { loadData, resolveHouseholdType } from '../../lib/storage';
import type { SetupPayload } from '../../lib/household';

interface AuthContextType {
  user: User | null;
  members: User[];
  household: HouseholdInfo | null;
  setupComplete: boolean;
  setupHousehold: (payload: SetupPayload) => Promise<void>;
  loginAs: (userId: string) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  logout: () => void;
  resetForNewSignup: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshHousehold = () => {
    const data = loadData();
    setMembers(data.users);
    setSetupComplete(data.setupComplete);
    if (data.setupComplete) {
      setHousehold({
        householdType: resolveHouseholdType(data),
        householdName: data.householdName,
        members: data.users,
      });
    }
  };

  useEffect(() => {
    refreshHousehold();
    const savedToken = api.getToken();
    if (savedToken) {
      api.get<User>('/auth/me')
        .then(setUser)
        .catch(() => api.setToken(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const setupHousehold = async (payload: SetupPayload) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', payload);
    api.setToken(res.token);
    setUser(res.user);
    refreshHousehold();
  };

  const loginAs = async (userId: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { userId });
    api.setToken(res.token);
    setUser(res.user);
  };

  const switchUser = loginAs;

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const resetForNewSignup = () => {
    localStorage.removeItem('daylife_data');
    localStorage.removeItem('daylife_session');
    api.setToken(null);
    setUser(null);
    setMembers([]);
    setHousehold(null);
    setSetupComplete(false);
  };

  return (
    <AuthContext.Provider value={{
      user, members, household, setupComplete,
      setupHousehold, loginAs, switchUser, logout, resetForNewSignup, isLoading,
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
