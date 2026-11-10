import { describe, expect, it } from 'vitest';
import { isValidQuantity } from './stationNeeds';

describe('isValidQuantity', () => {
  it('accepts only whole numbers from 1 to 100,000', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(100000)).toBe(true);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(100001)).toBe(false);
    expect(isValidQuantity(Number.NaN)).toBe(false);
  });
});
