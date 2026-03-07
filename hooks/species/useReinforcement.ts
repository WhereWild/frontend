import { useCallback, useEffect, useRef, useState } from 'react';
import {
  submitReinforcementFeedback,
  fetchReinforcedHeads,
  fetchReinforcementFeedback,
  deleteReinforcedHead,
  saveReinforcedHead,
  loadReinforcedHead,
} from '@/data/api';
import type {
  ReinforceFeedbackResponse,
  ReinforcementFeedbackEntry,
} from '@/data/types';

export type ReinforcementState = {
  /** Whether RL mode is active. */
  enabled: boolean;
  setEnabled: (value: boolean) => void;

  /** Whether the next tap marks present (true) or absent (false). */
  markPresent: boolean;
  setMarkPresent: (value: boolean) => void;

  /** Accumulated feedback entries for the current species. */
  feedbackLog: ReinforcementFeedbackEntry[];

  /** Whether the backend currently has a reinforced head for this species. */
  hasReinforcedHead: boolean;

  /** Whether reinforced-head availability is currently loading. */
  isReinforcedHeadStatusLoading: boolean;

  /** Latest response from a feedback submission. */
  lastResult: ReinforceFeedbackResponse | null;

  /** Submits feedback for a coordinate and returns the response. */
  submitFeedback: (lat: number, lon: number) => Promise<ReinforceFeedbackResponse | null>;

  /** Resets the reinforced head and clears local state. */
  resetHead: () => Promise<void>;

  /** Saves the reinforced head to backend-managed storage. */
  save: () => Promise<void>;

  /** Loads a previously saved reinforced head from backend-managed storage. */
  load: () => Promise<void>;

  /** Fetches the current feedback log from the backend. */
  refreshFeedbackLog: () => Promise<void>;

  /** Whether an async operation is in progress. */
  busy: boolean;

  /** Last error message, cleared on next successful operation. */
  error: string | null;

  /** Last successful save/load/reset status message. */
  statusMessage: string | null;
};

