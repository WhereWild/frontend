import type {
  ReinforceFeedbackRequest,
  ReinforceFeedbackResponse,
  ReinforcedSpeciesInfo,
  ReinforcementFeedbackEntry,
  ReinforcedHeadLoadResponse,
} from './types';
import { BACKEND_BASE, asRecord } from './apiShared';
import { toFiniteNumber } from './environmentParsers';

type ReinforcedHeadActionStatus = {
  speciesKey: number;
  status: string;
};

const parseReinforcedHeadActionStatus = (
  payload: unknown,
  speciesKey: number,
  fallbackStatus: string,
): ReinforcedHeadActionStatus => {
  const source = asRecord(payload);
  return {
    speciesKey: toFiniteNumber(source.species_key) ?? speciesKey,
    status: typeof source.status === 'string' ? source.status : fallbackStatus,
  };
};

const postReinforcedHeadAction = async (
  speciesKey: number,
  action: 'save' | 'load',
) => {
  const encoded = encodeURIComponent(String(speciesKey));
  const response = await fetch(`${BACKEND_BASE}/api/predict/reinforced/${encoded}/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Failed to ${action} reinforced head for ${speciesKey}: ${response.status} ${detail}`,
    );
  }

  return response.json();
};

const toFeedbackEntries = (value: unknown): ReinforcementFeedbackEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const item = asRecord(entry);
    return {
      lat: toFiniteNumber(item.lat ?? item.latitude) ?? 0,
      lon: toFiniteNumber(item.lon ?? item.longitude) ?? 0,
      present: Boolean(item.present),
    };
  });
};

const parseFeedbackEntries = (payload: unknown): ReinforcementFeedbackEntry[] => {
  if (Array.isArray(payload)) {
    return toFeedbackEntries(payload);
  }

  const source = asRecord(payload);
  const candidate = source.feedback ?? source.feedback_log ?? source.feedback_entries ?? source.entries;
  if (Array.isArray(candidate)) {
    return toFeedbackEntries(candidate);
  }

  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate);
      return toFeedbackEntries(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

/**
 * Submits reinforcement feedback for a species at a coordinate.
 */
export async function submitReinforcementFeedback(
  request: ReinforceFeedbackRequest,
): Promise<ReinforceFeedbackResponse> {
  const body: Record<string, unknown> = {
    species_key: request.speciesKey,
    lat: request.lat,
    lon: request.lon,
    present: request.present,
  };
  if (typeof request.lr === 'number') {
    body.lr = request.lr;
  }
  if (typeof request.steps === 'number') {
    body.steps = request.steps;
  }

  const response = await fetch(`${BACKEND_BASE}/api/predict/reinforce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to submit reinforcement feedback: ${response.status} ${detail}`);
  }

  const source = asRecord(await response.json());
  const point = asRecord(source.point);
  return {
    speciesKey: toFiniteNumber(source.species_key) ?? request.speciesKey,
    feedbackCount: toFiniteNumber(source.feedback_count) ?? 0,
    point: {
      lat: toFiniteNumber(point.lat) ?? request.lat,
      lon: toFiniteNumber(point.lon) ?? request.lon,
    },
    originalScore: toFiniteNumber(source.original_score) ?? 0,
    reinforcedScore: toFiniteNumber(source.reinforced_score) ?? 0,
  };
}

/**
 * Lists all species that have reinforced heads.
 */
export async function fetchReinforcedHeads(): Promise<ReinforcedSpeciesInfo[]> {
  const response = await fetch(`${BACKEND_BASE}/api/predict/reinforced`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to fetch reinforced heads: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : [];
  return items.map((entry) => {
    const source = asRecord(entry);
    return {
      speciesKey: toFiniteNumber(source.species_key) ?? 0,
      feedbackCount: toFiniteNumber(source.feedback_count) ?? 0,
    };
  });
}

/**
 * Gets the accumulated feedback log for a species.
 */
export async function fetchReinforcementFeedback(
  speciesKey: number,
): Promise<ReinforcementFeedbackEntry[]> {
  const encoded = encodeURIComponent(String(speciesKey));
  const response = await fetch(`${BACKEND_BASE}/api/predict/reinforced/${encoded}/feedback`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch reinforcement feedback for ${speciesKey}: ${response.status} ${detail}`,
    );
  }

  const data = await response.json();
  return parseFeedbackEntries(data);
}

/**
 * Deletes the reinforced head and all feedback for a species.
 */
export async function deleteReinforcedHead(
  speciesKey: number,
): Promise<{ speciesKey: number; status: string }> {
  const encoded = encodeURIComponent(String(speciesKey));
  const response = await fetch(`${BACKEND_BASE}/api/predict/reinforced/${encoded}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Failed to delete reinforced head for ${speciesKey}: ${response.status} ${detail}`,
    );
  }

  const source = asRecord(await response.json());
  return {
    speciesKey: toFiniteNumber(source.species_key) ?? speciesKey,
    status: typeof source.status === 'string' ? source.status : 'deleted',
  };
}

/**
 * Saves a reinforced head to disk.
 */
export async function saveReinforcedHead(
  speciesKey: number,
): Promise<{ speciesKey: number; status: string }> {
  const payload = await postReinforcedHeadAction(speciesKey, 'save');
  return parseReinforcedHeadActionStatus(payload, speciesKey, 'saved');
}

/**
 * Loads a previously saved reinforced head from disk.
 */
export async function loadReinforcedHead(
  speciesKey: number,
): Promise<ReinforcedHeadLoadResponse> {
  const payload = await postReinforcedHeadAction(speciesKey, 'load');
  const source = asRecord(payload);
  const feedback = parseFeedbackEntries(source);
  const status = parseReinforcedHeadActionStatus(source, speciesKey, 'loaded');

  return {
    speciesKey: status.speciesKey,
    status: status.status,
    feedbackCount: toFiniteNumber(source.feedback_count) ?? feedback.length,
    feedback,
  };
}
