import { renderHook } from '@testing-library/react-native';
import { Colors, Typography } from '@/constants/theme';
import { useTypographyStyles } from '../useTypographyStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme');

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('useTypographyStyles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns typography tokens configured for the light palette', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.light.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.light.heading.fontSize);
  });

  it('uses the dark palette when scheme is dark', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.dark.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.dark.heading.fontSize);
  });

  it('falls back to light palette when color scheme is undefined', () => {
    mockUseColorScheme.mockReturnValue(undefined as unknown as 'light');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.light.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.light.heading.fontSize);
  });

  it('recomputes styles when the color scheme changes', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result, rerender } = renderHook(() => useTypographyStyles());

    mockUseColorScheme.mockReturnValue('dark');
    rerender(undefined);

    expect(result.current.heading.color).toBe(Colors.dark.text.brand.secondary);
  });
});
