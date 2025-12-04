import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePersistentSetting } from '../usePersistentSetting';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('usePersistentSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates the stored value when it differs from the default', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify('stored-value'));

    const { result } = renderHook(() => usePersistentSetting('pref', 'default-value'));

    await waitFor(() => expect(result.current[0]).toBe('stored-value'));
  });

  it('leaves state untouched when the stored value matches the default', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify('default-value'));

    const { result } = renderHook(() => usePersistentSetting('pref', 'default-value'));

    await waitFor(() => expect(mockAsyncStorage.getItem).toHaveBeenCalled());
    expect(result.current[0]).toBe('default-value');
  });

  it('updates AsyncStorage when persistValue is invoked', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);

    const { result } = renderHook(() => usePersistentSetting('pref', 'initial'));

    await waitFor(() => expect(mockAsyncStorage.getItem).toHaveBeenCalled());

    await act(async () => {
      await result.current[1]('next');
    });

    expect(result.current[0]).toBe('next');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('pref', JSON.stringify('next'));
  });

  it('resets state and storage to the default value', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify('hydrated'));

    const { result } = renderHook(() => usePersistentSetting('pref', 'initial'));

    await waitFor(() => expect(result.current[0]).toBe('hydrated'));

    await act(async () => {
      await result.current[2]();
    });

    expect(result.current[0]).toBe('initial');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('pref', JSON.stringify('initial'));
  });

  it('falls back to the default value when stored data cannot be parsed', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce('not-json');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentSetting('pref', 'fallback'));

    await waitFor(() => expect(result.current[0]).toBe('fallback'));
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to parse persisted setting; falling back to default.',
      expect.any(SyntaxError),
    );

    warnSpy.mockRestore();
  });

  it('warns and falls back when hydration fails outright', async () => {
    const error = new Error('getItem failed');
    mockAsyncStorage.getItem.mockRejectedValueOnce(error);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentSetting('pref', 'fallback'));

    await waitFor(() => expect(result.current[0]).toBe('fallback'));
    expect(warnSpy).toHaveBeenCalledWith("Failed to load setting 'pref'", error);

    warnSpy.mockRestore();
  });

  it('still updates state when persisting fails and surfaces a warning', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const error = new Error('persist failed');
    mockAsyncStorage.setItem.mockRejectedValueOnce(error);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentSetting('pref', 'initial'));

    await waitFor(() => expect(mockAsyncStorage.getItem).toHaveBeenCalled());

    await act(async () => {
      await result.current[1]('next');
    });

    expect(result.current[0]).toBe('next');
    expect(warnSpy).toHaveBeenCalledWith("Failed to persist setting 'pref'", error);

    warnSpy.mockRestore();
  });

  it('resets state even if persisting the default fails', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const error = new Error('reset failed');
    mockAsyncStorage.setItem.mockRejectedValueOnce(error);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentSetting('pref', 'initial'));

    await waitFor(() => expect(mockAsyncStorage.getItem).toHaveBeenCalled());

    await act(async () => {
      await result.current[2]();
    });

    expect(result.current[0]).toBe('initial');
    expect(warnSpy).toHaveBeenCalledWith("Failed to reset setting 'pref'", error);

    warnSpy.mockRestore();
  });
});
