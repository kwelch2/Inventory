import { describe, expect, it } from 'vitest';
import {
  getRemainingSessionTime,
  INACTIVITY_TIMEOUT_MS,
  parseStoredTimestamp
} from './session';

describe('session timing', () => {
  it('uses a 24-hour inactivity window', () => {
    expect(INACTIVITY_TIMEOUT_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('returns the remaining time in the session', () => {
    expect(getRemainingSessionTime(1_000, 6_000, 10_000)).toBe(5_000);
  });

  it('never returns a negative remaining time', () => {
    expect(getRemainingSessionTime(1_000, 20_000, 10_000)).toBe(0);
  });

  it('rejects missing and malformed stored timestamps', () => {
    expect(parseStoredTimestamp(null)).toBeNull();
    expect(parseStoredTimestamp('not-a-number')).toBeNull();
    expect(parseStoredTimestamp('-1')).toBeNull();
    expect(parseStoredTimestamp('1234')).toBe(1234);
  });
});
