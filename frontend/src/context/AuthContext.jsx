import React, { createContext, useContext, useState, useEffect } from 'react';

const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || 'http://localhost:8001';

const AuthContext = createContext(null);

const DEFAULT_SAFE_HOUSE = {
  lat: 12.8698,
  lon: 74.8431,
  label: 'Mangalore Old Port (Bunder)',
};

const DEFAULT_SAFE_ROUTE = {
  origin: { id: 'port-mangalore', name: 'Mangalore Old Port (Bunder)', lat: 12.855, lon: 74.836, region: 'Karnataka' },
  destination: { id: 'port-malpe', name: 'Malpe Fisheries Harbor', lat: 13.348, lon: 74.701, region: 'Karnataka' },
  waypoint: null,
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('orca_auth_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and load user profile if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${AUTH_API_BASE}/api/v1/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          // Token invalid or expired
          localStorage.removeItem('orca_auth_token');
          setToken('');
          setUser(null);
        }
      } catch (err) {
        console.warn('Auth backend offline, checking dev token', err);
        if (token === 'demo-token' || token === 'dev-token') {
          setUser({
            id: 'demo-captain-1',
            name: 'Captain Ramanath K.',
            phone: '+91 98450 12345',
            safe_house: DEFAULT_SAFE_HOUSE,
            safe_route: DEFAULT_SAFE_ROUTE,
            aadhaar: '',
            preferred_language: localStorage.getItem('orca_language') || 'en',
            onboarding_completed: true,
          });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const loginAsDemo = async () => {
    const demoUser = {
      id: 'demo-captain-1',
      name: 'Captain Ramanath K.',
      phone: '+91 98450 12345',
      safe_house: DEFAULT_SAFE_HOUSE,
      safe_route: DEFAULT_SAFE_ROUTE,
      aadhaar: '',
      preferred_language: localStorage.getItem('orca_language') || 'en',
      onboarding_completed: true,
    };
    setToken('demo-token');
    localStorage.setItem('orca_auth_token', 'demo-token');
    setUser(demoUser);
    return demoUser;
  };

  const requestOtp = async (phone) => {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return await res.json();
    } catch (err) {
      console.error('Request OTP failed', err);
      return { status: 'otp_sent', dev_otp: '123456', message: 'Offline dev mode' };
    }
  };

  const verifyOtp = async (phone, otp) => {
    try {
      const res = await fetch(`${AUTH_API_BASE}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'OTP verification failed');
      }

      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('orca_auth_token', data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      // Fallback dev login
      if (otp === '123456') {
        const isDemo = phone.includes('98450') || phone.includes('12345');
        const fallbackUser = {
          id: isDemo ? 'demo-user-1' : `dev-user-${Date.now()}`,
          phone,
          name: isDemo ? 'Captain Ramanath K.' : '',
          safe_house: DEFAULT_SAFE_HOUSE,
          safe_route: DEFAULT_SAFE_ROUTE,
          aadhaar: '',
          preferred_language: localStorage.getItem('orca_language') || 'en',
          onboarding_completed: isDemo,
        };
        setUser(fallbackUser);
        setToken(fallbackUser.id);
        localStorage.setItem('orca_auth_token', fallbackUser.id);
        return { 
          status: 'authenticated', 
          token: fallbackUser.id, 
          is_new_user: !fallbackUser.onboarding_completed, 
          user: fallbackUser 
        };
      }
      throw err;
    }
  };

  const updateProfile = async (updates) => {
    if (token && token !== 'dev-token') {
      try {
        const res = await fetch(`${AUTH_API_BASE}/api/v1/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          return data.user;
        }
      } catch (err) {
        console.error('Failed to update profile on backend', err);
      }
    }

    // Local update
    setUser(prev => ({
      ...prev,
      ...updates,
      safe_house: updates.safe_house || prev?.safe_house || DEFAULT_SAFE_HOUSE,
      safe_route: updates.safe_route || prev?.safe_route || DEFAULT_SAFE_ROUTE,
    }));
  };

  const logout = async () => {
    try {
      await fetch(`${AUTH_API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    setToken('');
    localStorage.removeItem('orca_auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: !!user,
        requestOtp,
        verifyOtp,
        loginAsDemo,
        updateProfile,
        logout,
        safeHouse: user?.safe_house || DEFAULT_SAFE_HOUSE,
        safeRoute: user?.safe_route || DEFAULT_SAFE_ROUTE,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
