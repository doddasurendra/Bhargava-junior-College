import { describe, expect, it } from 'vitest';
import { testOtpCode } from './testOtp';

const env = { TEST_OTP_NUMBERS: '+919000099102, +919000099103,not-a-number', TEST_OTP_CODE: '482915' };

describe('developer test OTP numbers', () => {
  it('returns the fixed code only for listed numbers', () => {
    expect(testOtpCode('+919000099102', env)).toBe('482915');
    expect(testOtpCode('+919000099103', env)).toBe('482915');
    expect(testOtpCode('+919000099104', env)).toBeNull();
    expect(testOtpCode('not-a-number', env)).toBeNull();
  });
  it('is off without a strong secret code', () => {
    expect(testOtpCode('+919000099102', { TEST_OTP_NUMBERS: env.TEST_OTP_NUMBERS })).toBeNull();
    for (const bad of ['123456', '000000', '999999', '12345', 'abcdef']) expect(testOtpCode('+919000099102', { ...env, TEST_OTP_CODE: bad })).toBeNull();
  });
  it('is off when no numbers are listed', () => {
    expect(testOtpCode('+919000099102', { TEST_OTP_CODE: '482915' })).toBeNull();
  });
});
