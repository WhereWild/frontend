import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme } from '../use-color-scheme';

// Mock React Native's useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme');

describe('useColorScheme Hook', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns light mode when system is light', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    
    const { result } = renderHook(() => useColorScheme());
    
    expect(result.current).toBe('light');
  });

  it('returns dark mode when system is dark', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    
    const { result } = renderHook(() => useColorScheme());
    
    expect(result.current).toBe('dark');
  });

  it('returns light mode when system returns null', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue(null);
    
    const { result } = renderHook(() => useColorScheme());
    
    // Should default to light mode when null
    expect(result.current).toBe('light');
  });

  it('returns light mode when system returns undefined', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue(undefined);
    
    const { result } = renderHook(() => useColorScheme());
    
    // Should default to light mode when undefined
    expect(result.current).toBe('light');
  });

  it('updates when system theme changes', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    
    const { result, rerender } = renderHook(() => useColorScheme());
    
    expect(result.current).toBe('light');
    
    // Simulate system theme change to dark
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    rerender({});
    
    expect(result.current).toBe('dark');
  });

  it('handles rapid theme changes', () => {
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    
    const { result, rerender } = renderHook(() => useColorScheme());
    
    expect(result.current).toBe('light');
    
    (useRNColorScheme as jest.Mock).mockReturnValue('dark');
    rerender({});
    expect(result.current).toBe('dark');
    
    (useRNColorScheme as jest.Mock).mockReturnValue('light');
    rerender({});
    expect(result.current).toBe('light');
  });

  it('calls React Native useColorScheme', () => {
    const mockUseColorScheme = useRNColorScheme as jest.Mock;
    mockUseColorScheme.mockReturnValue('light');
    
    renderHook(() => useColorScheme());
    
    expect(mockUseColorScheme).toHaveBeenCalled();
  });

  describe('Dark Mode Support', () => {
    it('properly handles dark mode', () => {
      (useRNColorScheme as jest.Mock).mockReturnValue('dark');
      
      const { result } = renderHook(() => useColorScheme());
      
      expect(result.current).toBe('dark');
    });

    it('switches from light to dark mode', () => {
      (useRNColorScheme as jest.Mock).mockReturnValue('light');
      
      const { result, rerender } = renderHook(() => useColorScheme());
      expect(result.current).toBe('light');
      
      (useRNColorScheme as jest.Mock).mockReturnValue('dark');
      rerender({});
      expect(result.current).toBe('dark');
    });

    it('switches from dark to light mode', () => {
      (useRNColorScheme as jest.Mock).mockReturnValue('dark');
      
      const { result, rerender } = renderHook(() => useColorScheme());
      expect(result.current).toBe('dark');
      
      (useRNColorScheme as jest.Mock).mockReturnValue('light');
      rerender({});
      expect(result.current).toBe('light');
    });
  });
});
