import { Responsive } from '@/constants/theme';
import { renderHook } from '@testing-library/react-native';
import { useIsCompact, useResponsive } from '../useResponsive';

const mockUseWindowDimensions = jest.fn(() => ({
  width: Responsive.deviceWidth.mobile,
  height: 640,
  scale: 1,
  fontScale: 1,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

describe('useResponsive', () => {
  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({
      width: Responsive.deviceWidth.mobile,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
  });

  it('treats widths at or below the mobile breakpoint as mobile + compact', () => {
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isCompact).toBe(true);
  });

  it('marks widths between mobile and tablet as tablet but still compact', () => {
    mockUseWindowDimensions.mockReturnValue({
      width: Responsive.deviceWidth.mobile + 1,
      height: 640,
      scale: 1,
      fontScale: 1,
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isCompact).toBe(true);
  });

  it('treats widths beyond tablet as desktop', () => {
    mockUseWindowDimensions.mockReturnValue({
      width: Responsive.deviceWidth.tablet + 10,
      height: 640,
      scale: 1,
      fontScale: 1,
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isCompact).toBe(false);
  });

  it('syncs useIsCompact with the compact breakpoint', () => {
    mockUseWindowDimensions.mockReturnValue({
      width: Responsive.deviceWidth.tablet,
      height: 640,
      scale: 1,
      fontScale: 1,
    });

    const { result } = renderHook(() => useIsCompact());
    expect(result.current).toBe(true);
  });
});
