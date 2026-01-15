import {
  buildShadows,
  dropShadowTokenNames,
  parseShadowValue,
  splitShadowLayers,
  toReactNativeShadow,
  type ShadowStyleTokens,
} from '@/constants/shadowUtils';

describe('shadowUtils', () => {
  const identity = (value: string) => value;
  const lengthResolver = (value: string) => parseFloat(value) || 0;

  const makeTokens = (override: Partial<ShadowStyleTokens> = {}) => {
    const baseValue = '0px 2px 4px rgba(0,0,0,0.25)';
    return dropShadowTokenNames.reduce((acc, name) => {
      acc[name] = override[name] ?? baseValue;
      return acc;
    }, {} as ShadowStyleTokens);
  };

  it('splits composite shadow strings without breaking rgba commas', () => {
    const layers = splitShadowLayers(
      '0 2px 4px rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.1)',
      identity,
    );

    expect(layers).toHaveLength(2);
    expect(layers[0]).toContain('rgba');
  });

  it('ignores stray commas when splitting layers', () => {
    const layers = splitShadowLayers(
      ', 0 1px 2px rgba(0,0,0,0.2), 1px 2px 3px rgba(0,0,0,0.3),',
      identity,
    );

    expect(layers).toEqual([
      '0 1px 2px rgba(0,0,0,0.2)',
      '1px 2px 3px rgba(0,0,0,0.3)',
    ]);
  });

  it('parses shadow values into numeric layers, resolving hex alpha colors', () => {
    const layers = parseShadowValue('0px 1px 2px #00000033', identity, lengthResolver);

    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({
      offsetY: 1,
      blurRadius: 2,
      color: '#000000',
    });
    expect(layers[0].opacity).toBeCloseTo(0.2, 2);
  });

  it('normalizes rgba colors by dropping inline whitespace and exposing opacity', () => {
    const layers = parseShadowValue('0px 4px 8px rgba(10, 20, 30, 0.5)', identity, lengthResolver);

    expect(layers[0].color).toBe('rgba(10,20,30,1)');
    expect(layers[0].opacity).toBeCloseTo(0.5);
  });

  it('handles invalid rgba channel numbers and opacity fallbacks', () => {
    const layers = parseShadowValue('0px 2px 4px rgba(foo, bar, baz, 0)', identity, lengthResolver);

    expect(layers[0].color).toBe('rgba(0,0,0,1)');
    expect(layers[0].opacity).toBe(1);
  });

  it('fills missing rgba channels and alpha with defaults', () => {
    const layers = parseShadowValue('0px 2px 4px rgba(5, 10)', identity, lengthResolver);

    expect(layers[0].color).toBe('rgba(5,10,0,1)');
    expect(layers[0].opacity).toBe(1);
  });

  it('supports rgb() values by defaulting alpha to 1', () => {
    const layers = parseShadowValue('0px 2px 4px rgb(1, 2, 3)', identity, lengthResolver);

    expect(layers[0].color).toBe('rgba(1,2,3,1)');
    expect(layers[0].opacity).toBe(1);
  });

  it('falls back to defaults when rgba parts are missing entirely', () => {
    // malformed rgba string produces empty parts and triggers defaults
    const layers = parseShadowValue('0px 1px 2px rgba( , , , )', identity, lengthResolver);

    expect(layers[0].color).toBe('rgba(0,0,0,1)');
    expect(layers[0].opacity).toBe(1);
  });

  it('falls back to the raw color when the format is unsupported', () => {
    const layers = parseShadowValue('0px 3px 6px hsla(0, 0%, 0%, 0.5)', identity, lengthResolver);

    expect(layers[0].color).toBe('hsla(0, 0%, 0%, 0.5)');
    expect(layers[0].opacity).toBe(1);
  });

  it('drops layers that are missing a color definition', () => {
    expect(parseShadowValue('0px 1px 2px', identity, lengthResolver)).toHaveLength(0);
  });

  it('defaults numeric properties to zero when the resolver omits values', () => {
    const customResolver = () => undefined as unknown as number;
    const layers = parseShadowValue('0px 3px 6px #000000ff', identity, customResolver);

    expect(layers[0]).toMatchObject({ offsetX: 0, offsetY: 0, blurRadius: 0, spreadRadius: 0 });
  });

  it('converts layers into boxShadow strings, picking the strongest layer for elevation', () => {
    const token = toReactNativeShadow([
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0, color: '#111111', opacity: 0.2 },
      { offsetX: 0, offsetY: 4, blurRadius: 8, spreadRadius: 0, color: '#222222', opacity: 0.4 },
    ]);

    expect(token.style.boxShadow).toContain('rgba(34,34,34,0.4)');
    expect(token.style.boxShadow).toContain('8px');
    expect(token.style.elevation).toBeGreaterThan(1);
  });

  it('keeps the first layer when later layers are weaker', () => {
    const token = toReactNativeShadow([
      { offsetX: 0, offsetY: 6, blurRadius: 10, spreadRadius: 0, color: '#aaa', opacity: 0.6 },
      { offsetX: 0, offsetY: 1, blurRadius: 1, spreadRadius: 0, color: '#bbb', opacity: 0.2 },
    ]);

    expect(token.style.boxShadow).toContain('rgba(170,170,170,0.6)');
    expect(token.style.boxShadow).toContain('10px');
  });

  it('returns an empty style object when no layers exist', () => {
    expect(toReactNativeShadow([]).style).toEqual({});
  });

  it('floors elevation to at least 1 for tiny shadows', () => {
    const token = toReactNativeShadow([
      { offsetX: 0, offsetY: 0, blurRadius: 0.1, spreadRadius: 0, color: '#111111', opacity: 1 },
    ]);

    expect(token.style.elevation).toBe(1);
  });

  it('builds shadow tokens from the style map and throws when a token is missing', () => {
    const tokens = makeTokens();
    const shadows = buildShadows(tokens, identity, lengthResolver);

    expect(shadows.dropShadow100.layers.length).toBeGreaterThan(0);

    tokens['wds-effects-shadows-drop-shadow-300'] = '';
    expect(() => buildShadows(tokens, identity, lengthResolver)).toThrow(
      'Missing drop shadow token: wds-effects-shadows-drop-shadow-300',
    );
  });
});
