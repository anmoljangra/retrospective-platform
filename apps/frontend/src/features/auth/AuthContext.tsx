import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  apiClient,
  setAccessToken,
  getAccessToken,
} from '../../lib/api-client';
import type { RegisterInput, LoginInput, TenantRole } from '@retrospace/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface TenantMembershipInfo {
  id: string;
  tenantId: string;
  role: TenantRole;
  joinedAt: string;
  tenantName: string;
  tenantSlug: string;
}

interface AuthContextType {
  user: User | null;
  memberships: TenantMembershipInfo[];
  activeTenant: TenantMembershipInfo | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setActiveTenant: (tenant: TenantMembershipInfo | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<TenantMembershipInfo[]>([]);
  const [activeTenant, setActiveTenantState] = useState<TenantMembershipInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setActiveTenant = (tenant: TenantMembershipInfo | null) => {
    setActiveTenantState(tenant);
    if (tenant) {
      sessionStorage.setItem('retrospace_active_tenant_id', tenant.tenantId);
    } else {
      sessionStorage.removeItem('retrospace_active_tenant_id');
    }
  };

  const refreshUser = async () => {
    try {
      const data = await apiClient<{
        user: User;
        memberships: TenantMembershipInfo[];
      }>('/auth/me');

      setUser(data.user);
      setMemberships(data.memberships);

      // Restore active tenant from session storage or select first
      const savedTenantId = sessionStorage.getItem('retrospace_active_tenant_id');
      const found = data.memberships.find((m) => m.tenantId === savedTenantId);
      if (found) {
        setActiveTenantState(found);
      } else if (data.memberships.length > 0) {
        setActiveTenant(data.memberships[0]);
      } else {
        setActiveTenant(null);
      }
    } catch (err) {
      setUser(null);
      setMemberships([]);
      setActiveTenant(null);
      setAccessToken(null);
    }
  };

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      try {
        // Attempt session refresh via HTTP-only cookie
        const res = await apiClient<{ user: User; accessToken: string }>('/auth/refresh', {
          method: 'POST',
        });
        if (res?.accessToken) {
          setAccessToken(res.accessToken);
          await refreshUser();
        }
      } catch {
        // Not authenticated
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (input: LoginInput) => {
    const res = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    await refreshUser();
  };

  const register = async (input: RegisterInput) => {
    const res = await apiClient<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
      setMemberships([]);
      setActiveTenant(null);
      sessionStorage.removeItem('retrospace_active_tenant_id');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeTenant,
        isLoading,
        login,
        register,
        logout,
        setActiveTenant,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

