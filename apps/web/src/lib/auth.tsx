"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Me, type SessionPayload, api, refreshSession, setAccessToken } from "./api";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  /** เรียกเมื่อล็อกอินสำเร็จ (ได้ access token แล้ว) */
  signedIn: (s: SessionPayload) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((s) => {
      if (cancelled) return;
      setUser(s?.user ?? null);
      setStatus(s ? "authenticated" : "anonymous");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedIn = useCallback((s: SessionPayload) => {
    setAccessToken(s.accessToken);
    setUser(s.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(() => ({ status, user, signedIn, logout }), [status, user, signedIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องอยู่ภายใน AuthProvider");
  return ctx;
}
