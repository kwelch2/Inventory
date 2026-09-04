import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import {
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_STORAGE_KEY
} from '../utils/session';

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  firebaseSignOut: vi.fn(async () => undefined),
  signInWithPopup: vi.fn(async () => undefined),
  setCustomParameters: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signOut: authMocks.firebaseSignOut,
  signInWithPopup: authMocks.signInWithPopup
}));

vi.mock('../config/firebase', () => ({
  auth: {},
  googleProvider: { setCustomParameters: authMocks.setCustomParameters }
}));

const Probe = () => {
  const { loading, user } = useAuth();
  return <div>{loading ? 'loading' : user?.email || 'signed out'}</div>;
};

describe('AuthProvider inactivity handling', () => {
  let authStateCallback: (user: User | null) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback: (user: User | null) => void) => {
      authStateCallback = callback;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extends the session when the user is active', () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => authStateCallback({ email: 'chief@gemfireems.org' } as User));

    act(() => {
      vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      window.dispatchEvent(new Event('pointerdown'));
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    });
    expect(authMocks.firebaseSignOut).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(11 * 60 * 60 * 1000 + 1));
    expect(authMocks.firebaseSignOut).toHaveBeenCalledOnce();
  });

  it('does not reset an expired activity timestamp during auth restoration', () => {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now() - INACTIVITY_TIMEOUT_MS - 1));
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => authStateCallback({ email: 'chief@gemfireems.org' } as User));

    expect(authMocks.firebaseSignOut).toHaveBeenCalledOnce();
  });
});
