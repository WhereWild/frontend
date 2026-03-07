import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useReinforcement } from '../useReinforcement';
import {
  submitReinforcementFeedback,
  fetchReinforcedHeads,
  fetchReinforcementFeedback,
  deleteReinforcedHead,
  saveReinforcedHead,
  loadReinforcedHead,
} from '@/data/api';

jest.mock('@/data/api', () => ({
  submitReinforcementFeedback: jest.fn(),
  fetchReinforcedHeads: jest.fn(),
  fetchReinforcementFeedback: jest.fn(),
  deleteReinforcedHead: jest.fn(),
  saveReinforcedHead: jest.fn(),
  loadReinforcedHead: jest.fn(),
}));

const mockSubmit = jest.mocked(submitReinforcementFeedback);
const mockFetchReinforcedHeads = jest.mocked(fetchReinforcedHeads);
const mockFetchFeedback = jest.mocked(fetchReinforcementFeedback);
const mockDelete = jest.mocked(deleteReinforcedHead);
const mockSave = jest.mocked(saveReinforcedHead);
const mockLoad = jest.mocked(loadReinforcedHead);

describe('useReinforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchReinforcedHeads.mockImplementation(() => new Promise(() => {}));
    mockFetchFeedback.mockResolvedValue([]);
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useReinforcement(42));

    expect(result.current.enabled).toBe(false);
    expect(result.current.markPresent).toBe(true);
    expect(result.current.feedbackLog).toEqual([]);
    expect(result.current.hasReinforcedHead).toBe(false);
    expect(typeof result.current.isReinforcedHeadStatusLoading).toBe('boolean');
    expect(result.current.lastResult).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.statusMessage).toBeNull();
  });

  it('submits feedback and updates state', async () => {
    const response = {
      speciesKey: 42,
      feedbackCount: 1,
      point: { lat: 10, lon: 20 },
      originalScore: 0.5,
      reinforcedScore: 0.7,
    };
    mockSubmit.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useReinforcement(42));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.submitFeedback(10, 20);
    });

    expect(returnValue).toEqual(response);
    expect(mockSubmit).toHaveBeenCalledWith({
      speciesKey: 42,
      lat: 10,
      lon: 20,
      present: true,
    });
    expect(result.current.lastResult).toEqual(response);
    expect(result.current.feedbackLog).toEqual([{ lat: 10, lon: 20, present: true }]);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('submitFeedback respects markPresent toggle', async () => {
    mockSubmit.mockResolvedValueOnce({
      speciesKey: 42,
      feedbackCount: 1,
      point: { lat: 5, lon: 6 },
      originalScore: 0.3,
      reinforcedScore: 0.1,
    });

    const { result } = renderHook(() => useReinforcement(42));

    act(() => {
      result.current.setMarkPresent(false);
    });

    await act(async () => {
      await result.current.submitFeedback(5, 6);
    });

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ present: false }),
    );
    expect(result.current.feedbackLog[0].present).toBe(false);
  });

  it('sets error when submitFeedback fails', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useReinforcement(42));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.submitFeedback(1, 2);
    });

    expect(returnValue).toBeNull();
    expect(result.current.error).toBe('Network failure');
    expect(result.current.busy).toBe(false);
  });

  it('submitFeedback returns null when speciesKey is undefined', async () => {
    const { result } = renderHook(() => useReinforcement(undefined));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.submitFeedback(1, 2);
    });

    expect(returnValue).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('resetHead deletes and clears state', async () => {
    mockSubmit.mockResolvedValueOnce({
      speciesKey: 42,
      feedbackCount: 1,
      point: { lat: 1, lon: 2 },
      originalScore: 0.5,
      reinforcedScore: 0.6,
    });
    mockDelete.mockResolvedValueOnce({ speciesKey: 42, status: 'deleted' });

    const { result } = renderHook(() => useReinforcement(42));

    // Add some feedback first
    await act(async () => {
      await result.current.submitFeedback(1, 2);
    });
    expect(result.current.feedbackLog).toHaveLength(1);

    await act(async () => {
      await result.current.resetHead();
    });

    expect(mockDelete).toHaveBeenCalledWith(42);
    expect(result.current.feedbackLog).toEqual([]);
    expect(result.current.lastResult).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('resetHead sets error on failure', async () => {
    mockDelete.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.resetHead();
    });

    expect(result.current.error).toBe('delete failed');
  });

  it('save calls saveReinforcedHead', async () => {
    mockSave.mockResolvedValueOnce({ speciesKey: 42, status: 'saved' });

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.save();
    });

    expect(mockSave).toHaveBeenCalledWith(42);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.statusMessage).toBe('Reinforced head saved.');
  });

  it('save sets error on failure', async () => {
    mockSave.mockRejectedValueOnce(new Error('save failed'));

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.error).toBe('save failed');
  });

  it('load calls loadReinforcedHead and applies returned feedback', async () => {
    mockLoad.mockResolvedValueOnce({
      speciesKey: 42,
      status: 'loaded',
      feedbackCount: 2,
      feedback: [
        { lat: 1, lon: 2, present: true },
        { lat: 3, lon: 4, present: false },
      ],
    });

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.load();
    });

    expect(mockLoad).toHaveBeenCalledWith(42);
    expect(result.current.feedbackLog).toEqual([
      { lat: 1, lon: 2, present: true },
      { lat: 3, lon: 4, present: false },
    ]);
    expect(result.current.busy).toBe(false);
    expect(result.current.statusMessage).toBe(
      'Reinforced head loaded (2/2 feedback points applied).',
    );
  });

  it('load sets error on failure', async () => {
    mockLoad.mockRejectedValueOnce(new Error('load failed'));

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe('load failed');
  });

  it('load rejects responses for a different species key', async () => {
    mockLoad.mockResolvedValueOnce({
      speciesKey: 99,
      status: 'loaded',
      feedbackCount: 1,
      feedback: [{ lat: 1, lon: 2, present: true }],
    });

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe('Loaded head belongs to species 99, expected 42.');
    expect(result.current.feedbackLog).toEqual([]);
  });

  it('load fetches feedback log when response has count but no entries', async () => {
    mockLoad.mockResolvedValueOnce({
      speciesKey: 42,
      status: 'loaded',
      feedbackCount: 2,
      feedback: [],
    });
    mockFetchFeedback.mockResolvedValueOnce([
      { lat: 10, lon: 20, present: true },
      { lat: 30, lon: 40, present: false },
    ]);

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.load();
    });

    expect(mockFetchFeedback).toHaveBeenCalledWith(42);
    expect(result.current.feedbackLog).toEqual([
      { lat: 10, lon: 20, present: true },
      { lat: 30, lon: 40, present: false },
    ]);
  });

  it('resets state when speciesKey changes', async () => {
    mockSubmit.mockResolvedValue({
      speciesKey: 42,
      feedbackCount: 1,
      point: { lat: 1, lon: 2 },
      originalScore: 0.5,
      reinforcedScore: 0.6,
    });

    const { result, rerender } = renderHook(
      ({ key }: { key: number | undefined }) => useReinforcement(key),
      { initialProps: { key: 42 } },
    );

    await act(async () => {
      await result.current.submitFeedback(1, 2);
    });
    expect(result.current.feedbackLog).toHaveLength(1);

    rerender({ key: 99 });

    await waitFor(() => {
      expect(result.current.feedbackLog).toEqual([]);
      expect(result.current.lastResult).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  it('refreshFeedbackLog fetches and sets feedback entries', async () => {
    mockFetchFeedback.mockResolvedValueOnce([
      { lat: 1, lon: 2, present: true },
      { lat: 3, lon: 4, present: false },
    ]);

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.refreshFeedbackLog();
    });

    expect(mockFetchFeedback).toHaveBeenCalledWith(42);
    expect(result.current.feedbackLog).toEqual([
      { lat: 1, lon: 2, present: true },
      { lat: 3, lon: 4, present: false },
    ]);
  });

  it('refreshFeedbackLog silently ignores errors', async () => {
    mockFetchFeedback.mockRejectedValueOnce(new Error('not found'));

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.refreshFeedbackLog();
    });

    // Should not set error or crash
    expect(result.current.feedbackLog).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('non-Error rejection surfaces generic message', async () => {
    mockSubmit.mockRejectedValueOnce('arbitrary');

    const { result } = renderHook(() => useReinforcement(42));

    await act(async () => {
      await result.current.submitFeedback(1, 2);
    });

    expect(result.current.error).toBe('Failed to submit feedback');
  });
});
