export const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = 'lastActivityAt';
export const LEGACY_LOGIN_TIME_STORAGE_KEY = 'loginTime';
export const AUTH_MESSAGE_STORAGE_KEY = 'authMessage';
export const INACTIVITY_MESSAGE = 'Your session expired after 24 hours of inactivity. Please sign in again.';

export const parseStoredTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};

export const getRemainingSessionTime = (
  lastActivityAt: number,
  now = Date.now(),
  timeoutMs = INACTIVITY_TIMEOUT_MS
): number => Math.max(0, timeoutMs - (now - lastActivityAt));
