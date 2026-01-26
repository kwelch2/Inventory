import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Set login timestamp when user logs in
      if (user) {
        const loginTime = Date.now();
        localStorage.setItem('loginTime', loginTime.toString());
      } else {
        localStorage.removeItem('loginTime');
      }
    });

    return unsubscribe;
  }, []);

  // Auto-logout after 12 hours of inactivity
  useEffect(() => {
    if (!user) return;

    const checkSessionTimeout = () => {
      const loginTime = localStorage.getItem('loginTime');
      if (loginTime) {
        const twelveHours = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
        const timeSinceLogin = Date.now() - parseInt(loginTime, 10);
        
        if (timeSinceLogin > twelveHours) {
          console.log('Session expired after 12 hours');
          firebaseSignOut(auth);
        }
      }
    };

    // Check immediately
    checkSessionTimeout();

    // Check every 5 minutes
    const interval = setInterval(checkSessionTimeout, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
