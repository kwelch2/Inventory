import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { removeUndefinedFields } from './helpers';

describe('removeUndefinedFields', () => {
  it('cleans nested plain objects and arrays while preserving Firestore values and dates', () => {
    const sentinel = serverTimestamp();
    const timestamp = Timestamp.fromMillis(123456);
    const date = new Date('2030-01-01T00:00:00Z');
    const cleaned = removeUndefinedFields({
      updatedAt: sentinel,
      nested: { timestamp, date, missing: undefined },
      values: [undefined, { keep: 'value', missing: undefined }]
    });

    expect(cleaned.updatedAt).toBe(sentinel);
    expect(cleaned.nested.timestamp).toBe(timestamp);
    expect(cleaned.nested.date).toBe(date);
    expect(cleaned.nested).not.toHaveProperty('missing');
    expect(cleaned.values).toEqual([{ keep: 'value' }]);
  });
});
