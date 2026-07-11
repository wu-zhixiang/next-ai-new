import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AdminSessionMode = 'remote';

export interface AdminSession {
  readonly operatorName: string;
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly mode: AdminSessionMode;
}

interface LoginInput {
  readonly operatorName: string;
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly mode: AdminSessionMode;
}

interface AuthContextValue {
  readonly session: AdminSession | null;
  readonly login: (input: LoginInput) => void;
  readonly logout: () => void;
}

const STORAGE_KEY = 'gpt-pay-admin-session';
const LOCAL_DEV_API_BASE_URL = '/admin-api';

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeApiBaseUrl(value: string): string {
  if (import.meta.env.DEV) {
    return LOCAL_DEV_API_BASE_URL;
  }
  return value.trim().replace(/\/$/, '');
}

function readStoredSession(): AdminSession | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed)) {
      return null;
    }

    const operatorName = typeof parsed.operatorName === 'string' ? parsed.operatorName : '';
    const apiBaseUrl = normalizeApiBaseUrl(typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : '');
    const token = typeof parsed.token === 'string' ? parsed.token : '';
    const mode = 'remote';

    if (!operatorName || !apiBaseUrl || !token) {
      return null;
    }

    return {
      operatorName,
      apiBaseUrl,
      token,
      mode,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());

  const login = useCallback((input: LoginInput): void => {
    const nextSession: AdminSession = {
      operatorName: input.operatorName.trim() || '管理员',
      apiBaseUrl: normalizeApiBaseUrl(input.apiBaseUrl),
      token: input.token.trim(),
      mode: input.mode,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback((): void => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    login,
    logout,
  }), [login, logout, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
