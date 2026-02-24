import { cssLengthToPx, cssTimeToMs, resolveCssVariables } from '@/constants/tokenHelpers';

describe('tokenHelpers', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('resolves known css variables and leaves unknown tokens intact', () => {
    expect(resolveCssVariables('var(--wds-size-space-400)')).toBe('1rem');
    expect(resolveCssVariables('var(--missing-token)')).toBe('--missing-token');
  });

  it('converts rem, px, numeric, zero, and junk strings to numbers', () => {
    expect(cssLengthToPx('1rem')).toBe(16);
    expect(cssLengthToPx('20px')).toBe(20);
    expect(cssLengthToPx('2.5')).toBe(2.5);
    expect(cssLengthToPx('0')).toBe(0);
    expect(cssLengthToPx('not-a-number')).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[tokenHelpers] Invalid numeric value "not-a-number" (resolved: "not-a-number"). Falling back to 0.'
    );
  });

  it('falls back and warns for invalid time values', () => {
    expect(cssTimeToMs('badms')).toBe(0);
    expect(cssTimeToMs('oops')).toBe(0);

    expect(warnSpy).toHaveBeenCalledWith(
      '[tokenHelpers] Invalid time value "badms" (resolved: "badms"). Falling back to 0.'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[tokenHelpers] Invalid time value "oops" (resolved: "oops"). Falling back to 0.'
    );
  });

  it('does not warn for valid length and time values', () => {
    expect(cssTimeToMs('100ms')).toBe(100);
    expect(cssTimeToMs('250')).toBe(250);
    expect(cssTimeToMs('0')).toBe(0);
    expect(cssLengthToPx('1rem')).toBe(16);
    expect(cssLengthToPx('20px')).toBe(20);
    expect(cssLengthToPx('2.5')).toBe(2.5);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
