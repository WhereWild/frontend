// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  BACKEND_BASE,
  fetchSpeciesWithModels,
  fetchViewportScores,
} from '@/data/api';
import type { ViewportTileRange } from '@/data/api';
import type {
  HomePageData,
  SpeciesApiNormalized,
  SpeciesSummary,
} from '@/data/types';
import React from 'react';

const SCORE_DEBOUNCE_MS = 1200;
const RECOMMENDATION_SCORE_THRESHOLD = 0.25;
const MAX_RECOMMENDATIONS = 10;
const HOMEPAGE_GROUP_ORDER = [
  'arthropods',
  'birds',
  'animals',
  'fungi',
  'plants',
] as const;

export type ViewportBounds = ViewportTileRange;

const areViewportBoundsEqual = (
  left: ViewportTileRange | null,
  right: ViewportTileRange,
) => {
  if (!left) {
    return false;
  }

  return (
    left.z === right.z &&
    left.x0 === right.x0 &&
    left.y0 === right.y0 &&
    left.x1 === right.x1 &&
    left.y1 === right.y1
  );
};

const formatReasonDescription = (reasons: string[] | undefined) => {
  if (!reasons?.length) {
    return '';
  }

  return reasons
    .map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1))
    .join(' · ');
};

const withScoreReason = (
  item: SpeciesSummary,
  reasons: Record<string, string[]>,
): SpeciesSummary => {
  const description = formatReasonDescription(reasons[String(item.taxonId)]);
  return description ? { ...item, description } : item;
};

const buildHomepageHeatmapTileUrl = (sessionStamp: number, group: string) => {
  const groupParam = group !== 'all' ? `&group=${group}` : '';
  return `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=${sessionStamp}${groupParam}`;
};

const buildRecommendationSeedKey = (items: SpeciesSummary[]) =>
  items
    .map((item) =>
      [
        item.taxonId,
        item.commonName,
        item.scientificName,
        item.description,
        item.taxonGroup ?? '',
      ].join(':'),
    )
    .join('|');

const getAvailableRecommendationGroups = (items: SpeciesSummary[]) =>
  new Set(items.map((item) => item.taxonGroup).filter(Boolean));

const normalizeActiveGroup = (
  items: SpeciesSummary[],
  group: string,
  options?: { preserveWhenEmpty?: boolean },
) => {
  if (group === 'all') {
    return 'all';
  }

  const availableGroups = getAvailableRecommendationGroups(items);

  if (availableGroups.size === 0 && options?.preserveWhenEmpty !== false) {
    return group;
  }

  return availableGroups.has(group) ? group : 'all';
};

const mapSpeciesWithModelToSummary = (
  item: SpeciesApiNormalized,
): SpeciesSummary => ({
  taxonId: item.taxon_id ?? 0,
  commonName: item.common_name?.trim() || item.scientific_name,
  commonNames: item.common_names ?? [],
  scientificName: item.scientific_name?.trim() || '',
  description: '',
  imageSource: item.image_source ? { uri: item.image_source } : undefined,
  taxonGroup: item.taxon_group ?? null,
});

const rankRecommendationsForViewport = (
  species: SpeciesSummary[],
  { scores, reasons }: Awaited<ReturnType<typeof fetchViewportScores>>,
) => {
  const sorted = [...species].sort((left, right) => {
    const leftScore = scores[String(left.taxonId)] ?? -1;
    const rightScore = scores[String(right.taxonId)] ?? -1;
    return rightScore - leftScore;
  });
  const scored = sorted.map((item) => withScoreReason(item, reasons));

  const pinnedIds = new Set<number>();
  const pinned = HOMEPAGE_GROUP_ORDER.flatMap((group) => {
    const representative = scored.find((item) => item.taxonGroup === group);
    if (!representative) {
      return [];
    }

    pinnedIds.add(representative.taxonId);
    return [representative];
  });

  const additional = scored.filter(
    (item) =>
      !pinnedIds.has(item.taxonId) &&
      (scores[String(item.taxonId)] ?? 0) >= RECOMMENDATION_SCORE_THRESHOLD,
  );

  return {
    allScored: scored,
    recommendations: [
      ...pinned,
      ...additional.slice(0, MAX_RECOMMENDATIONS - pinned.length),
    ],
  };
};

