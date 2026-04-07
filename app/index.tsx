import { ActiveNearYouSection, LocalMapSection } from '@/components';
import { Colors } from '@/constants/theme';
import { fetchSpeciesWithModels, fetchViewportScores, BACKEND_BASE } from '@/data/api';
import type { ViewportScoresResult } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData, SpeciesApiNormalized, SpeciesSummary } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle, getResponsiveGapStyle } from '@/constants/responsiveStyles';
import Head from 'expo-router/head';
import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

const SIDEBAR_WIDTH = 400;
const SCORE_DEBOUNCE_MS = 1200;
const RECOMMENDATION_SCORE_THRESHOLD = 0.25;
const MAX_RECOMMENDATIONS = 10;
const HOMEPAGE_GROUP_ORDER = ['arthropods', 'birds', 'animals', 'fungi', 'plants'] as const;

type ViewportBounds = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
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
  reasons: ViewportScoresResult['reasons'],
): SpeciesSummary => {
  const description = formatReasonDescription(reasons[String(item.taxonId)]);
  return description ? { ...item, description } : item;
};

const buildHomepageHeatmapTileUrl = (sessionStamp: number, group: string | null) => {
  const groupParam = group && group !== 'all' ? `&group=${group}` : '';
  return `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=${sessionStamp}${groupParam}`;
};

const buildRecommendationSeedKey = (items: SpeciesSummary[]) =>
  items
    .map((item) => [
      item.taxonId,
      item.commonName,
      item.scientificName,
      item.description,
      item.taxonGroup ?? '',
    ].join(':'))
    .join('|');

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
  { scores, reasons }: ViewportScoresResult,
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
      !pinnedIds.has(item.taxonId)
      && (scores[String(item.taxonId)] ?? 0) >= RECOMMENDATION_SCORE_THRESHOLD,
  );

  return {
    allScored: scored,
    recommendations: [...pinned, ...additional.slice(0, MAX_RECOMMENDATIONS - pinned.length)],
  };
};

export default function HomeScreen({ data }: { data?: HomePageData } = {}) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const providedSeedItems = data?.recommendations?.items;
  const seedItems = providedSeedItems ?? mockHomePageData.recommendations.items;
  const [recommendations, setRecommendations] = React.useState<SpeciesSummary[]>(seedItems);
  const [allScored, setAllScored] = React.useState<SpeciesSummary[]>(seedItems);
  const [scoresLoading, setScoresLoading] = React.useState(false);
  const [heatmapGroup, setHeatmapGroup] = React.useState<string | null>(null);
  const allSpeciesRef = React.useRef<SpeciesSummary[]>(seedItems);
  const lastAppliedSeedKeyRef = React.useRef(buildRecommendationSeedKey(seedItems));
  const sessionStamp = React.useRef(Date.now());
  const heatmapTileUrl = React.useMemo(
    () => buildHomepageHeatmapTileUrl(sessionStamp.current, heatmapGroup),
    [heatmapGroup],
  );
  const scoreRequestRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRecommendationState = React.useCallback((items: SpeciesSummary[]) => {
    allSpeciesRef.current = items;
    setRecommendations(items);
    setAllScored(items);
  }, []);

  React.useEffect(() => {
    const nextSeedKey = buildRecommendationSeedKey(seedItems);
    if (lastAppliedSeedKeyRef.current === nextSeedKey) {
      return;
    }

    lastAppliedSeedKeyRef.current = nextSeedKey;
    applyRecommendationState(seedItems);
  }, [applyRecommendationState, seedItems]);

  React.useEffect(() => {
    if (data != null) return; // seeded via data prop, skip fetch
    let mounted = true;
    (async () => {
      try {
        const items = await fetchSpeciesWithModels();
        if (!mounted) return;
        applyRecommendationState(items.map(mapSpeciesWithModelToSummary));
      } catch (e) {
        console.warn('[HomeScreen] failed to fetch species with models', e);
      }
    })();
    return () => { mounted = false; };
  }, [applyRecommendationState, data]);

  React.useEffect(() => {
    return () => {
      if (scoreRequestRef.current) {
        clearTimeout(scoreRequestRef.current);
      }
    };
  }, []);

  const handleBoundsChange = React.useCallback((bounds: ViewportBounds) => {
    if (scoreRequestRef.current) {
      clearTimeout(scoreRequestRef.current);
    }
    setScoresLoading(true);
    scoreRequestRef.current = setTimeout(async () => {
      try {
        const ranked = rankRecommendationsForViewport(
          allSpeciesRef.current,
          await fetchViewportScores(bounds),
        );
        setRecommendations(ranked.recommendations);
        setAllScored(ranked.allScored);
      } catch {
        // Keep the current ordering when viewport scoring is unavailable.
      } finally {
        setScoresLoading(false);
      }
    }, SCORE_DEBOUNCE_MS);
  }, []);

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | Home</title>
        </Head>
      ) : null}
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
          bounces={false}
        >
          <View style={[styles.layout, getResponsiveGapStyle(responsive)]}>
            <LocalMapSection
              heatmapTileUrl={heatmapTileUrl}
              onBoundsChange={handleBoundsChange}
              style={styles.mapSection}
            />

            <ActiveNearYouSection
              recommendations={recommendations}
              allRecommendations={allScored}
              loading={scoresLoading}
              activeGroup={heatmapGroup ?? 'all'}
              onGroupChange={setHeatmapGroup}
              style={styles.sidebar}
            />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  layout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  mapSection: {
    flex: 1,
    minWidth: 320,
  },
  sidebar: {
    flexBasis: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
  },
});
