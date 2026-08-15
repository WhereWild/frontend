// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dimensions } from 'react-native';
import { getResponsive } from '@/constants/responsive';
import { cssLengthToPx } from '@/constants/tokenHelpers';
import { wdsResponsiveTokens } from '@/constants/wdsTokens';

const makePlatform = (overrides: Partial<typeof import('react-native').Platform> & { OS: string }) => {
  const select = overrides.select ?? ((map: any) => map?.[overrides.OS] ?? map?.default);
  return { ...overrides, select } as typeof import('react-native').Platform;
};

describe('responsive factory', () => {
  it('selects desktop when width exceeds tablet threshold', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 10_000 });
    const result = getResponsive({ platform, windowWidth: byDevice.tablet.maxDeviceWidth + 1 });
    expect(result.breakpoint).toBe('desktop');
  });

  it('selects phone when width is below the phone threshold', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 2000 });
    const narrowWidth = byDevice.phone.maxDeviceWidth - 1;

    const result = getResponsive({ platform, windowWidth: narrowWidth });
    expect(result.breakpoint).toBe('phone');
  });

  it('selects tablet when width is between phone and tablet thresholds', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 2000 });
    const widthBetweenPhoneAndTablet = (byDevice.phone.maxDeviceWidth + byDevice.tablet.maxDeviceWidth) / 2;

    const result = getResponsive({ platform, windowWidth: widthBetweenPhoneAndTablet });
    expect(result.breakpoint).toBe('tablet');
  });

  it('uses width-only breakpoints regardless of platform', () => {
    const iosPlatform = makePlatform({ OS: 'ios', isPad: false });
    const webPlatform = makePlatform({ OS: 'web' });

    const wideOnIos = getResponsive({ platform: iosPlatform, windowWidth: 5000 });
    const wideOnWeb = getResponsive({ platform: webPlatform, windowWidth: 5000 });

    expect(wideOnIos.breakpoint).toBe('desktop');
    expect(wideOnWeb.breakpoint).toBe('desktop');
  });

  it('reports runtime from platform only (web vs app)', () => {
    const webPlatform = makePlatform({ OS: 'web' });
    const iosPlatform = makePlatform({ OS: 'ios' });

    const webResult = getResponsive({ platform: webPlatform, windowWidth: 800 });
    const appResult = getResponsive({ platform: iosPlatform, windowWidth: 800 });

    expect(webResult.runtime).toBe('web');
    expect(appResult.runtime).toBe('app');
    expect(webResult.platformOS).toBe('web');
    expect(appResult.platformOS).toBe('ios');
  });

  it('includes a phone bucket from synced responsive tokens', () => {
    const platform = makePlatform({ OS: 'web' });
    const result = getResponsive({ platform, windowWidth: 800 });
    const expectedPhoneGap = cssLengthToPx(wdsResponsiveTokens.phone['wds-responsive-top-level-gap']);
    const expectedTabletGap = cssLengthToPx(wdsResponsiveTokens.tablet['wds-responsive-top-level-gap']);
    const expectedDesktopGap = cssLengthToPx(wdsResponsiveTokens.desktop['wds-responsive-top-level-gap']);

    expect(result.byDevice.phone).toBeDefined();
    expect(result.byDevice.phone.device).toBe('phone');
    expect(result.byDevice.phone.gap).toBe(expectedPhoneGap);
    expect(result.byDevice.phone.maxDeviceWidth).toBeGreaterThan(0);
    expect(result.byDevice.phone.maxDeviceWidth).toBeLessThanOrEqual(result.byDevice.tablet.maxDeviceWidth);
    expect(result.byDevice.tablet.gap).toBe(expectedTabletGap);
    expect(result.byDevice.desktop.gap).toBe(expectedDesktopGap);

    const phoneMaxWidth = result.byDevice.phone.maxDeviceWidth;
    const widthWithinPhone = phoneMaxWidth - 1;
    const phoneResult = getResponsive({ platform, windowWidth: widthWithinPhone });
    expect(phoneResult.breakpoint).toBe('phone');
    expect(phoneResult.gap).toBe(phoneResult.byDevice.phone.gap);
    expect(phoneResult.gapByDevice.phone).toBe(phoneResult.byDevice.phone.gap);

    const widthWithinTablet = phoneResult.byDevice.phone.maxDeviceWidth + 1;
    const tabletResult = getResponsive({ platform, windowWidth: widthWithinTablet });
    expect(tabletResult.breakpoint).toBe('tablet');
    expect(tabletResult.gap).toBe(expectedTabletGap);

    const widthWithinDesktop = tabletResult.byDevice.tablet.maxDeviceWidth + 1;
    const desktopResult = getResponsive({ platform, windowWidth: widthWithinDesktop });
    expect(desktopResult.breakpoint).toBe('desktop');
    expect(desktopResult.gap).toBe(expectedDesktopGap);

    expect(phoneResult.gap).not.toBe(tabletResult.gap);
    expect(tabletResult.gap).not.toBe(desktopResult.gap);
  });

  it('defaults to tablet (compact) when width is unavailable', () => {
    const platform = makePlatform({ OS: 'ios' });
    const result = getResponsive({ platform, windowWidth: Number.NaN });

    expect(result.breakpoint).toBe('tablet');
    expect(result.isKnownWidth).toBe(false);
    expect(result.runtime).toBe('app');
    expect(result.platformOS).toBe('ios');
    expect(result.byDevice.tablet.device).toBe('tablet');
  });

  it('falls back to the platform Dimensions API when no windowWidth is given', () => {
    // Omitting windowWidth doesn't exercise the true unknown-width fallback
    // in this test environment — RN's jest Dimensions mock reports a real
    // (tablet-range) width, same as it would on an actual device where
    // Dimensions.get('window') is available. The unknown-width fallback
    // itself (SSR, no window/Dimensions at all) is covered by the NaN case
    // above.
    const platform = makePlatform({ OS: 'ios' });
    const result = getResponsive({ platform });

    expect(result.breakpoint).toBe('tablet');
    expect(result.isKnownWidth).toBe(true);
    expect(result.runtime).toBe('app');
    expect(result.platformOS).toBe('ios');
    expect(result.byDevice.tablet.device).toBe('tablet');
  });

  it('defaults to tablet, not phone, when Dimensions reports width: 0 (the react-native-web SSR stub)', () => {
    // react-native-web's Dimensions module hardcodes {width: 0, height: 0}
    // and only ever updates it once canUseDOM is true — during SSR (no real
    // DOM in that Node process) this is exactly what Dimensions.get('window')
    // returns. 0 is a valid number, so without the width > 0 guard it sails
    // past the "unknown width" fallback and gets treated as an actual
    // (phone-sized) viewport — the real cause of the mobile-layout flash on
    // SSR page loads before hydration corrects it.
    const getSpy = jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 0, height: 0, scale: 1, fontScale: 1 });

    const platform = makePlatform({ OS: 'web' });
    const result = getResponsive({ platform });

    getSpy.mockRestore();

    expect(result.breakpoint).toBe('tablet');
    expect(result.isKnownWidth).toBe(false);
  });

  it('throws a clear error when a required responsive variant is missing', () => {
    const platform = makePlatform({ OS: 'web' });
    const originalPhoneTokens = (wdsResponsiveTokens as any).phone;

    try {
      delete (wdsResponsiveTokens as any).phone;

      expect(() => getResponsive({ platform, windowWidth: 320 })).toThrow(
        'Missing responsive tokens for variant: phone',
      );
    } finally {
      (wdsResponsiveTokens as any).phone = originalPhoneTokens;
    }
  });

  it('fails fast when platform OS is missing', () => {
    const platform = { OS: undefined, select: () => undefined } as any;

    expect(() => getResponsive({ platform, windowWidth: 320 })).toThrow(
      'Missing platform OS in getResponsive()',
    );
  });
});
