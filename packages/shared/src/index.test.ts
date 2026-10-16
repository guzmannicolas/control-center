import { describe, expect, it } from 'vitest';
import { CheckOutcome, worstStatus } from './index.ts';

describe('worstStatus', () => {
  it('is ok when there is nothing to check', () => {
    expect(worstStatus([])).toBe('ok');
  });

  it('picks the most serious status', () => {
    expect(worstStatus(['ok', 'warn', 'ok'])).toBe('warn');
    expect(worstStatus(['warn', 'error'])).toBe('error');
    expect(worstStatus(['error', 'fail', 'warn'])).toBe('fail');
  });
});

describe('CheckOutcome', () => {
  it('fills in empty metrics', () => {
    expect(CheckOutcome.parse({ status: 'ok', message: 'fine' }).metrics).toEqual({});
  });

  it('rejects an unknown status', () => {
    expect(CheckOutcome.safeParse({ status: 'maybe', message: '' }).success).toBe(false);
  });
});
