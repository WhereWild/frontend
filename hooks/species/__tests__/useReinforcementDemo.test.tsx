import {
  deleteReinforcedHead,
  fetchReinforcementFeedback,
  fetchReinforcedHeads,
  submitReinforcementFeedback,
} from '@/data/api';
import {
  DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
  type ReinforceFeedbackResponse,
} from '@/data/types';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useReinforcementDemo,
  type ReinforcementDemoState,
} from '../useReinforcementDemo';

jest.mock('@/data/api', () => ({
  deleteReinforcedHead: jest.fn(),
  fetchReinforcementFeedback: jest.fn(),
  fetchReinforcedHeads: jest.fn(),
  submitReinforcementFeedback: jest.fn(),
}));

const mockDeleteReinforcedHead = jest.mocked(deleteReinforcedHead);
const mockFetchReinforcementFeedback = jest.mocked(fetchReinforcementFeedback);
const mockFetchReinforcedHeads = jest.mocked(fetchReinforcedHeads);
const mockSubmitReinforcementFeedback = jest.mocked(
  submitReinforcementFeedback,
);

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useReinforcementDemo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchReinforcedHeads.mockResolvedValue([]);
    mockFetchReinforcementFeedback.mockResolvedValue([]);
    mockSubmitReinforcementFeedback.mockResolvedValue({
      speciesKey: 12,
      feedbackCount: 1,
      point: { lat: 10, lon: 20, present: true },
      originalScore: 0.2,
      reinforcedScore: 0.6,
      active: false,
      activationThreshold: DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
    });
    mockDeleteReinforcedHead.mockResolvedValue(undefined);
  });

  it('returns defaults and skips API calls when species key is missing', () => {
    const { result } = renderHook(() => useReinforcementDemo(undefined));

    expect(result.current.clientKey).toBe('frontend-demo');
    expect(result.current.enabled).toBe(false);
    expect(result.current.markPresent).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.feedbackCount).toBe(0);
    expect(result.current.feedbackPoints).toEqual([]);
    expect(result.current.hasReinforcedHead).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.activationThreshold).toBe(
      DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
    );
    expect(result.current.headVariant).toBe('original');
    expect(mockFetchReinforcedHeads).not.toHaveBeenCalled();
    expect(mockFetchReinforcementFeedback).not.toHaveBeenCalled();
  });

  it('loads the matching reinforced head and saved feedback points', async () => {
    mockFetchReinforcedHeads.mockResolvedValueOnce([
      {
        speciesKey: 7,
        feedbackCount: 3,
        active: true,
        activationThreshold: 4,
      },
    ]);
    mockFetchReinforcementFeedback.mockResolvedValueOnce([
      { lat: 1, lon: 2, present: true },
      { lat: 3, lon: 4, present: false },
    ]);

    const { result } = renderHook(() => useReinforcementDemo(7));

    await waitFor(() => {
      expect(result.current.hasReinforcedHead).toBe(true);
      expect(result.current.feedbackCount).toBe(3);
      expect(result.current.isActive).toBe(true);
      expect(result.current.activationThreshold).toBe(4);
      expect(result.current.feedbackPoints).toHaveLength(2);
    });

    expect(mockFetchReinforcedHeads).toHaveBeenCalledWith('frontend-demo');
    expect(mockFetchReinforcementFeedback).toHaveBeenCalledWith(
      7,
      'frontend-demo',
    );
  });

  it('falls back to defaults when head and feedback fetches fail', async () => {
    mockFetchReinforcedHeads.mockRejectedValueOnce(new Error('heads failed'));
    mockFetchReinforcementFeedback.mockRejectedValueOnce('feedback failed');

    const { result } = renderHook(() => useReinforcementDemo(3));

    await waitFor(() => {
      expect(result.current.hasReinforcedHead).toBe(false);
      expect(result.current.feedbackCount).toBe(0);
      expect(result.current.isActive).toBe(false);
      expect(result.current.activationThreshold).toBe(
        DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
      );
      expect(result.current.feedbackPoints).toEqual([]);
    });
  });

  it('submits feedback using the selected presence mode and updates derived state', async () => {
    mockSubmitReinforcementFeedback.mockResolvedValueOnce({
      speciesKey: 12,
      feedbackCount: 5,
      point: { lat: 40, lon: -111, present: false },
      originalScore: 0.111,
      reinforcedScore: 0.777,
      active: true,
      activationThreshold: 5,
    });

    const { result } = renderHook(() => useReinforcementDemo(12));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    act(() => {
      result.current.setEnabled(true);
      result.current.setMarkPresent(false);
    });

    let response = null;
    await act(async () => {
      response = await result.current.submitFeedback(40, -111);
    });

    expect(response).toEqual({
      speciesKey: 12,
      feedbackCount: 5,
      point: { lat: 40, lon: -111, present: false },
      originalScore: 0.111,
      reinforcedScore: 0.777,
      active: true,
      activationThreshold: 5,
    });
    expect(mockSubmitReinforcementFeedback).toHaveBeenCalledWith({
      clientKey: 'frontend-demo',
      speciesKey: 12,
      lat: 40,
      lon: -111,
      present: false,
    });
    expect(result.current.feedbackCount).toBe(5);
    expect(result.current.feedbackPoints).toContainEqual({
      lat: 40,
      lon: -111,
      present: false,
    });
    expect(result.current.hasReinforcedHead).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(result.current.headVariant).toBe('reinforced');
    expect(result.current.lastResult?.reinforcedScore).toBe(0.777);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('surfaces a fallback message when feedback submission fails with a non-Error value', async () => {
    mockSubmitReinforcementFeedback.mockRejectedValueOnce('network');

    const { result } = renderHook(() => useReinforcementDemo(8));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    await act(async () => {
      await result.current.submitFeedback(5, 6);
    });

    expect(result.current.error).toBe(
      'Failed to submit reinforcement feedback.',
    );
    expect(result.current.busy).toBe(false);
  });

  it('surfaces the Error message when feedback submission fails with an Error instance', async () => {
    mockSubmitReinforcementFeedback.mockRejectedValueOnce(
      new Error('submit failed'),
    );

    const { result } = renderHook(() => useReinforcementDemo(8));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    await act(async () => {
      await result.current.submitFeedback(5, 6);
    });

    expect(result.current.error).toBe('submit failed');
    expect(result.current.busy).toBe(false);
  });

  it('returns null and does not submit feedback when species key is missing', async () => {
    const { result } = renderHook(() => useReinforcementDemo(undefined));

    let response: ReinforceFeedbackResponse | null = null;
    await act(async () => {
      response = await result.current.submitFeedback(1, 2);
    });

    expect(response).toBeNull();
    expect(mockSubmitReinforcementFeedback).not.toHaveBeenCalled();
  });

  it('resets a personalized head and clears accumulated state', async () => {
    mockFetchReinforcedHeads.mockResolvedValueOnce([
      {
        speciesKey: 5,
        feedbackCount: 4,
        active: true,
        activationThreshold: 5,
      },
    ]);
    mockFetchReinforcementFeedback.mockResolvedValueOnce([
      { lat: 1, lon: 2, present: true },
    ]);
    mockSubmitReinforcementFeedback.mockResolvedValueOnce({
      speciesKey: 5,
      feedbackCount: 5,
      point: { lat: 10, lon: 20, present: true },
      originalScore: 0.1,
      reinforcedScore: 0.9,
      active: true,
      activationThreshold: 5,
    });

    const { result } = renderHook(() => useReinforcementDemo(5));

    await waitFor(() => {
      expect(result.current.hasReinforcedHead).toBe(true);
      expect(result.current.feedbackPoints).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitFeedback(10, 20);
    });

    await act(async () => {
      await result.current.resetHead();
    });

    expect(mockDeleteReinforcedHead).toHaveBeenCalledWith(5, 'frontend-demo');
    expect(result.current.feedbackCount).toBe(0);
    expect(result.current.feedbackPoints).toEqual([]);
    expect(result.current.hasReinforcedHead).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.activationThreshold).toBe(
      DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
    );
    expect(result.current.lastResult).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('surfaces an Error message when reset fails', async () => {
    mockDeleteReinforcedHead.mockRejectedValueOnce(new Error('reset failed'));

    const { result } = renderHook(() => useReinforcementDemo(6));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    await act(async () => {
      await result.current.resetHead();
    });

    expect(result.current.error).toBe('reset failed');
    expect(result.current.busy).toBe(false);
  });

  it('uses the fallback reset error message for non-Error failures', async () => {
    mockDeleteReinforcedHead.mockRejectedValueOnce('reset failed');

    const { result } = renderHook(() => useReinforcementDemo(6));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    await act(async () => {
      await result.current.resetHead();
    });

    expect(result.current.error).toBe('Failed to reset personalized head.');
    expect(result.current.busy).toBe(false);
  });

  it('returns early when resetting without a species key', async () => {
    const { result } = renderHook(() => useReinforcementDemo(undefined));

    await act(async () => {
      await result.current.resetHead();
    });

    expect(mockDeleteReinforcedHead).not.toHaveBeenCalled();
  });

  it('ignores stale responses after the species key changes', async () => {
    const firstHeads = createDeferred<
      {
        speciesKey: number;
        feedbackCount: number;
        active: boolean;
        activationThreshold: number;
      }[]
    >();
    const secondHeads = createDeferred<
      {
        speciesKey: number;
        feedbackCount: number;
        active: boolean;
        activationThreshold: number;
      }[]
    >();
    const firstFeedback =
      createDeferred<{ lat: number; lon: number; present: boolean }[]>();
    const secondFeedback =
      createDeferred<{ lat: number; lon: number; present: boolean }[]>();

    mockFetchReinforcedHeads
      .mockReturnValueOnce(firstHeads.promise)
      .mockReturnValueOnce(secondHeads.promise);
    mockFetchReinforcementFeedback
      .mockReturnValueOnce(firstFeedback.promise)
      .mockReturnValueOnce(secondFeedback.promise);

    const { result, rerender } = renderHook<
      ReinforcementDemoState,
      { speciesKey: number | undefined }
    >(({ speciesKey }) => useReinforcementDemo(speciesKey), {
      initialProps: { speciesKey: 1 as number | undefined },
    });

    rerender({ speciesKey: 2 });

    await act(async () => {
      secondHeads.resolve([
        {
          speciesKey: 2,
          feedbackCount: 1,
          active: false,
          activationThreshold: 7,
        },
      ]);
      secondFeedback.resolve([{ lat: 8, lon: 9, present: true }]);
      await Promise.resolve();
    });

    await act(async () => {
      firstHeads.resolve([
        {
          speciesKey: 1,
          feedbackCount: 99,
          active: true,
          activationThreshold: 2,
        },
      ]);
      firstFeedback.resolve([{ lat: 100, lon: 200, present: false }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.feedbackCount).toBe(1);
      expect(result.current.activationThreshold).toBe(7);
      expect(result.current.isActive).toBe(false);
      expect(result.current.feedbackPoints).toEqual([
        { lat: 8, lon: 9, present: true },
      ]);
    });
  });

  it('ignores in-flight head and feedback responses after unmount', async () => {
    const heads = createDeferred<
      {
        speciesKey: number;
        feedbackCount: number;
        active: boolean;
        activationThreshold: number;
      }[]
    >();
    const feedback =
      createDeferred<{ lat: number; lon: number; present: boolean }[]>();

    mockFetchReinforcedHeads.mockReturnValueOnce(heads.promise);
    mockFetchReinforcementFeedback.mockReturnValueOnce(feedback.promise);

    const { unmount } = renderHook(() => useReinforcementDemo(4));

    unmount();

    await act(async () => {
      heads.resolve([
        {
          speciesKey: 4,
          feedbackCount: 7,
          active: true,
          activationThreshold: 9,
        },
      ]);
      feedback.resolve([{ lat: 1, lon: 2, present: true }]);
      await Promise.resolve();
    });

    expect(mockFetchReinforcedHeads).toHaveBeenCalledWith('frontend-demo');
    expect(mockFetchReinforcementFeedback).toHaveBeenCalledWith(
      4,
      'frontend-demo',
    );
  });

  it('ignores a stale head response when the same species key is requested again later', async () => {
    const firstHeads = createDeferred<
      {
        speciesKey: number;
        feedbackCount: number;
        active: boolean;
        activationThreshold: number;
      }[]
    >();
    const secondHeads = createDeferred<
      {
        speciesKey: number;
        feedbackCount: number;
        active: boolean;
        activationThreshold: number;
      }[]
    >();

    mockFetchReinforcedHeads
      .mockReturnValueOnce(firstHeads.promise)
      .mockReturnValueOnce(secondHeads.promise);
    mockFetchReinforcementFeedback.mockResolvedValue([]);

    const { result, rerender } = renderHook<
      ReinforcementDemoState,
      { speciesKey: number | undefined }
    >(({ speciesKey }) => useReinforcementDemo(speciesKey), {
      initialProps: { speciesKey: 1 as number | undefined },
    });

    rerender({ speciesKey: undefined });
    rerender({ speciesKey: 1 });

    await act(async () => {
      secondHeads.resolve([
        {
          speciesKey: 1,
          feedbackCount: 2,
          active: false,
          activationThreshold: 6,
        },
      ]);
      await Promise.resolve();
    });

    await act(async () => {
      firstHeads.resolve([
        {
          speciesKey: 1,
          feedbackCount: 99,
          active: true,
          activationThreshold: 2,
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.feedbackCount).toBe(2);
      expect(result.current.activationThreshold).toBe(6);
      expect(result.current.isActive).toBe(false);
    });
  });

  it('returns null for stale submit and reset completions after unmount', async () => {
    const submitDeferred = createDeferred<{
      speciesKey: number;
      feedbackCount: number;
      point: { lat: number; lon: number; present: boolean };
      originalScore: number;
      reinforcedScore: number;
      active: boolean;
      activationThreshold: number;
    }>();
    const resetDeferred = createDeferred<void>();

    mockSubmitReinforcementFeedback.mockReturnValueOnce(submitDeferred.promise);
    mockDeleteReinforcedHead.mockReturnValueOnce(resetDeferred.promise);

    const { result, unmount } = renderHook(() => useReinforcementDemo(14));

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });

    const submitPromise = result.current.submitFeedback(9, 10);
    const resetPromise = result.current.resetHead();

    unmount();

    await act(async () => {
      submitDeferred.resolve({
        speciesKey: 14,
        feedbackCount: 3,
        point: { lat: 9, lon: 10, present: true },
        originalScore: 0.2,
        reinforcedScore: 0.8,
        active: true,
        activationThreshold: 5,
      });
      resetDeferred.resolve();
      await Promise.resolve();
    });

    await expect(submitPromise).resolves.toBeNull();
    await expect(resetPromise).resolves.toBeUndefined();
  });
});
