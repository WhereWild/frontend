import { getResponsive } from '@/constants/responsive';

const makePlatform = (overrides: Partial<typeof import('react-native').Platform> & { OS: string }) => {
  const select = overrides.select ?? ((map: any) => map?.[overrides.OS] ?? map?.default);
  return { ...overrides, select } as typeof import('react-native').Platform;
};

describe('responsive factory', () => {
  it('selects tablet for iPad detection', () => {
    const platform = makePlatform({ OS: 'ios', isPad: true });
    const result = getResponsive({ platform });
    expect(result.breakpoint).toBe('tablet');
    expect(result.byDevice.tablet.device).toBe('tablet');
  });

  it('selects mobile for android', () => {
    const platform = makePlatform({ OS: 'android' });
    const result = getResponsive({ platform });
    expect(result.breakpoint).toBe('mobile');
  });

  it('selects desktop for web when width exceeds tablet threshold', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 10_000 });
    const result = getResponsive({ platform, windowWidth: byDevice.tablet.maxDeviceWidth + 1 });
    expect(result.breakpoint).toBe('desktop');
  });

  it('falls back to mobile when select returns undefined', () => {
    const platform = makePlatform({ OS: 'ios', select: () => undefined as any });
    const result = getResponsive({ platform });
    expect(result.breakpoint).toBe('mobile');
  });

  it('selects mobile on web when window width is below the mobile threshold', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 2000 });
    const narrowWidth = byDevice.mobile.maxDeviceWidth - 1;

    const result = getResponsive({ platform, windowWidth: narrowWidth });
    expect(result.breakpoint).toBe('mobile');
  });

  it('selects tablet on web when width is between mobile and tablet thresholds', () => {
    const platform = makePlatform({ OS: 'web' });
    const { byDevice } = getResponsive({ platform, windowWidth: 2000 });
    const widthBetweenMobileAndTablet = (byDevice.mobile.maxDeviceWidth + byDevice.tablet.maxDeviceWidth) / 2;

    const result = getResponsive({ platform, windowWidth: widthBetweenMobileAndTablet });
    expect(result.breakpoint).toBe('tablet');
  });

  it('keeps the smaller platform intent even when the width is large', () => {
    const platform = makePlatform({ OS: 'ios' });
    const result = getResponsive({ platform, windowWidth: 5000 });
    expect(result.breakpoint).toBe('mobile');
  });

  it('prefers the smaller dimension when platform suggests tablet but width is narrow', () => {
    const platform = makePlatform({ OS: 'ios', isPad: true });
    const { byDevice } = getResponsive({ platform, windowWidth: 2000 });
    const narrowWidth = byDevice.mobile.maxDeviceWidth - 10;

    const result = getResponsive({ platform, windowWidth: narrowWidth });
    expect(result.breakpoint).toBe('mobile');
  });
});
