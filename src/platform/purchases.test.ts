import { describe, expect, it } from 'vitest';
import { parseTrial } from './purchases';

describe('store free trial periods', () => {
  it('reads ISO 8601 periods from the store', () => {
    expect(parseTrial('P14D')).toEqual({ days: 14, label: '14 days' });
    expect(parseTrial('P1W')).toEqual({ days: 7, label: '7 days' });
    expect(parseTrial('P2W')).toEqual({ days: 14, label: '14 days' });
    expect(parseTrial('P1M')).toEqual({ days: 30, label: '1 month' });
  });
  it('ignores anything it does not understand', () => {
    expect(parseTrial('')).toBeUndefined();
    expect(parseTrial('P0D')).toBeUndefined();
    expect(parseTrial('14 days')).toBeUndefined();
  });
});
