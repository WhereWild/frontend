import {
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesEnvironmentSection,
  SpeciesLocationPicker,
  SpeciesOccurrenceMap,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { BACKEND_BASE, fetchSpeciesByTaxonId, fetchSpeciesOccurrences } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type {
  LocationSearchResult,
  SpeciesDescriptionCategory,
  SpeciesDescriptionLine,
  SpeciesDescriptionProfile,
  SpeciesDescriptionSection,
  SpeciesOccurrence,
  SpeciesPageData,
} from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, View } from 'react-native';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

const toTitleCase = (value: string) => value
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCategoryDetail = (row: SpeciesDescriptionCategory): string => {
  if (!row.notable) {
    return 'Not notable';
  }
  const detail = (row.detail || '').trim();
  if (detail.length > 0) {
    return detail.replace(/\.$/, '');
  }
  return 'Notable';
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const {
    taxonId,
    commonName,
    commonNames,
    scientificName,
    overview,
    nearbySpecies,
  } = data;
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
  const locationGid = selectedLocation?.gid ?? null;
  const [descriptionOverride, setDescriptionOverride] = React.useState<string | null>(null);
  const [descriptionProfileOverride, setDescriptionProfileOverride] =
    React.useState<SpeciesDescriptionProfile | null>(null);
  const heatmapTileUrl = React.useMemo(() => {
    if (!taxonId) {
      return null;
    }
    const encodedTaxonId = encodeURIComponent(String(taxonId));
    // Added cache buster for debugging - remove for production
    return `${BACKEND_BASE}/sdm/tiles/${encodedTaxonId}/{z}/{x}/{y}.png?model_id=stub_sum&reproject=true&max_native_zoom=12&_cb=${Date.now()}`;
  }, [taxonId]);

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

  React.useEffect(() => {
    let cancelled = false;
    if (!taxonId) {
      setDescriptionOverride(null);
      setDescriptionProfileOverride(null);
      return () => {
        cancelled = true;
      };
    }
    if (!locationGid) {
      setDescriptionOverride(null);
      setDescriptionProfileOverride(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const response = await fetchSpeciesByTaxonId(taxonId, { location: locationGid });
        if (!cancelled) {
          setDescriptionOverride(response?.description ?? null);
          setDescriptionProfileOverride(response?.description_profile ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setDescriptionOverride(null);
          setDescriptionProfileOverride(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonId, locationGid]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const handleHighlightsChange = React.useCallback((catalogNumbers: Array<number | string>) => {
    setHighlightedCatalogs(catalogNumbers);
  }, []);

  const overviewDescription = descriptionOverride ?? overview.description;
  const overviewProfile = descriptionProfileOverride
    ?? (locationGid ? null : (overview.descriptionProfile ?? null));
  const categoryRows = Array.isArray(overviewProfile?.categories)
    ? overviewProfile.categories
    : [];
  const imageReferenceUrl = typeof overview.imageReferences === 'string'
    ? overview.imageReferences
    : null;
  const showProfileBlocks = Boolean(
    overviewProfile
    && (
      (Array.isArray(overviewProfile.sections) && overviewProfile.sections.length > 0)
      || (
      overviewProfile.habitat
      || overviewProfile.climate
      || overviewProfile.locations
      || categoryRows.length > 0
      )
    ),
  );
  const profileContextSuffix = selectedLocation?.name
    ? ` in ${selectedLocation.name}`
    : '';
  const profileSections = React.useMemo(() => {
    const backendSections = Array.isArray(overviewProfile?.sections)
      ? overviewProfile.sections
      : [];
    if (backendSections.length > 0) {
      return backendSections
        .filter((section): section is SpeciesDescriptionSection => Boolean(section && section.title))
        .map((section) => ({
          title: section.title,
          lines: Array.isArray(section.lines)
            ? section.lines.filter(
              (line): line is SpeciesDescriptionLine => Boolean(line && line.body),
            )
            : [],
        }))
        .filter((section) => section.lines.length > 0);
    }

    const sections: Array<{ title: string; lines: SpeciesDescriptionLine[] }> = [];
    const pushSection = (title: string, value: string | null | undefined) => {
      if (!value) {
        return;
      }
      const body = value.trim();
      if (body.length === 0) {
        return;
      }
      sections.push({ title, lines: [{ prefix: null, body }] });
    };

    pushSection(`Habitat${profileContextSuffix}`, overviewProfile?.habitat ?? null);
    pushSection(`Climates${profileContextSuffix}`, overviewProfile?.climate ?? null);
    pushSection('Locations', overviewProfile?.locations ?? null);
    for (const row of categoryRows) {
      pushSection(toTitleCase(row.category || 'other'), formatCategoryDetail(row));
    }
    return sections;
  }, [
    categoryRows,
    overviewProfile?.climate,
    overviewProfile?.habitat,
    overviewProfile?.locations,
    overviewProfile?.sections,
    profileContextSuffix,
  ]);

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
            commonNames={commonNames}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <View style={styles.overviewSection}>
                <View style={styles.overviewText}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">
                    {overviewProfile?.summary ?? overviewDescription}
                  </ThemedText>
                  {showProfileBlocks && (
                    <View style={styles.descriptionProfile}>
                      {profileSections.map((section, sectionIndex) => (
                        <View
                          key={`${section.title}-${sectionIndex}`}
                          style={[
                            styles.profileSection,
                            {
                              backgroundColor: palette.background.default.secondary,
                              borderLeftColor: palette.border.brand.default,
                              borderColor: palette.border.default.secondary,
                            },
                          ]}
                        >
                          <ThemedText
                            variant="bodySmallStrong"
                            style={[
                              styles.profileSectionHeading,
                              { color: palette.text.brand.default },
                            ]}
                          >
                            {section.title}
                          </ThemedText>
                          <View style={styles.profileSectionLines}>
                            {section.lines.map((line, lineIndex) => (
                              <ThemedText
                                key={`${section.title}-${sectionIndex}-${lineIndex}`}
                                variant="bodySmall"
                              >
                                {line.prefix ? (
                                  <>
                                    <ThemedText
                                      variant="bodySmall"
                                      style={styles.frequencyPrefix}
                                    >
                                      {line.prefix}
                                    </ThemedText>
                                    {' '}
                                  </>
                                ) : null}
                                {Array.isArray(line.parts) && line.parts.length > 0
                                  ? line.parts.map((part, partIndex) => {
                                    const fallback = part.role === 'descriptor'
                                      ? palette.text.default.secondary
                                      : part.role === 'group'
                                        ? palette.text.brand.tertiary
                                        : palette.text.default.default;
                                    const color = part.color ?? fallback;
                                    return (
                                      <ThemedText
                                        key={`${section.title}-${sectionIndex}-${lineIndex}-${partIndex}`}
                                        variant="bodySmall"
                                        style={[
                                          part.role === 'descriptor'
                                            ? styles.descriptorPart
                                            : part.role === 'group'
                                              ? styles.groupPart
                                              : null,
                                          { color },
                                        ]}
                                      >
                                        {part.text}
                                      </ThemedText>
                                    );
                                  })
                                  : line.body}
                              </ThemedText>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={overview.imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${commonName} featured image`}
                  />
                  {(overview.imageCreator || overview.imageLicense || overview.imageReferences) && (
                    <View style={styles.imageAttribution}>
                      {overview.imageCreator && (
                        <ThemedText
                          variant="bodySmall"
                          style={styles.licenseText}
                        >
                          Photo by {overview.imageCreator}
                        </ThemedText>
                      )}
                      {imageReferenceUrl && (
                        <ThemedText
                          variant="bodySmall"
                          style={styles.attributionLink}
                          onPress={() => Linking.openURL(imageReferenceUrl)}
                        >
                          View on iNaturalist
                        </ThemedText>
                      )}
                      {overview.imageLicense && (
                        <ThemedText variant="bodySmall" style={styles.licenseText}>
                          {overview.imageLicense}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          <NearbySpeciesCarousel species={nearbySpecies} />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <SpeciesLocationPicker
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            </View>
          </View>

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <SpeciesEnvironmentSection
                taxonId={taxonId}
                onHighlightChange={handleHighlightsChange}
                locationGid={locationGid}
                locationName={selectedLocation?.name ?? null}
              />
            </View>
          </View>

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
              >
                <ThemedText variant="heading">Observation Map</ThemedText>
                <SpeciesOccurrenceMap
                  occurrences={occurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                />
              </View>
            </View>
          )}

          <View style={styles.heatMapSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <ThemedText variant="heading">Heat Map</ThemedText>
              <SpeciesOccurrenceMap
                occurrences={occurrences}
                loading={false}
                error={null}
                heatmapTileUrl={heatmapTileUrl}
                heatmapOpacity={0.82}
                showMarkers={false}
              />
            </View>
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
  descriptionProfile: {
    gap: Size.space['150'],
  },
  profileSection: {
    gap: Size.space['100'],
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['150'],
    paddingVertical: Size.space['100'],
  },
  profileSectionHeading: {
    letterSpacing: 0.2,
  },
  profileSectionLines: {
    gap: Size.space['100'],
  },
  frequencyPrefix: {
    textDecorationLine: 'underline',
  },
  descriptorPart: {
    opacity: 0.92,
  },
  groupPart: {
    opacity: 0.94,
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
  imageAttribution: {
    marginTop: Size.space['100'],
    gap: Size.space['50'],
  },
  licenseText: {
    opacity: 0.7,
  },
  attributionLink: {
    color: Colors.light.text.brand.default,
    textDecorationLine: 'underline',
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
});
