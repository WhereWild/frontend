import {
  deleteReinforcedHead,
  fetchReinforcementFeedback,
  fetchReinforcedHeads,
  submitReinforcementFeedback,
} from '@/data/api';
import {
  DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
  type ReinforcementFeedbackEntry,
  type ReinforceFeedbackResponse,
} from '@/data/types';
import React from 'react';

export type ReinforcementDemoState = {
  clientKey: string;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  markPresent: boolean;
  setMarkPresent: (value: boolean) => void;
  busy: boolean;
  error: string | null;
  feedbackCount: number;
  feedbackPoints: ReinforcementFeedbackEntry[];
  hasReinforcedHead: boolean;
  isActive: boolean;
  activationThreshold: number;
  headVariant: 'original' | 'reinforced';
  lastResult: ReinforceFeedbackResponse | null;
  submitFeedback: (
    lat: number,
    lon: number,
  ) => Promise<ReinforceFeedbackResponse | null>;
  resetHead: () => Promise<void>;
};

const DEMO_CLIENT_KEY = 'frontend-demo';

export function useReinforcementDemo(
  speciesKey: number | undefined,
): ReinforcementDemoState {
  const [enabled, setEnabled] = React.useState(false);
  const [markPresent, setMarkPresent] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedbackCount, setFeedbackCount] = React.useState(0);
  const [feedbackPoints, setFeedbackPoints] = React.useState<
    ReinforcementFeedbackEntry[]
  >([]);
  const [hasReinforcedHead, setHasReinforcedHead] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [activationThreshold, setActivationThreshold] = React.useState(
    DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD,
  );
  const [lastResult, setLastResult] =
    React.useState<ReinforceFeedbackResponse | null>(null);
  const requestRef = React.useRef(0);
  const isMountedRef = React.useRef(true);
  const activeSpeciesKeyRef = React.useRef(speciesKey);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    activeSpeciesKeyRef.current = speciesKey;
  }, [speciesKey]);

  // Safe with [] because this callback only reads mutable refs, not render-time values.
  const isStaleRequest = React.useCallback(
    (requestSpeciesKey: number | undefined, requestId?: number) => {
      if (!isMountedRef.current) {
        return true;
      }
      if (activeSpeciesKeyRef.current !== requestSpeciesKey) {
        return true;
      }
      if (typeof requestId === 'number' && requestRef.current !== requestId) {
        return true;
      }
      return false;
    },
    [],
  );

  React.useEffect(() => {
    requestRef.current += 1;
    setEnabled(false);
    setMarkPresent(true);
    setBusy(false);
    setError(null);
    setFeedbackCount(0);
    setFeedbackPoints([]);
    setHasReinforcedHead(false);
    setIsActive(false);
    setActivationThreshold(DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD);
    setLastResult(null);
  }, [speciesKey]);

  React.useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    if (!speciesKey) {
      return;
    }

    setError(null);
    fetchReinforcedHeads(DEMO_CLIENT_KEY)
      .then((heads) => {
        if (isStaleRequest(speciesKey, requestId)) {
          return;
        }
        const current = heads.find((entry) => entry.speciesKey === speciesKey);
        if (!current) {
          setHasReinforcedHead(false);
          setFeedbackCount(0);
          setIsActive(false);
          setActivationThreshold(DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD);
          return;
        }
        setHasReinforcedHead(true);
        setFeedbackCount(current.feedbackCount);
        setIsActive(current.active);
        setActivationThreshold(current.activationThreshold);
      })
      .catch(() => {
        if (isStaleRequest(speciesKey, requestId)) {
          return;
        }
        setHasReinforcedHead(false);
      });
  }, [isStaleRequest, speciesKey]);

  React.useEffect(() => {
    if (!speciesKey) {
      return;
    }

    fetchReinforcementFeedback(speciesKey, DEMO_CLIENT_KEY)
      .then((feedback) => {
        if (isStaleRequest(speciesKey)) {
          return;
        }
        setFeedbackPoints(feedback);
      })
      .catch(() => {
        if (isStaleRequest(speciesKey)) {
          return;
        }
        setFeedbackPoints([]);
      });
  }, [isStaleRequest, speciesKey]);

  const submitFeedback = React.useCallback(
    async (lat: number, lon: number) => {
      if (!speciesKey) {
        return null;
      }
      const requestSpeciesKey = speciesKey;

      setBusy(true);
      setError(null);
      try {
        const result = await submitReinforcementFeedback({
          clientKey: DEMO_CLIENT_KEY,
          speciesKey: requestSpeciesKey,
          lat,
          lon,
          present: markPresent,
        });
        if (isStaleRequest(requestSpeciesKey)) {
          return null;
        }
        setLastResult(result);
        setFeedbackCount(result.feedbackCount);
        setFeedbackPoints((current) => [...current, result.point]);
        setHasReinforcedHead(true);
        setIsActive(result.active);
        setActivationThreshold(result.activationThreshold);
        return result;
      } catch (requestError) {
        if (isStaleRequest(requestSpeciesKey)) {
          return null;
        }
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Failed to submit reinforcement feedback.';
        setError(message);
        return null;
      } finally {
        if (!isStaleRequest(requestSpeciesKey)) {
          setBusy(false);
        }
      }
    },
    [isStaleRequest, markPresent, speciesKey],
  );

  const resetHead = React.useCallback(async () => {
    if (!speciesKey) {
      return;
    }
    const requestSpeciesKey = speciesKey;

    setBusy(true);
    setError(null);
    try {
      await deleteReinforcedHead(requestSpeciesKey, DEMO_CLIENT_KEY);
      if (isStaleRequest(requestSpeciesKey)) {
        return;
      }
      setFeedbackCount(0);
      setFeedbackPoints([]);
      setHasReinforcedHead(false);
      setIsActive(false);
      setActivationThreshold(DEFAULT_REINFORCEMENT_ACTIVATION_THRESHOLD);
      setLastResult(null);
    } catch (requestError) {
      if (isStaleRequest(requestSpeciesKey)) {
        return;
      }
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Failed to reset personalized head.';
      setError(message);
    } finally {
      if (!isStaleRequest(requestSpeciesKey)) {
        setBusy(false);
      }
    }
  }, [isStaleRequest, speciesKey]);

  return {
    clientKey: DEMO_CLIENT_KEY,
    enabled,
    setEnabled,
    markPresent,
    setMarkPresent,
    busy,
    error,
    feedbackCount,
    feedbackPoints,
    hasReinforcedHead,
    isActive,
    activationThreshold,
    headVariant: enabled && isActive ? 'reinforced' : 'original',
    lastResult,
    submitFeedback,
    resetHead,
  };
}
