import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme } from '../useColorScheme';
import { useOptionalSettings } from '@/context/SettingsContext';

jest.unmock('@/hooks/useColorScheme');

jest.mock('@/context/SettingsContext', () => ({
  useOptionalSettings: jest.fn(() => ({ colorModeOverride: 'system' })),
}));

// Mock React Native's useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme');

describe('useColorScheme Hook', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'system',
    });
  });

  it('returns the light mode when the system preference is light', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('returns the dark mode when the system preference is dark', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('falls back to dark mode when the platform hook returns nullish', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('updates when the system preference changes', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');

    const { result, rerender } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');

    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    rerender({});
    expect(result.current).toBe('dark');
  });

  it('invokes the React Native useColorScheme hook', () => {
    const mockUseColorScheme = useRNColorScheme as jest.Mock;
    mockUseColorScheme.mockReturnValue('light');

    renderHook(() => useColorScheme());

    expect(mockUseColorScheme).toHaveBeenCalled();
  });

  it('returns the light override when settings force light mode', () => {
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'light',
    });
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('returns the dark override when settings force dark mode', () => {
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'dark',
    });
    (useRNColorScheme as jest.Mock).mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });
});
