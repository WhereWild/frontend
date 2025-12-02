import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme } from '../useColorScheme';

jest.unmock('@/hooks/useColorScheme');

// Mock React Native's useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme');

describe('useColorScheme Hook', () => {
  afterEach(() => {
    jest.clearAllMocks();
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

  it('falls back to light mode when the platform hook returns nullish', () => {
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
});