export function useReinforcement(speciesKey: number | undefined): ReinforcementState {
  const [enabled, setEnabled] = useState(false);
  const [markPresent, setMarkPresent] = useState(true);
  const [feedbackLog, setFeedbackLog] = useState<ReinforcementFeedbackEntry[]>([]);
  const [hasReinforcedHead, setHasReinforcedHead] = useState(false);
  const [isReinforcedHeadStatusLoading, setIsReinforcedHeadStatusLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ReinforceFeedbackResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isActiveRef = useRef(true);
  const activeSpeciesKeyRef = useRef(speciesKey);
  const availabilityRequestIdRef = useRef(0);
  const setIfActive = useCallback((updater: () => void) => {
    if (isActiveRef.current) {
      updater();
    }
  }, []);

  const isStaleSpeciesRequest = useCallback(
    (requestedSpeciesKey: number) =>
      !isActiveRef.current || activeSpeciesKeyRef.current !== requestedSpeciesKey,
    [],
  );

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeSpeciesKeyRef.current = speciesKey;
  }, [speciesKey]);

  // Reset state when species changes
  useEffect(() => {
    setFeedbackLog([]);
    setHasReinforcedHead(false);
    setIsReinforcedHeadStatusLoading(false);
    setLastResult(null);
    setError(null);
    setStatusMessage(null);
    setBusy(false);
  }, [speciesKey]);

  useEffect(() => {
    const requestId = ++availabilityRequestIdRef.current;
    if (!speciesKey) {
      setHasReinforcedHead(false);
      setIsReinforcedHeadStatusLoading(false);
      return;
    }

    setIsReinforcedHeadStatusLoading(true);
    fetchReinforcedHeads()
      .then((heads) => {
        if (!isActiveRef.current || requestId !== availabilityRequestIdRef.current) {
          return;
        }
        const found = heads.some((entry) => entry.speciesKey === speciesKey);
        setHasReinforcedHead(found);
      })
      .catch(() => {
        if (!isActiveRef.current || requestId !== availabilityRequestIdRef.current) {
          return;
        }
        setHasReinforcedHead(false);
      })
      .finally(() => {
        if (!isActiveRef.current || requestId !== availabilityRequestIdRef.current) {
          return;
        }
        setIsReinforcedHeadStatusLoading(false);
      });
  }, [speciesKey]);

  const refreshFeedbackLog = useCallback(async () => {
    if (!speciesKey) return;
    try {
      const entries = await fetchReinforcementFeedback(speciesKey);
      setIfActive(() => setFeedbackLog(entries));
    } catch {
      // Feedback log fetch is best-effort; species may not have an RL head yet.
    }
  }, [speciesKey, setIfActive]);

  const submitFeedback = useCallback(
    async (lat: number, lon: number): Promise<ReinforceFeedbackResponse | null> => {
      if (!speciesKey) return null;
      setBusy(true);
      setError(null);
      setStatusMessage(null);
      try {
        const result = await submitReinforcementFeedback({
          speciesKey,
          lat,
          lon,
          present: markPresent,
        });
        setIfActive(() => {
          setLastResult(result);
          setHasReinforcedHead(true);
          setFeedbackLog((prev) => [...prev, { lat, lon, present: markPresent }]);
        });
        return result;
      } catch (err) {
        setIfActive(() => {
          setError(err instanceof Error ? err.message : 'Failed to submit feedback');
        });
        return null;
      } finally {
        setIfActive(() => setBusy(false));
      }
    },
    [speciesKey, markPresent, setIfActive],
  );

  const resetHead = useCallback(async () => {
    if (!speciesKey) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await deleteReinforcedHead(speciesKey);
      setIfActive(() => {
        setHasReinforcedHead(false);
        setFeedbackLog([]);
        setLastResult(null);
        setStatusMessage('Reinforced head reset.');
      });
    } catch (err) {
      setIfActive(() => {
        setError(err instanceof Error ? err.message : 'Failed to reset head');
      });
    } finally {
      setIfActive(() => setBusy(false));
    }
  }, [speciesKey, setIfActive]);

  const save = useCallback(
    async () => {
      if (!speciesKey) return;
      setBusy(true);
      setError(null);
      setStatusMessage(null);
      try {
        await saveReinforcedHead(speciesKey);
        setIfActive(() => {
          setStatusMessage('Reinforced head saved.');
        });
      } catch (err) {
        setIfActive(() => {
          setError(err instanceof Error ? err.message : 'Failed to save head');
        });
      } finally {
        setIfActive(() => setBusy(false));
      }
    },
    [speciesKey, setIfActive],
  );

  const load = useCallback(
    async () => {
      if (!speciesKey) return;
      const requestedSpeciesKey = speciesKey;
      setBusy(true);
      setError(null);
      setStatusMessage(null);
      try {
        const result = await loadReinforcedHead(requestedSpeciesKey);
        if (isStaleSpeciesRequest(requestedSpeciesKey)) {
          return;
        }
        if (result.speciesKey !== requestedSpeciesKey) {
          throw new Error(
            `Loaded head belongs to species ${result.speciesKey}, expected ${requestedSpeciesKey}.`,
          );
        }
        let loadedFeedback = result.feedback;
        // Some backend variants report feedback_count on load without including
        // the full feedback array. Fall back to the feedback endpoint to keep
        // UI count and map dots in sync with restored data.
        if (loadedFeedback.length === 0 && result.feedbackCount > 0) {
          try {
            loadedFeedback = await fetchReinforcementFeedback(requestedSpeciesKey);
          } catch {
            // Keep parsed load payload if fallback fetch fails.
          }
        }

        if (isStaleSpeciesRequest(requestedSpeciesKey)) {
          return;
        }

        const resolvedFeedbackCount = loadedFeedback.length;
        setIfActive(() => {
          setHasReinforcedHead(true);
          setFeedbackLog(loadedFeedback);
          setStatusMessage(
            `Reinforced head loaded (${resolvedFeedbackCount}/${result.feedbackCount} feedback points applied).`,
          );
        });
      } catch (err) {
        setIfActive(() => {
          setError(err instanceof Error ? err.message : 'Failed to load head');
        });
      } finally {
        setIfActive(() => setBusy(false));
      }
    },
    [isStaleSpeciesRequest, speciesKey, setIfActive],
  );

  return {
    enabled,
    setEnabled,
    markPresent,
    setMarkPresent,
    feedbackLog,
    hasReinforcedHead,
    isReinforcedHeadStatusLoading,
    lastResult,
    submitFeedback,
    resetHead,
    save,
    load,
    refreshFeedbackLog,
    busy,
    error,
    statusMessage,
  };
}
