"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getAdminHeaders, resolveApiUrl } from "../lib/api-url";
import { fetchWithAuth } from "../lib/utils";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { email: string; accountType?: string; accountId?: string } | null;
  customerSegment: "b2c" | "b2b";
  hasB2BAccess: boolean;
  partner: { id: string; name: string; company_code: string } | null;
}

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, accountType?: string) => Promise<any>;
  loginWithGoogle: (credential: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: ApiFetch;
  adminFetch: ApiFetch;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const ACCESS_TOKEN_KEY = "voyr_access_token";
const REFRESH_TOKEN_KEY = "voyr_refresh_token";
const USER_KEY = "voyr_user";
const USER_ID_KEY = "voyr_user_id";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getStoredTokens() {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  // Extract userId from JWT payload and store it
  const payload = decodeJwtPayload(accessToken);
  if (payload?.sub && typeof payload.sub === "string") {
    localStorage.setItem(USER_ID_KEY, payload.sub);
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

function getStoredUser(): { email: string; accountType?: string; accountId?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("Corrupted user data in localStorage");
    return null;
  }
}

function storeUser(user: { email: string; accountType?: string; accountId?: string }) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function profileFetchWithToken(accessToken: string): ApiFetch {
  return (path, init = {}) =>
    fetch(resolveApiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers as Record<string, string>),
      },
    });
}

function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    customerSegment: "b2c",
    hasB2BAccess: false,
    partner: null,
  });

  const fetchProfile = useCallback(async (apiFetchFn: ApiFetch) => {
    try {
      const res = await apiFetchFn("/auth/me");
      if (!res.ok) return null;
      const body = (await res.json()) as {
        customer_segment?: "b2c" | "b2b";
        has_b2b_access?: boolean;
        partner?: { id: string; name: string; company_code: string } | null;
      };
      return {
        customerSegment: body.customer_segment ?? "b2c",
        hasB2BAccess: !!body.has_b2b_access,
        partner: body.partner ?? null,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { accessToken } = getStoredTokens();
      const user = getStoredUser();
      const userId = getStoredUserId();
      if (accessToken && user && userId) {
        const profile = await fetchProfile((path, init) =>
          fetchWithAuth(resolveApiUrl(path), init, async () => {
            const { refreshToken } = getStoredTokens();
            if (!refreshToken) throw new Error("No refresh token");
            const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!res.ok) throw new Error("Refresh failed");
            const { access_token } = await res.json();
            localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
          }),
        );
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          customerSegment: profile?.customerSegment ?? "b2c",
          hasB2BAccess: profile?.hasB2BAccess ?? false,
          partner: profile?.partner ?? null,
        });
      } else {
        if (accessToken && user) {
          const payload = decodeJwtPayload(accessToken);
          if (payload?.sub && typeof payload.sub === "string") {
            localStorage.setItem(USER_ID_KEY, payload.sub);
          }
        }
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          customerSegment: "b2c",
          hasB2BAccess: false,
          partner: null,
        });
      }
    };
    init();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Invalid credentials");
    }
    const { access_token, refresh_token } = await res.json();
    storeTokens(access_token, refresh_token);
    const payload = decodeJwtPayload(access_token);
    const accountType = (payload?.account_type as string) || undefined;
    const accountId = (payload?.account_id as string) || undefined;
    const userObj = { email, accountType, accountId };
    storeUser(userObj);
    const profile = await fetchProfile(profileFetchWithToken(access_token));
    setState({
      isAuthenticated: true,
      isLoading: false,
      user: userObj,
      customerSegment: profile?.customerSegment ?? "b2c",
      hasB2BAccess: profile?.hasB2BAccess ?? false,
      partner: profile?.partner ?? null,
    });
    return userObj;
  }, [fetchProfile]);

  const register = useCallback(async (email: string, password: string, accountType?: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, accountType }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Registration failed");
    }
    const { access_token, refresh_token } = await res.json();
    storeTokens(access_token, refresh_token);
    
    const payload = decodeJwtPayload(access_token);
    const resolvedAccountType = (payload?.account_type as string) || accountType || undefined;
    const resolvedAccountId = (payload?.account_id as string) || undefined;
    const userObj = { email, accountType: resolvedAccountType, accountId: resolvedAccountId };
    
    storeUser(userObj);
    const profile = await fetchProfile(profileFetchWithToken(access_token));
    setState({
      isAuthenticated: true,
      isLoading: false,
      user: userObj,
      customerSegment: profile?.customerSegment ?? "b2c",
      hasB2BAccess: profile?.hasB2BAccess ?? false,
      partner: profile?.partner ?? null,
    });
    return userObj;
  }, [fetchProfile]);


  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Google sign in failed");
    }
    const { access_token, refresh_token } = await res.json();
    storeTokens(access_token, refresh_token);
    
    // Extract email from payload
    const payload = decodeJwtPayload(access_token);
    const email = payload?.email as string || "user@gmail.com";
    
    storeUser({ email });
    const profile = await fetchProfile(profileFetchWithToken(access_token));
    setState({
      isAuthenticated: true,
      isLoading: false,
      user: { email },
      customerSegment: profile?.customerSegment ?? "b2c",
      hasB2BAccess: profile?.hasB2BAccess ?? false,
      partner: profile?.partner ?? null,
    });
  }, [fetchProfile]);

  const refreshAccessToken = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) {
      clearTokens();
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        customerSegment: "b2c",
        hasB2BAccess: false,
        partner: null,
      });
      throw new Error("No refresh token available");
    }
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        customerSegment: "b2c",
        hasB2BAccess: false,
        partner: null,
      });
      throw new Error("Session expired. Please log in again.");
    }
    const { access_token } = await res.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
    const payload = decodeJwtPayload(access_token);
    if (payload?.sub && typeof payload.sub === "string") {
      localStorage.setItem(USER_ID_KEY, payload.sub);
    }
  }, []);

  const apiFetch = useCallback<ApiFetch>(
    (path, init = {}) => fetchWithAuth(resolveApiUrl(path), init, refreshAccessToken),
    [refreshAccessToken],
  );

  const refreshProfile = useCallback(async () => {
    const profile = await fetchProfile(apiFetch);
    if (profile) {
      setState((prev) => ({
        ...prev,
        customerSegment: profile.customerSegment,
        hasB2BAccess: profile.hasB2BAccess,
        partner: profile.partner,
      }));
    }
  }, [apiFetch, fetchProfile]);

  const adminFetch = useCallback<ApiFetch>(
    (path, init = {}) => {
      const headers = {
        ...getAdminHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      };
      return apiFetch(path, { ...init, headers });
    },
    [apiFetch],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (err) {
        console.error("Failed to revoke refresh token", err);
      }
    }
    clearTokens();
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      customerSegment: "b2c",
      hasB2BAccess: false,
      partner: null,
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      loginWithGoogle,
      refreshAccessToken,
      refreshProfile,
      logout,
      apiFetch,
      adminFetch,
    }),
    [state, login, register, loginWithGoogle, refreshAccessToken, refreshProfile, logout, apiFetch, adminFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/** Authenticated API client bound to the current session. */
export function useApi() {
  const { apiFetch, adminFetch } = useAuth();
  return { apiFetch, adminFetch };
}
