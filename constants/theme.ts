/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { wdsSemanticTokens } from './wdsTokens';

export const Colors = {
  light: {
    text: wdsSemanticTokens.light['wds-color-text-default-default'],
    background: wdsSemanticTokens.light['wds-color-background-default-default'],
    tint: wdsSemanticTokens.light['wds-color-icon-brand-default'],
    icon: wdsSemanticTokens.light['wds-color-icon-default-secondary'],
    tabIconDefault: wdsSemanticTokens.light['wds-color-icon-default-secondary'],
    tabIconSelected: wdsSemanticTokens.light['wds-color-icon-brand-default'],
  },
  dark: {
    text: wdsSemanticTokens.dark['wds-color-text-default-default'],
    background: wdsSemanticTokens.dark['wds-color-background-default-default'],
    tint: wdsSemanticTokens.dark['wds-color-icon-brand-default'],
    icon: wdsSemanticTokens.dark['wds-color-icon-default-secondary'],
    tabIconDefault: wdsSemanticTokens.dark['wds-color-icon-default-secondary'],
    tabIconSelected: wdsSemanticTokens.dark['wds-color-icon-brand-default'],
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
