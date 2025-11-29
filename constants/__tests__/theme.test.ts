import { Colors, Typography, Size, themeInternals } from '@/constants/theme';
import { wdsSemanticTokens, wdsSizeTokens } from '@/constants/wdsTokens';

describe('Theme Tokens', () => {
  describe('Colors', () => {
    it('exports Colors with light and dark modes', () => {
      expect(Colors).toBeDefined();
      expect(Colors.light).toBeDefined();
      expect(Colors.dark).toBeDefined();
    });

    it('has background tokens for all variants', () => {
      // Validate colors are defined and are valid hex colors
      expect(Colors.light.background.brand.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.neutral.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.danger.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.default.default).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.background.brand.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.neutral.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.danger.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.default.default).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('has text tokens for all variants', () => {
      expect(Colors.light.text.brand.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.text.brand.onBrand).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.text.neutral.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.text.danger.default).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.text.brand.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.text.brand.onBrand).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.text.neutral.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.text.danger.default).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('has icon tokens for all variants', () => {
      expect(Colors.light.icon.brand.onBrand).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.icon.neutral.onNeutralSecondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.icon.danger.default).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.icon.brand.onBrand).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.icon.neutral.onNeutralSecondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.icon.danger.default).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('has border tokens', () => {
      expect(Colors.light.border.default.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.border.danger.default).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.border.default.default).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.border.danger.default).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('has interaction state tokens', () => {
      expect(Colors.light.background.brand.hover).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.brand.pressed).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.disabled.default).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.background.brand.hover).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.brand.pressed).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.disabled.default).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('has neutral tertiary tokens for subtle variants', () => {
      expect(Colors.light.background.neutral.tertiary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.neutral.tertiaryHover).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.light.background.neutral.tertiaryPressed).toMatch(/^#[0-9a-f]{6}$/i);

      expect(Colors.dark.background.neutral.tertiary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.neutral.tertiaryHover).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Colors.dark.background.neutral.tertiaryPressed).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('matches the underlying semantic token values', () => {
      expect(Colors.light.background.brand.default).toBe(
        wdsSemanticTokens.light['wds-color-background-brand-default'],
      );
      expect(Colors.dark.text.danger.onDanger).toBe(
        wdsSemanticTokens.dark['wds-color-text-danger-on-danger'],
      );
      expect(Colors.light.border.neutral.secondary).toBe(
        wdsSemanticTokens.light['wds-color-border-neutral-secondary'],
      );
    });
  });

  describe('Typography', () => {
    it('exports Typography with light and dark modes', () => {
      expect(Typography).toBeDefined();
      expect(Typography.light).toBeDefined();
      expect(Typography.dark).toBeDefined();
    });

    it('has body typography tokens', () => {
      expect(Typography.light.body).toBeDefined();
      expect(Typography.light.body.fontFamily).toBeDefined();
      expect(typeof Typography.light.body.fontFamily).toBe('string');
      expect(Typography.light.body.fontSize).toBeGreaterThan(0);
      expect(Typography.light.body.fontWeight).toBeDefined();

      expect(Typography.dark.body).toBeDefined();
      expect(Typography.dark.body.fontFamily).toBeDefined();
      expect(typeof Typography.dark.body.fontFamily).toBe('string');
      expect(Typography.dark.body.fontSize).toBeGreaterThan(0);
      expect(Typography.dark.body.fontWeight).toBeDefined();
    });

    it('has heading typography tokens', () => {
      expect(Typography.light.heading).toBeDefined();
      expect(Typography.dark.heading).toBeDefined();
    });

    it('has single line body tokens for buttons', () => {
      expect(Typography.light.singleLineBody).toBeDefined();
      expect(typeof Typography.light.singleLineBody.fontFamily).toBe('string');

      expect(Typography.dark.singleLineBody).toBeDefined();
      expect(typeof Typography.dark.singleLineBody.fontFamily).toBe('string');
    });

    it('has body typography with valid font sizes', () => {
      expect(Typography.light.body.fontSize).toBeDefined();
      expect(Typography.light.body.fontSize).toBeGreaterThan(0);

      expect(Typography.dark.body.fontSize).toBeDefined();
      expect(Typography.dark.body.fontSize).toBeGreaterThan(0);
    });

    it('exports valid React Native style objects', () => {
      // Typography should have React Native compatible properties
      const bodyStyle = Typography.light.body;
      expect(bodyStyle).toHaveProperty('fontFamily');
      expect(bodyStyle).toHaveProperty('fontSize');
      expect(bodyStyle).toHaveProperty('fontWeight');
      
      // Should not have web-only properties
      expect(bodyStyle).not.toHaveProperty('font');
    });

    it('converts CSS shorthands into Expo font metadata', () => {
      const bodyStyle = Typography.light.body;

      expect(bodyStyle.fontFamily).toBe('Inter_400Regular');
      expect(bodyStyle.fontSize).toBe(16);
      expect(bodyStyle.lineHeight).toBeCloseTo(22.4); // 16 * 1.4 line-height ratio
      expect(bodyStyle.color).toBe(Colors.light.text.default.default);
      expect(Typography.dark.link.color).toBe(Colors.dark.text.brand.default);
    });
  });

  describe('Size', () => {
    it('exports Size tokens with all categories', () => {
      expect(Size).toBeDefined();
      expect(Size.space).toBeDefined();
      expect(Size.radius).toBeDefined();
      expect(Size.icon).toBeDefined();
      expect(Size.depth).toBeDefined();
      expect(Size.stroke).toBeDefined();
      expect(Size.blur).toBeDefined();
    });

    it('has space tokens with numeric keys', () => {
      expect(Size.space[0]).toBe(0);
      expect(Size.space[200]).toBe(8);
      expect(Size.space[300]).toBe(12);
      expect(Size.space[400]).toBe(16);
      expect(Size.space[600]).toBe(24);
      expect(Size.space[800]).toBe(32);
    });

    it('converts rem to pixels correctly (16px base)', () => {
      // 0.5rem = 8px
      expect(Size.space[200]).toBe(8);
      // 0.75rem = 12px
      expect(Size.space[300]).toBe(12);
      // 1rem = 16px
      expect(Size.space[400]).toBe(16);
      // 1.5rem = 24px
      expect(Size.space[600]).toBe(24);
    });

    it('has radius tokens', () => {
      expect(Size.radius[100]).toBe(4);
      expect(Size.radius[200]).toBe(8);
      expect(Size.radius[400]).toBe(16);
    });

    it('has icon size tokens', () => {
      expect(Size.icon).toBeDefined();
      expect(Object.keys(Size.icon).length).toBeGreaterThan(0);
      // Icon tokens use descriptive keys like 'small', 'medium', 'large'
      const firstIconValue = Object.values(Size.icon)[0];
      expect(typeof firstIconValue).toBe('number');
      expect(firstIconValue).toBeGreaterThan(0);
    });

    it('has stroke tokens', () => {
      expect(Size.stroke.border).toBe(1);
      // Stroke tokens may use hyphenated keys like 'focus-ring'
      expect(Size.stroke['focus-ring'] ?? Size.stroke.focusRing).toBeGreaterThan(0);
    });

    it('has depth tokens for shadows', () => {
      expect(Size.depth).toBeDefined();
      expect(Size.depth[0]).toBe(0);
    });

    it('exports numbers not strings', () => {
      expect(typeof Size.space[200]).toBe('number');
      expect(typeof Size.radius[200]).toBe('number');
      expect(typeof Size.stroke.border).toBe('number');
    });

    it('derives values directly from the size tokens map', () => {
      expect(Size.space[400]).toBe(parseFloat(wdsSizeTokens['wds-size-space-400']) * 16);
      expect(Size.radius[200]).toBe(parseFloat(wdsSizeTokens['wds-size-radius-200']) * 16);
      expect(Size.depthNegative['negative-025']).toBe(
        parseFloat(wdsSizeTokens['wds-size-depth-negative-025']) * 16,
      );
    });
  });

  describe('Token Structure Validation', () => {
    it('has consistent structure across light and dark modes', () => {
      const lightKeys = Object.keys(Colors.light);
      const darkKeys = Object.keys(Colors.dark);
      expect(lightKeys.sort()).toEqual(darkKeys.sort());
    });

    it('has matching typography structure in light and dark modes', () => {
      const lightTypographyKeys = Object.keys(Typography.light);
      const darkTypographyKeys = Object.keys(Typography.dark);
      expect(lightTypographyKeys.sort()).toEqual(darkTypographyKeys.sort());
    });

    it('exports tokens that are usable in React Native styles', () => {
      // This test validates that token values are compatible with React Native
      // Color tokens should be hex strings
      expect(Colors.light.background.brand.default).toMatch(/^#[0-9a-f]{6}$/i);
      
      // Size tokens should be numbers
      expect(typeof Size.space[400]).toBe('number');
      
      // Typography should have valid font properties
      expect(typeof Typography.light.body.fontFamily).toBe('string');
      expect(typeof Typography.light.body.fontSize).toBe('number');
    });
  });
});

describe('Theme internals', () => {
  const { resolveCssVariables, parseFontShorthand } = themeInternals;

  it('falls back to raw CSS variable names when a token is missing', () => {
    expect(resolveCssVariables('var(--wds-typography-body-size-medium)')).toBe('1rem');
    expect(resolveCssVariables('var(--missing-token)')).toBe('--missing-token');
  });

  it('parses shorthand fonts using default line-height and system font fallbacks', () => {
    const style = parseFontShorthand('italic 500 2rem var(--made-up-family)', 'unknown' as any);

    expect(style.fontSize).toBe(32);
    expect(style.lineHeight).toBeCloseTo(38.4); // 32 * fallback 1.2 ratio
    expect(style.fontFamily).toBe('System');
    expect(style.fontStyle).toBe('italic');
    expect(style.fontWeight).toBe('500');
  });
});
