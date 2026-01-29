import {
  InlineExpandableRows,
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesOccurrences } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { LocationSearchResult, SpeciesOccurrence, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { SelectField } from '@/components/inputs/SelectField';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

type LocationPreset = {
  id: string;
  label: string;
  bbox: [number, number, number, number];
};
//continent priority for overlapping bounding boxes
const CONTINENT_PRIORITY = [
  'europe',
  'africa',
  'asia',
  'north-america',
  'south-america',
  'oceania',
];

const LOCATION_PRESETS: LocationPreset[] = [
  { id: 'world', label: 'World', bbox: [-90, -180, 90, 180] },
  { id: 'north-america', label: 'North America', bbox: [7, -168, 83, -52] },
  { id: 'south-america', label: 'South America', bbox: [-56, -82, 14, -34] },
  { id: 'europe', label: 'Europe', bbox: [37, -25, 72, 60] },
  { id: 'asia', label: 'Asia', bbox: [0, 30, 81, 180] },
  { id: 'africa', label: 'Africa', bbox: [-35, -20, 37, 52] },
  { id: 'oceania', label: 'Oceania', bbox: [-50, 110, 0, -110] },
];
// handles bounding boxes that cross the antimeridian (minLon > maxLon)
const pointInBBox = (
  lat: number,
  lon: number,
  bbox: [number, number, number, number],
) => {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  // latitude straightforward
  if (lat < minLat || lat > maxLat) return false;

  // handle longitude wrap-around: if minLon <= maxLon, normal comparison.
  // if minLon > maxLon the bbox crosses the antimeridian (e.g. [ -50, 110, 0, -110 ])
  if (minLon <= maxLon) {
    return lon >= minLon && lon <= maxLon;
  }
  // wrap-around case: lon is >= minLon OR lon <= maxLon
  return lon >= minLon || lon <= maxLon;
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const { taxonId, commonName, scientificName, overview, dataSections, nearbySpecies, heatmap } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [occurrenceLoading, setOccurrenceLoading] = React.useState(false);
  const [occurrenceError, setOccurrenceError] = React.useState<string | null>(null);
  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);
  const [selectedLocation, setSelectedLocation] = React.useState<LocationSearchResult | null>(null);

  const [selectedContinentId, setSelectedContinentId] = React.useState<string>('world');
  const locationGid = selectedLocation?.gid ?? null;

  const continentOptions = React.useMemo(
    () => LOCATION_PRESETS.map((p) => ({ label: p.label, value: p.id })),
    [],
  );
  React.useEffect(() => {
    let cancelled = false;
    if (!taxonId) {
      setOccurrences([]);
      setOccurrenceError('No taxon ID supplied.');
      return () => {
        cancelled = true;
      };
    }
    setOccurrenceLoading(true);
    setOccurrenceError(null);
    (async () => {
      try {
        const rows = await fetchSpeciesOccurrences(taxonId, {
          location: locationGid ?? undefined,
        });
        if (!cancelled) {
          setOccurrences(rows);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load observations.';
          setOccurrenceError(message);
          setOccurrences([]);
        }
      } finally {
        if (!cancelled) {
          setOccurrenceLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonId, locationGid]);

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [locationGid]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  // returns the first continent id whose bbox contains the given point
const assignContinentForPoint = (lat: number, lon: number): string => {
  for (const id of CONTINENT_PRIORITY) {
    const preset = LOCATION_PRESETS.find((p) => p.id === id);
    if (!preset) continue;
    if (pointInBBox(lat, lon, preset.bbox)) {
      return id;
    }
  }
  // fallback
  return 'world';
};
  const filteredOccurrences = React.useMemo(() => {
    if (!occurrences || occurrences.length === 0) return [];
    if (selectedContinentId === 'world') {
      return occurrences;
  }
    const assigned = occurrences.map((o) => {
    if (typeof o.latitude !== 'number' || typeof o.longitude !== 'number') {
      return { o, continent: 'world' as string };
    }
    const continent = assignContinentForPoint(o.latitude, o.longitude);
    return { o, continent };
  });

  // Return only points whose assigned continent matches the selected continent
  return assigned
    .filter((entry) => entry.continent === selectedContinentId)
    .map((entry) => entry.o);
  }, [occurrences, selectedContinentId]);

  return (
    <>
      <Head>
        <title>{`WhereWild | ${commonName}`}</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
        <PageHeader />

        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <SpeciesPageHeader
            commonName={commonName}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <View style={styles.overviewSection}>
                <View style={styles.overviewText}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">{overview.description}</ThemedText>
                </View>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={overview.imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${commonName} featured image`}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <InlineExpandableRows sections={dataSections} />
            </View>
          </View>
          <NearbySpeciesCarousel species={nearbySpecies} />

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View style={[styles.sectionContent,{ maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
                <ThemedText variant="heading">Observation Map</ThemedText>
                <View style={{ marginTop: 8, marginBottom: 12 }}>
                  <SelectField
                    label="Region (continent)"
                    placeholder="Select a region"
                    options={continentOptions}
                    value={selectedContinentId}
                    onValueChange={(v) => {
                      setSelectedContinentId(v);
                      setHighlightedCatalogs([]);
                    }}
                  />
                </View>
                <SpeciesOccurrenceMap
                  occurrences={filteredOccurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                />
              </View>
            </View>
          )}

          <View style={styles.heatMapSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            <Image
              source={heatmap.imageSource}
              resizeMode="cover"
              style={styles.heatmap}
              accessibilityLabel="Predicted sightings heat map"
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
  content: {
    width: '100%',
    paddingTop: Size.space['800'],
    gap: Size.space['800'],
  },
  centeredSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['800'],

  },
  overviewSection: {
    flexDirection: 'row',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  overviewText: {
    flex: 1,
    minWidth: 280,
    gap: Size.space['200'],
  },
  featuredImageWrapper: {
    flex: 1,
    minWidth: 280,
    maxWidth: 600,
  },
  featuredImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Size.radius['400'],
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
  heatmap: {
    width: '100%',
    aspectRatio: 1440 / 810,
  },
});
