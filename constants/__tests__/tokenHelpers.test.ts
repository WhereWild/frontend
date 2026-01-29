import { cssLengthToPx, resolveCssVariables } from '@/constants/tokenHelpers';

describe('tokenHelpers', () => {
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
  });
});