type RankedRecommendationState = ReturnType<
  typeof rankRecommendationsForViewport
>;

const fetchRankedRecommendationState = async (
  items: SpeciesSummary[],
  bounds: ViewportTileRange,
): Promise<RankedRecommendationState> => {
  return rankRecommendationsForViewport(
    items,
    await fetchViewportScores(bounds),
  );
};

export function useHomeDashboardState(
  data?: HomePageData,
  options?: {
    hydrateRemoteOnMount?: boolean;
    remoteHydrationDelayMs?: number;
    initialActiveGroup?: string;
  },
) {
  const hydrateRemoteOnMount = options?.hydrateRemoteOnMount ?? true;
  const remoteHydrationDelayMs = options?.remoteHydrationDelayMs ?? 0;
  const initialActiveGroup = options?.initialActiveGroup ?? 'all';
  const shouldHydrateFromRemote = data == null && hydrateRemoteOnMount;
  const providedSeedItems = data?.recommendations?.items;
  const seedItems = React.useMemo(
    () => providedSeedItems ?? [],
    [providedSeedItems],
  );
  const [recommendations, setRecommendations] =
    React.useState<SpeciesSummary[]>(seedItems);
  const [allScored, setAllScored] = React.useState<SpeciesSummary[]>(seedItems);
  const [scoresLoading, setScoresLoading] = React.useState(
    () => shouldHydrateFromRemote,
  );
  const [preserveActiveGroupWhileEmpty, setPreserveActiveGroupWhileEmpty] =
    React.useState(() => shouldHydrateFromRemote);
  const [activeGroup, setActiveGroupState] = React.useState(() =>
    normalizeActiveGroup(seedItems, initialActiveGroup, {
      preserveWhenEmpty: shouldHydrateFromRemote,
    }),
  );
  const allSpeciesRef = React.useRef<SpeciesSummary[]>(seedItems);
  const latestBoundsRef = React.useRef<ViewportTileRange | null>(null);
  const rankingRequestIdRef = React.useRef(0);
  const lastAppliedSeedKeyRef = React.useRef(
    buildRecommendationSeedKey(seedItems),
  );
  const sessionStamp = React.useRef(Date.now());
  const scoreRequestRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const applyRecommendationState = React.useCallback(
    (items: SpeciesSummary[]) => {
      allSpeciesRef.current = items;
      setRecommendations(items);
      setAllScored(items);
    },
    [],
  );
  const applyRankedRecommendationState = React.useCallback(
    (items: SpeciesSummary[], ranked: RankedRecommendationState) => {
      allSpeciesRef.current = items;
      setRecommendations(ranked.recommendations);
      setAllScored(ranked.allScored);
    },
    [],
  );
  const beginRankingRequest = React.useCallback(() => {
    rankingRequestIdRef.current += 1;
    return rankingRequestIdRef.current;
  }, []);
  const isLatestRankingRequest = React.useCallback((requestId: number) => {
    return rankingRequestIdRef.current === requestId;
  }, []);

  React.useEffect(() => {
    const nextSeedKey = buildRecommendationSeedKey(seedItems);
    if (lastAppliedSeedKeyRef.current === nextSeedKey) {
      return;
    }

    lastAppliedSeedKeyRef.current = nextSeedKey;
    setPreserveActiveGroupWhileEmpty(false);
    beginRankingRequest();
    setScoresLoading(false);
    applyRecommendationState(seedItems);
    setActiveGroupState((currentGroup) =>
      normalizeActiveGroup(seedItems, currentGroup, {
        preserveWhenEmpty: false,
      }),
    );
  }, [applyRecommendationState, beginRankingRequest, seedItems]);

  React.useEffect(() => {
    const normalizedGroup = normalizeActiveGroup(allScored, activeGroup, {
      preserveWhenEmpty: preserveActiveGroupWhileEmpty,
    });

    if (normalizedGroup !== activeGroup) {
      setActiveGroupState(normalizedGroup);
    }
  }, [activeGroup, allScored, preserveActiveGroupWhileEmpty]);

  React.useEffect(() => {
    if (data != null || !hydrateRemoteOnMount) {
      return;
    }

    let mounted = true;
    const hydrateRemote = async () => {
      try {
        const items = await fetchSpeciesWithModels();
        if (!mounted) {
          return;
        }

        const mappedItems = items.map(mapSpeciesWithModelToSummary);
        const latestBounds = latestBoundsRef.current;

        if (!latestBounds) {
          setPreserveActiveGroupWhileEmpty(false);
          beginRankingRequest();
          setScoresLoading(false);
          applyRecommendationState(mappedItems);
          return;
        }

        const requestId = beginRankingRequest();
        try {
          const ranked = await fetchRankedRecommendationState(
            mappedItems,
            latestBounds,
          );

          if (!mounted || !isLatestRankingRequest(requestId)) {
            return;
          }

          setPreserveActiveGroupWhileEmpty(false);
          applyRankedRecommendationState(mappedItems, ranked);
        } catch {
          if (!mounted || !isLatestRankingRequest(requestId)) {
            return;
          }

          setPreserveActiveGroupWhileEmpty(false);
          applyRecommendationState(mappedItems);
        } finally {
          if (mounted && isLatestRankingRequest(requestId)) {
            setScoresLoading(false);
          }
        }
      } catch (error) {
        console.warn('[useHomeDashboardState] failed to fetch species', error);
        if (mounted) {
          setPreserveActiveGroupWhileEmpty(false);
          setScoresLoading(false);
        }
      }
    };

    const delay = Math.max(0, remoteHydrationDelayMs);
    const timeoutId =
      delay > 0 ? setTimeout(() => void hydrateRemote(), delay) : null;

    if (timeoutId == null) {
      void hydrateRemote();
    }

    return () => {
      mounted = false;
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    applyRankedRecommendationState,
    applyRecommendationState,
    beginRankingRequest,
    data,
    hydrateRemoteOnMount,
    isLatestRankingRequest,
    remoteHydrationDelayMs,
  ]);

  React.useEffect(() => {
    return () => {
      if (scoreRequestRef.current) {
        clearTimeout(scoreRequestRef.current);
      }
    };
  }, []);

  const heatmapTileUrl = React.useMemo(
    () => buildHomepageHeatmapTileUrl(sessionStamp.current, activeGroup),
    [activeGroup],
  );
  const hasActiveFilter = activeGroup !== 'all';
  const setActiveGroup = React.useCallback(
    (group: string) => {
      setActiveGroupState(
        normalizeActiveGroup(allSpeciesRef.current, group, {
          preserveWhenEmpty: preserveActiveGroupWhileEmpty,
        }),
      );
    },
    [preserveActiveGroupWhileEmpty],
  );

  const handleBoundsChange = React.useCallback(
    (bounds: ViewportTileRange) => {
      if (areViewportBoundsEqual(latestBoundsRef.current, bounds)) {
        return;
      }

      latestBoundsRef.current = bounds;
      const requestId = beginRankingRequest();

      if (scoreRequestRef.current) {
        clearTimeout(scoreRequestRef.current);
      }

      setScoresLoading(true);
      scoreRequestRef.current = setTimeout(async () => {
        const speciesSnapshot = allSpeciesRef.current;
        try {
          const ranked = await fetchRankedRecommendationState(
            speciesSnapshot,
            bounds,
          );

          if (!isLatestRankingRequest(requestId)) {
            return;
          }

          applyRankedRecommendationState(speciesSnapshot, ranked);
        } catch {
          // Keep the current ordering when viewport scoring is unavailable.
        } finally {
          if (isLatestRankingRequest(requestId)) {
            setScoresLoading(false);
          }
        }
      }, SCORE_DEBOUNCE_MS);
    },
    [
      applyRankedRecommendationState,
      beginRankingRequest,
      isLatestRankingRequest,
    ],
  );

  return {
    activeGroup,
    allScored,
    hasActiveFilter,
    heatmapTileUrl,
    handleBoundsChange,
    recommendations,
    scoresLoading,
    setActiveGroup,
  };
}
