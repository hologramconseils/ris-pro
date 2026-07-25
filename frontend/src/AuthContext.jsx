import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useSession } from '@clerk/clerk-react';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { session, isLoaded: sessionLoaded } = useSession();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoaded && sessionLoaded) {
      if (clerkUser && session) {
        fetchProfile(session);
      } else {
        setProfile(null);
        setLoading(false);
      }
    }
  }, [userLoaded, sessionLoaded, clerkUser, session]);

  const fetchProfile = async (currentSession) => {
    try {
      const token = await currentSession.getToken();
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error("Failed to fetch profile");
      }
    } catch (err) {
      console.error("Erreur profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session) {
      console.log("Rafraîchissement manuel du profil pour:", clerkUser?.id);
      await fetchProfile(session);
    }
  };

  return (
    <AuthContext.Provider value={{ user: clerkUser, session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
