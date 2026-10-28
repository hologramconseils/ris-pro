import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from './authClient';

const AuthContext = createContext({});

// Compte connecté (cookie de session géré par RIS Pro), profil et crédits. `user` vaut null sans session.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const userId = useRef(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/profile', { credentials: 'same-origin' });
      if (response.ok) {
        setProfile(await response.json());
      } else {
        console.error('Failed to fetch profile');
      }
    } catch (err) {
      console.error('Erreur profile:', err);
    }
  }, []);

  const applyUser = useCallback(async (nextUser) => {
    userId.current = nextUser?.id || null;
    setUser(nextUser || null);
    if (nextUser) {
      await fetchProfile();
    } else {
      setProfile(null);
    }
  }, [fetchProfile]);

  // Au chargement du site : y a-t-il une session ouverte ?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await authApi.me();
      if (!cancelled) await applyUser(result.ok ? result.data.user : null);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [applyUser]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password);
    if (result.ok) await applyUser(result.data.user);
    return result;
  }, [applyUser]);

  // Connexion par le lien reçu après un paiement.
  const loginWithLink = useCallback(async (token) => {
    const result = await authApi.magic(token);
    if (result.ok) await applyUser(result.data.user);
    return result;
  }, [applyUser]);

  const logout = useCallback(async () => {
    await authApi.logout();
    await applyUser(null);
  }, [applyUser]);

  const refreshProfile = useCallback(async () => {
    if (userId.current) await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithLink, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
