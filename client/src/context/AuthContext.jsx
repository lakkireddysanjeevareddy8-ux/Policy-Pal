import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import { translations } from '../i18n/translations.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('policypal_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('policypal_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('policypal_lang') || 'en';
  });
  const [loading, setLoading] = useState(true);

  // Set language preference
  const setLanguage = useCallback((lang) => {
    if (['en', 'te', 'hi'].includes(lang)) {
      setLanguageState(lang);
      localStorage.setItem('policypal_lang', lang);
    }
  }, []);

  // Sync token changes
  const saveSession = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('policypal_token', newToken);
    localStorage.setItem('policypal_user', JSON.stringify(newUser));
    if (newUser?.preferred_language) {
      setLanguage(newUser.preferred_language);
    }
  }, [setLanguage]);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('policypal_token');
    localStorage.removeItem('policypal_user');
  }, []);

  // Fetch current user if token exists on initial mount
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success && res.data?.data?.user) {
          setUser(res.data.data.user);
          localStorage.setItem('policypal_user', JSON.stringify(res.data.data.user));
          if (res.data.data.user.preferred_language) {
            setLanguageState(res.data.data.user.preferred_language);
          }
        }
      } catch (err) {
        console.warn('Failed to verify token on startup:', err.message);
        clearSession();
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token, clearSession]);

  // Auth actions
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success) {
      saveSession(res.data.data.token, res.data.data.user);
    }
    return res.data;
  };

  const loginWithDemo = async () => {
    return login('demo@policypal.app', 'Demo@12345');
  };

  const register = async (email, password, full_name, preferred_language = 'en') => {
    const res = await api.post('/auth/register', {
      email,
      password,
      full_name,
      preferred_language,
    });
    if (res.data?.success) {
      saveSession(res.data.data.token, res.data.data.user);
    }
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    } finally {
      clearSession();
    }
  };

  // Helper to translate key
  const t = (key) => {
    const currentDict = translations[language] || translations.en;
    return currentDict[key] || translations.en[key] || key;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        language,
        setLanguage,
        login,
        loginWithDemo,
        register,
        logout,
        t,
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
