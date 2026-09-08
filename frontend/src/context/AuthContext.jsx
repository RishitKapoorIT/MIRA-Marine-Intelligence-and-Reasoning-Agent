import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { checkHealth, AuthError, NetworkError } from '../services/http.js';
import * as authApi from '../services/auth.js';
import * as profileApi from '../services/profile.js';

/**
 * Authentication state, with the BACKEND as the single source of truth.
 *
 * WHAT CHANGED AND WHY IT MAY LOOK LIKE A REGRESSION
 *
 * The previous version treated a localStorage value as proof of login and, if
 * the backend was unreachable, invented a user ("Captain Ramanath K.") and
 * carried on. verifyOtp accepted "123456" client-side on any network failure,
 * which is an authentication bypass that ships in the production bundle.
 *
 * Now: /auth/me decides. If the backend is down the app SAYS SO instead of
 * appearing to work. That is a visible behaviour change and it is the point —
 * a marine safety app that looks logged in and serves invented data is worse
 * than one that admits it cannot reach the server.
 *
 * There is no token here. The session is an httpOnly cookie the browser sends
 * automatically; JavaScript cannot read it, which is why the old localStorage
 * bearer token is gone rather than relocated.
 */

const AuthContext = createContext(null);

export const AUTH_STATUS = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  UNREACHABLE: 'unreachable', // backend down — NOT the same as logged out
};

/**
 * Client-side only. The backend has no concept of a saved route: FR-E5 route
 * planning is Iteration 3 and /route is a reference page for judges. Kept in
 * localStorage so RoutePlanningPage and ProfilePage keep working, and named
 * so nobody mistakes it for server state.
 */
const SAFE_ROUTE_KEY = 'orca_safe_route_local';
const DEFAULT_SAFE_ROUTE = {
  origin: { id: 'port-mangalore', name: 'Mangalore Old Port (Bunder)', lat: 12.855, lon: 74.836, region: 'Karnataka' },
  destination: { id: 'port-malpe', name: 'Malpe Fisheries Harbor', lat: 13.348, lon: 74.701, region: 'Karnataka' },
  waypoint: null,
};

function readLocalSafeRoute() {
  try {
    const saved = localStorage.getItem(SAFE_ROUTE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SAFE_ROUTE;
  } catch {
    return DEFAULT_SAFE_ROUTE;
  }
}

/** Adds the snake_case aliases existing components already read, so Header,
 *  ProfilePage and ChatPage keep working unchanged. */
function decorate(profile) {
  if (!profile) return null;
  return {
    ...profile,
    preferred_language: profile.preferredLanguage,
    onboarding_completed: profile.onboardingCompleted,
    base_location: profile.baseLocation,
  };
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);
  const [user, setUser] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [devBypassActive, setDevBypassActive] = useState(false);
  const [appEnv, setAppEnv] = useState(null);
  const [safeRoute, setSafeRouteState] = useState(readLocalSafeRoute);

  /** Re-read session and profile from the backend. */
  const refresh = useCallback(async () => {
    try {
      const session = await authApi.getCurrentUser();
      if (!session) {
        setUser(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
        return null;
      }
      const profile = await profileApi.getProfile();
      const decorated = decorate(profile);
      setUser(decorated);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      setBackendError(null);
      return decorated;
    } catch (err) {
      if (err instanceof AuthError) {
        setUser(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
        return null;
      }
      // Network failure, 500, CORS. NOT a logout — say what actually happened.
      setUser(null);
      setStatus(AUTH_STATUS.UNREACHABLE);
      setBackendError(
        err instanceof NetworkError
          ? 'Cannot reach the ORCA backend.'
          : err.message || 'The ORCA backend returned an error.',
      );
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Health first: it tells us whether dev bypass is on, so the banner
      // states a fact instead of inferring one from a successful /auth/me.
      const health = await checkHealth();
      if (cancelled) return;
      setDevBypassActive(Boolean(health.dev_auth_bypass));
      setAppEnv(health.app_env || null);

      if (!health.online) {
        setStatus(AUTH_STATUS.UNREACHABLE);
        setBackendError(`Cannot reach the ORCA backend (${health.reason}).`);
        return;
      }
      await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, []);

  const updateProfile = useCallback(async (updates = {}) => {
    // Accepts both the old snake_case and the new camelCase call sites.
    const next = await profileApi.updateProfile({
      name: updates.name,
      preferredLanguage: updates.preferredLanguage ?? updates.preferred_language,
    });
    const decorated = decorate(next);
    setUser(decorated);
    return decorated;
  }, []);

  /** FR-H3.2 — consent is captured with the location, and the backend rejects
   *  the call without it. */
  const setBaseLocation = useCallback(async ({ lat, lon, label, consent }) => {
    const next = await profileApi.setBaseLocation({ lat, lon, label, consent });
    const decorated = decorate(next);
    setUser(decorated);
    return decorated;
  }, []);

  /** FR-H5.1 */
  const deleteBaseLocation = useCallback(async () => {
    const next = await profileApi.deleteBaseLocation();
    const decorated = decorate(next);
    setUser(decorated);
    return decorated;
  }, []);

  const setSafeRoute = useCallback((route) => {
    setSafeRouteState(route);
    try {
      localStorage.setItem(SAFE_ROUTE_KEY, JSON.stringify(route));
    } catch { /* private browsing */ }
  }, []);

  /**
   * Kept because ProfilePage calls it. It no longer fabricates a user.
   * With DEV_AUTH_BYPASS on, every request is already authenticated, so this
   * just re-reads the session. With it off there is nothing honest to do.
   */
  const loginAsDemo = useCallback(async () => {
    if (!devBypassActive) {
      throw new Error(
        'Demo login is unavailable. Enable DEV_AUTH_BYPASS on the backend, or sign in with a phone number.',
      );
    }
    return refresh();
  }, [devBypassActive, refresh]);

  /**
   * safeHouse is a VIEW of the real base location, not a separate concept.
   * Null when the user has not set one — deliberately not defaulted to
   * Mangalore, because silently answering for a port the user never chose is
   * the same class of error as the PFZ coverage gap. Callers must handle null.
   */
  const safeHouse = useMemo(() => {
    if (!user?.baseLocation) return null;
    return {
      lat: user.baseLocation.lat,
      lon: user.baseLocation.lon,
      label: user.baseLocation.label || 'Home port',
    };
  }, [user]);

  const value = useMemo(
    () => ({
      status,
      loading: status === AUTH_STATUS.LOADING,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED,
      isBackendUnreachable: status === AUTH_STATUS.UNREACHABLE,
      backendError,
      devBypassActive,
      appEnv,
      user,
      safeHouse,
      safeRoute,
      setSafeRoute,
      refresh,
      logout,
      updateProfile,
      setBaseLocation,
      deleteBaseLocation,
      loginAsDemo,
    }),
    [status, backendError, devBypassActive, appEnv, user, safeHouse, safeRoute,
     setSafeRoute, refresh, logout, updateProfile, setBaseLocation, deleteBaseLocation, loginAsDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}