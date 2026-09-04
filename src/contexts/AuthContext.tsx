import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { AuthContext } from './useAuth';
import { ADMIN_EMAIL_DOMAIN } from '../utils/auth';
import {
  ACTIVITY_WRITE_THROTTLE_MS,
  AUTH_MESSAGE_STORAGE_KEY,
  getRemainingSessionTime,
  INACTIVITY_MESSAGE,
  LAST_ACTIVITY_STORAGE_KEY,
  LEGACY_LOGIN_TIME_STORAGE_KEY,
  parseStoredTimestamp
} from '../utils/session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityWriteRef = useRef(0);

  const clearSessionTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const expireSession = useCallback(async () => {
    clearSessionTimer();
    sessionStorage.setItem(AUTH_MESSAGE_STORAGE_KEY, INACTIVITY_MESSAGE);
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    await firebaseSignOut(auth);
  }, [clearSessionTimer]);

  const scheduleSessionTimeout = useCallback((lastActivityAt: number) => {
    clearSessionTimer();
    const remaining = getRemainingSessionTime(lastActivityAt);
    if (remaining === 0) {
      void expireSession();
      return;
    }
    timeoutRef.current = setTimeout(() => void expireSession(), remaining);
  }, [clearSessionTimer, expireSession]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const storedActivity = parseStoredTimestamp(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        if (storedActivity && getRemainingSessionTime(storedActivity) === 0) {
          sessionStorage.setItem(AUTH_MESSAGE_STORAGE_KEY, INACTIVITY_MESSAGE);
          localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
          localStorage.removeItem(LEGACY_LOGIN_TIME_STORAGE_KEY);
          setUser(null);
          setLoading(false);
          void firebaseSignOut(auth);
          return;
        }
        const lastActivityAt = storedActivity ?? Date.now();
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, lastActivityAt.toString());
        localStorage.removeItem(LEGACY_LOGIN_TIME_STORAGE_KEY);
      } else {
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_LOGIN_TIME_STORAGE_KEY);
      }
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      clearSessionTimer();
      return;
    }

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastActivityWriteRef.current = now;
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, now.toString());
      scheduleSessionTimeout(now);
    };

    const checkStoredActivity = () => {
      const lastActivityAt = parseStoredTimestamp(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      if (!lastActivityAt) {
        recordActivity();
        return;
      }
      scheduleSessionTimeout(lastActivityAt);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_STORAGE_KEY) return;
      const lastActivityAt = parseStoredTimestamp(event.newValue);
      if (lastActivityAt) scheduleSessionTimeout(lastActivityAt);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkStoredActivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'touchstart',
      'scroll'
    ];

    checkStoredActivity();
    activityEvents.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearSessionTimer();
      activityEvents.forEach(eventName => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearSessionTimer, scheduleSessionTimeout, user]);

  const signInWithGoogle = useCallback(async () => {
    try {
      googleProvider.setCustomParameters({ hd: ADMIN_EMAIL_DOMAIN });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearSessionTimer();
      localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, [clearSessionTimer]);

  const value = useMemo(() => ({
    user,
    loading,
    signInWithGoogle,
    signOut
  }), [loading, signInWithGoogle, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
