import { buildShadows, parseShadowValue, splitShadowLayers, toReactNativeShadow } from '@/constants/shadowUtils';
import type { ShadowStyleTokens } from '@/constants/shadowUtils';
import { themeInternals } from '@/constants/theme';

describe('shadowUtils helpers', () => {
  const identity = (value: string) => value;
  const toNumber = (value: string) => parseFloat(value) || 0;

  it('splits shadow declarations without breaking nested parenthesis groups', () => {
    const resolver = (value: string) =>
      value.replace('var(--shadow)', 'rgba(20, 30, 40, 0.6)');
    const layers = splitShadowLayers(
      '0px 1px rgba(0, 0, 0, 0.2), 2px 3px var(--shadow)',
      resolver,
    );

    expect(layers).toEqual([
      '0px 1px rgba(0, 0, 0, 0.2)',
      '2px 3px rgba(20, 30, 40, 0.6)',
    ]);
  });

  it('parses shadow layers, converts lengths, and filters invalid entries', () => {
    const parsed = parseShadowValue(
      '1px 2px 3px 4px rgba(4, 8, 12, 0.25), 0px 0px 10px #102030aa, invalid-layer',
      identity,
      toNumber,
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      offsetX: 1,
      offsetY: 2,
      blurRadius: 3,
      spreadRadius: 4,
      color: 'rgba(4,8,12,1)',
      opacity: 0.25,
    });
    expect(parsed[1]).toMatchObject({
      color: '#102030',
    });
    expect(parsed[1].opacity).toBeCloseTo(170 / 255, 5);
  });

  it('pads missing blur and spread values with zeros', () => {
    const parsed = parseShadowValue('2px -4px rgba(0, 0, 0, 0.5)', identity, toNumber);

    expect(parsed[0]).toMatchObject({
      offsetX: 2,
      offsetY: -4,
      blurRadius: 0,
      spreadRadius: 0,
    });
  });

  it('normalizes rgba channel values to integers', () => {
    const parsed = parseShadowValue(
      '0px 0px rgba(12.8, 35.2, 255.9, 0.75)',
      identity,
      toNumber,
    );

    expect(parsed[0]).toMatchObject({
      color: 'rgba(12,35,255,1)',
      opacity: 0.75,
    });
  });

  it('falls back to the original color string when parsing formats it does not recognize', () => {
    const parsed = parseShadowValue('0px 0px hsla(120, 50%, 40%, 0.7)', identity, toNumber);

    expect(parsed[0]).toMatchObject({
      color: 'hsla(120, 50%, 40%, 0.7)',
      opacity: 1,
    });
  });

  it('translates parsed layers into React Native shadow styles', () => {
    expect(toReactNativeShadow([])).toEqual({ layers: [], style: {} });

    const shadow = toReactNativeShadow([
      {
        offsetX: 4,
        offsetY: 6,
        blurRadius: 8,
        spreadRadius: 0,
        color: '#000000',
        opacity: 0.5,
      },
      {
        offsetX: 2,
        offsetY: 2,
        blurRadius: 4,
        spreadRadius: 0,
        color: '#123456',
        opacity: 0.25,
      },
    ]);

    expect(shadow.layers).toHaveLength(2);
    expect(shadow.style).toMatchObject({
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 6 },
      shadowRadius: 8,
      shadowOpacity: 0.5,
      elevation: Math.max(1, Math.round((Math.abs(6) + 8) / 2)),
    });
  });

  it('builds React Native shadow tokens from WDS drop shadow definitions', () => {
    const { resolveCssVariables, cssLengthToPx, dropShadowTokens } = themeInternals;
    const shadows = buildShadows(dropShadowTokens, resolveCssVariables, cssLengthToPx);

    expect(Object.keys(shadows)).toEqual([
      'dropShadow100',
      'dropShadow200',
      'dropShadow300',
      'dropShadow400',
      'dropShadow500',
      'dropShadow600',
    ]);

    const dropShadow100 = shadows.dropShadow100;
    expect(dropShadow100.layers).toHaveLength(1);
    expect(dropShadow100.layers[0]).toMatchObject({
      offsetX: 0,
      offsetY: 1,
      blurRadius: 4,
      spreadRadius: 0,
      color: '#0c0c0d',
    });
    expect(dropShadow100.layers[0].opacity).toBeCloseTo(13 / 255, 5);
    expect(dropShadow100.style).toMatchObject({
      shadowColor: '#0c0c0d',
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 4,
      elevation: 3,
    });
    expect(dropShadow100.style.shadowOpacity).toBeCloseTo(13 / 255, 5);

    const dropShadow200 = shadows.dropShadow200;
    expect(dropShadow200.layers).toHaveLength(2);
    expect(dropShadow200.layers[1]).toMatchObject({
      offsetX: 0,
      offsetY: 1,
      blurRadius: 4,
      spreadRadius: 0,
      color: '#0c0c0d',
    });
    expect(dropShadow200.layers[1].opacity).toBeCloseTo(26 / 255, 5);

    const dropShadow600 = shadows.dropShadow600;
    expect(dropShadow600.layers).toEqual([
      {
        offsetX: 0,
        offsetY: 16,
        blurRadius: 32,
        spreadRadius: -8,
        color: '#0c0c0d',
        opacity: 102 / 255,
      },
    ]);
    expect(dropShadow600.style).toEqual({
      shadowColor: '#0c0c0d',
      shadowOffset: { width: 0, height: 16 },
      shadowRadius: 32,
      shadowOpacity: 102 / 255,
      elevation: 24,
    });
  });

  it('throws a descriptive error when a drop shadow token is missing', () => {
    const { resolveCssVariables, cssLengthToPx, dropShadowTokens } = themeInternals;
    const incompleteTokens: Partial<ShadowStyleTokens> = { ...dropShadowTokens };
    delete incompleteTokens['wds-effects-shadows-drop-shadow-300'];

    expect(() =>
      buildShadows(incompleteTokens as ShadowStyleTokens, resolveCssVariables, cssLengthToPx),
    ).toThrow('Missing drop shadow token: wds-effects-shadows-drop-shadow-300');
  });

  it('returns empty shadow data when parsing yields no valid layers', () => {
    const { resolveCssVariables, cssLengthToPx, dropShadowTokens } = themeInternals;
    const sparseTokens: ShadowStyleTokens = {
      ...dropShadowTokens,
      'wds-effects-shadows-drop-shadow-100': '1px 1px 1px',
    };

    const shadows = buildShadows(sparseTokens, resolveCssVariables, cssLengthToPx);

    expect(shadows.dropShadow100).toEqual({ layers: [], style: {} });
  });
});
