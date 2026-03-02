import {
  Colors,
  Responsive,
  Shadows,
  Size,
  SizeTokens,
  Time,
  TimeEasingCurves,
  TimeTokens,
  Typography,
  __themeTestHooks,
  getReactNativeEasing,
} from '@/constants/theme';
import { wdsSemanticTokens, wdsSizeTokens, wdsStyleTokens, wdsTimeTokens } from '@/constants/wdsTokens';

const REM_TO_PX = 16;

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
      const bodySmallLinkStyle = Typography.light.bodySmallLink;

      expect(bodyStyle.fontFamily).toBe('Inter_400Regular');
      expect(bodyStyle.fontSize).toBe(Responsive.rootFontSize);
      expect(bodyStyle.lineHeight).toBeCloseTo(Responsive.rootFontSize * 1.4);
      expect(bodyStyle.color).toBe(Colors.light.text.default.default);
      expect(bodySmallLinkStyle.fontFamily).toBe('Inter_400Regular');
      expect(bodySmallLinkStyle.color).toBe(Colors.light.text.brand.default);
      expect(Typography.light.bodySmallLink.textDecorationLine).toBe('underline');
      expect(Typography.light.bodySmallLink.textDecorationColor).toBe('transparent');
      expect(Typography.light.link.textDecorationLine).toBe('underline');
      expect(Typography.light.link.textDecorationColor).toBe('transparent');
      expect(Typography.dark.bodySmallLink.textDecorationLine).toBe('underline');
      expect(Typography.dark.bodySmallLink.textDecorationColor).toBe('transparent');
      expect(Typography.dark.link.textDecorationLine).toBe('underline');
      expect(Typography.dark.link.textDecorationColor).toBe('transparent');
      expect(Typography.dark.bodySmallLink.color).toBe(Colors.dark.text.brand.default);
      expect(Typography.dark.link.color).toBe(Colors.dark.text.brand.default);
    });

    it('falls back to System font and default line height when mapping is missing', () => {
      expect(__themeTestHooks).toBeDefined();
      const { parseFontShorthand, getExpoFontName } = __themeTestHooks!;

      const style = parseFontShorthand('normal 500 1rem "unknown", serif', 'unknown' as never);

      expect(style.fontFamily).toBe('System');
      expect(style.lineHeight).toBeCloseTo(19.2); // 16px * 1.2 default ratio
      expect(getExpoFontName('"unknown", serif', '500')).toBe('System');
    });

    it('exports a Typography entry for every synced wds-font token', () => {
      // Skip utility font tokens (e.g. component notes) since they are not exposed via the Typography API.
      const fontTokenKeys = Object.keys(wdsStyleTokens).filter(
        (tokenKey) => tokenKey.startsWith('wds-font-') && !tokenKey.startsWith('wds-font-utilities-'),
      );

      const toTokenName = (typographyKey: string) => {
        if (typographyKey === 'body') return 'wds-font-body-base';
        if (typographyKey === 'singleLineBody') return 'wds-font-single-line-body-base';
        if (typographyKey === 'link') return 'wds-font-body-link';
        if (typographyKey === 'code') return 'wds-font-body-code';

        const kebab = typographyKey
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase();
        return `wds-font-${kebab}`;
      };

      const typographyLightKeys = Object.keys(Typography.light);
      const typographyDarkKeys = Object.keys(Typography.dark);
      expect(typographyLightKeys.sort()).toEqual(typographyDarkKeys.sort());

      const derivedTokenKeys = typographyLightKeys.map(toTokenName);

      const missingInTokens = derivedTokenKeys.filter((tokenKey) => !fontTokenKeys.includes(tokenKey));
      const missingInTypography = fontTokenKeys.filter((tokenKey) => !derivedTokenKeys.includes(tokenKey));

      expect(missingInTokens).toEqual([]);
      expect(missingInTypography).toEqual([]);
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
      expect(Size.bar).toBeDefined();
      expect(Size.bar.height).toBeDefined();
      expect(Size.control).toBeDefined();
      expect(Size.control.dimension).toBeDefined();
      expect(Size.control.height).toBeDefined();
      expect(Size.control.width).toBeDefined();
    });

    it('has space tokens with numeric keys', () => {
      expect(Size.space['0']).toBe(0);
      expect(Size.space['200']).toBe(8);
      expect(Size.space['300']).toBe(12);
      expect(Size.space['400']).toBe(16);
      expect(Size.space['600']).toBe(24);
      expect(Size.space['800']).toBe(32);
    });

    it('nests text spacing tokens under space.text', () => {
      expect(Size.space.text.line).toBe(parseFloat(wdsSizeTokens['wds-size-space-text-line']) * REM_TO_PX);
      expect(Size.space.text.paragraph).toBe(parseFloat(wdsSizeTokens['wds-size-space-text-paragraph']) * REM_TO_PX);
      expect(Size.space.text.section).toBe(parseFloat(wdsSizeTokens['wds-size-space-text-section']) * REM_TO_PX);
      expect(Size.space.text.subsection).toBe(parseFloat(wdsSizeTokens['wds-size-space-text-subsection']) * REM_TO_PX);
      expect((Size.space as Record<string, unknown>)['text-line']).toBeUndefined();
      expect((Size.space as Record<string, unknown>).textLine).toBeUndefined();
    });

    it('converts rem to pixels correctly (16px base)', () => {
      // 0.5rem = 8px
      expect(Size.space['200']).toBe(8);
      // 0.75rem = 12px
      expect(Size.space['300']).toBe(12);
      // 1rem = 16px
      expect(Size.space['400']).toBe(16);
      // 1.5rem = 24px
      expect(Size.space['600']).toBe(24);
    });

    it('has radius tokens', () => {
      expect(Size.radius['100']).toBe(4);
      expect(Size.radius['200']).toBe(8);
      expect(Size.radius['400']).toBe(16);
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
      expect(Size.stroke['focus-ring']).toBeGreaterThan(0);
      expect(Size.stroke.focusRing).toBe(Size.stroke['focus-ring']);
    });

    it('exports new non-numeric size token families', () => {
      expect(Size.bar.height.short).toBe(parseFloat(wdsSizeTokens['wds-size-bar-height-short']) * REM_TO_PX);
      expect(Size.bar.height.tall).toBe(parseFloat(wdsSizeTokens['wds-size-bar-height-tall']) * REM_TO_PX);

      expect(Size.control.dimension.small).toBe(parseFloat(wdsSizeTokens['wds-size-control-dimension-small']) * REM_TO_PX);
      expect(Size.control.dimension.medium).toBe(parseFloat(wdsSizeTokens['wds-size-control-dimension-medium']) * REM_TO_PX);
      expect(Size.control.dimension.large).toBe(parseFloat(wdsSizeTokens['wds-size-control-dimension-large']) * REM_TO_PX);

      expect(Size.control.height.short).toBe(parseFloat(wdsSizeTokens['wds-size-control-height-short']) * REM_TO_PX);
      expect(Size.control.width.wide).toBe(parseFloat(wdsSizeTokens['wds-size-control-width-wide']) * REM_TO_PX);
    });

    it('has depth tokens for shadows', () => {
      expect(Size.depth).toBeDefined();
      expect(Size.depth['0']).toBe(0);
    });

    it('exports numbers not strings', () => {
      expect(typeof Size.space['200']).toBe('number');
      expect(typeof Size.radius['200']).toBe('number');
      expect(typeof Size.stroke.border).toBe('number');
    });

    it('derives values directly from the size tokens map', () => {
      expect(Size.space['400']).toBe(parseFloat(wdsSizeTokens['wds-size-space-400']) * REM_TO_PX);
      expect(Size.radius['200']).toBe(parseFloat(wdsSizeTokens['wds-size-radius-200']) * REM_TO_PX);
      expect(Size.depthNegative['negative-025']).toBe(
        parseFloat(wdsSizeTokens['wds-size-depth-negative-025']) * REM_TO_PX,
      );
    });

    it('exposes raw size token strings via SizeTokens', () => {
      expect(SizeTokens['wds-size-space-400']).toBe(wdsSizeTokens['wds-size-space-400']);
      expect(SizeTokens['wds-size-radius-200']).toBe(wdsSizeTokens['wds-size-radius-200']);
    });
  });

  describe('Responsive', () => {
    it('converts responsive rem tokens to pixel values', () => {
      expect(Responsive.contentWidth).toBeGreaterThan(0);
      expect(Responsive.textWidth).toBeGreaterThan(0);
      expect(Responsive.marginHorizontal).toBeGreaterThan(0);
    });
  });

  describe('Time', () => {
    it('exports grouped time tokens', () => {
      expect(Time).toBeDefined();
      expect(Time.duration).toBeDefined();
      expect(Time.easing).toBeDefined();
    });

    it('converts duration tokens to numeric values', () => {
      expect(Time.duration.instant).toBe(0);
      expect(Time.duration.short).toBe(100);
      expect(Time.duration.medium).toBe(200);
      expect(Time.duration.long).toBe(300);
      expect(Time.duration.deliberate).toBe(500);
    });

    it('exposes easing tokens as raw values', () => {
      expect(Time.easing.standard).toBe('[0.25, 0.1, 0.25, 1]');
      expect(Time.easing.linear).toBe('[0, 0, 1, 1]');
    });

    it('parses easing tokens into RN cubic-bezier control points', () => {
      expect(TimeEasingCurves.standard).toEqual([0.25, 0.1, 0.25, 1]);
      expect(TimeEasingCurves.linear).toEqual([0, 0, 1, 1]);
      expect(TimeEasingCurves.out).toEqual([0, 0, 0.58, 1]);
    });

    it('exports a React Native easing factory from token names', () => {
      const easingFn = getReactNativeEasing('standard');
      expect(typeof easingFn).toBe('function');
    });

    it('normalizes easing token formats and falls back on invalid values', () => {
      expect(__themeTestHooks).toBeDefined();
      const { parseEasingCurve } = __themeTestHooks!;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(parseEasingCurve('(0, 0, 0.58, 1)')).toEqual([0, 0, 0.58, 1]);
      expect(parseEasingCurve('[broken, value]')).toEqual([0.25, 0.1, 0.25, 1]);
      expect(parseEasingCurve('[1.2, 0.1, -0.2, 1]')).toEqual([0.25, 0.1, 0.25, 1]);

      expect(warnSpy).toHaveBeenCalledWith(
        '[theme] Invalid easing curve "[broken, value]". Falling back to default curve [0.25, 0.1, 0.25, 1].'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '[theme] Invalid easing curve "[1.2, 0.1, -0.2, 1]". Falling back to default curve [0.25, 0.1, 0.25, 1].'
      );
      warnSpy.mockRestore();
    });

    it('exposes raw time token strings via TimeTokens', () => {
      expect(TimeTokens['wds-time-duration-medium']).toBe(wdsTimeTokens['wds-time-duration-medium']);
      expect(TimeTokens['wds-time-easing-standard']).toBe(wdsTimeTokens['wds-time-easing-standard']);
    });
  });

  describe('Shadows', () => {
    it('exports parsed shadow tokens with style metadata', () => {
      const keys = Object.keys(Shadows).sort();
      expect(keys).toEqual(
        ['dropShadow100', 'dropShadow200', 'dropShadow300', 'dropShadow400', 'dropShadow500', 'dropShadow600'],
      );

      const token = Shadows.dropShadow300;
      expect(Array.isArray(token.layers)).toBe(true);
      expect(token.layers.length).toBeGreaterThan(0);
      expect(token.style.boxShadow).toBeDefined();
      expect(typeof token.style.elevation).toBe('number');
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
      expect(typeof Size.space['400']).toBe('number');

      // Typography should have valid font properties
      expect(typeof Typography.light.body.fontFamily).toBe('string');
      expect(typeof Typography.light.body.fontSize).toBe('number');
    });
  });
});
