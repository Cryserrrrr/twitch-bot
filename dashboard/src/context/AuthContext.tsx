import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, getToken, onUnauthorized, setToken } from "../lib/api";
import type { SessionUser } from "../lib/types";

interface AuthConfig {
  authEnabled: boolean;
  configured: boolean;
  channel: string;
  botConnected: boolean;
  botAccount: string | null;
}

interface AuthValue {
  user: SessionUser | null;
  config: AuthConfig | null;
  loading: boolean;
  signIn: (mode?: "signin" | "bot") => Promise<void>;
  signOut: () => void;
  acceptToken: (token: string) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await api.get<AuthConfig>("/auth/config"));
    } catch {
      setConfig(null);
    }
  }, []);

  const loadSession = useCallback(async (authEnabled = true) => {
    // With WEB_AUTH_ENABLED=false the bot hands out a synthetic session, so the
    // login screen must be skipped even though no token is stored.
    if (!getToken() && authEnabled) {
      setUser(null);
      return;
    }

    try {
      const { user: session } = await api.get<{ user: SessionUser }>("/auth/me");
      setUser(session);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let authEnabled = true;
      try {
        const loaded = await api.get<AuthConfig>("/auth/config");
        setConfig(loaded);
        authEnabled = loaded.authEnabled;
      } catch {
        setConfig(null);
      }

      await loadSession(authEnabled);
      setLoading(false);
    })();
  }, [loadSession]);

  // The API tells us when the signed session expired.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const signIn = useCallback(async (mode: "signin" | "bot" = "signin") => {
    const { url } = await api.get<{ url: string }>(`/auth/login?mode=${mode}`);
    window.location.href = url;
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const acceptToken = useCallback(
    async (token: string) => {
      setToken(token);
      await loadSession(true);
      await refreshConfig();
    },
    [loadSession, refreshConfig]
  );

  const value = useMemo(
    () => ({ user, config, loading, signIn, signOut, acceptToken, refreshConfig }),
    [user, config, loading, signIn, signOut, acceptToken, refreshConfig]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
