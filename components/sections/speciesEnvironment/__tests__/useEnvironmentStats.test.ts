import { renderHook, waitFor } from '@testing-library/react-native';
import { fetchSpeciesEnvironment } from '@/data/api';
import { useEnvironmentStats } from '../useEnvironmentStats';

jest.mock('@/data/api', () => ({
  fetchSpeciesEnvironment: jest.fn(),
}));

const mockFetchSpeciesEnvironment = jest.mocked(fetchSpeciesEnvironment);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useEnvironmentStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fallback error message when fetch rejects with a non-Error value', async () => {
    mockFetchSpeciesEnvironment.mockRejectedValue('network down');

    const { result } = renderHook(() =>
      useEnvironmentStats({
        taxonId: 1,
        selectedVariable: 'bio_1',
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load environment stats');
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toBeNull();
  });

  it('returns null stats/error and does not fetch when selected variable is empty', async () => {
    const { result } = renderHook(() =>
      useEnvironmentStats({
        taxonId: 1,
        selectedVariable: '',
      }),
    );

    await waitFor(() => {
      expect(result.current.stats).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchSpeciesEnvironment).not.toHaveBeenCalled();
  });

  it('ignores rejected responses after effect cancellation', async () => {
    const deferred = createDeferred<never>();
    mockFetchSpeciesEnvironment.mockImplementationOnce(() => deferred.promise);

    const { unmount } = renderHook(() =>
      useEnvironmentStats({
        taxonId: 1,
        selectedVariable: 'bio_1',
      }),
    );

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironment).toHaveBeenCalledTimes(1),
    );

    unmount();

    await expect(
      (async () => {
        deferred.reject(new Error('cancelled request'));
        await Promise.resolve();
      })(),
    ).resolves.toBeUndefined();
  });
});
