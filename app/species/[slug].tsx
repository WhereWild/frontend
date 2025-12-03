import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import SpeciesPage from '../_speciesPage';
import { fetchSpeciesBySlug } from '@/data/api';
import type { SpeciesPageData } from '@/data/types';
import { mountainBallCactusData } from '@/data/speciesSample';

type SpeciesBasics = {
  common_name?: string;
  scientific_name?: string;
  image_source?: ImageSourcePropType | string;
  image_url?: string;
  description?: string;
};

const normalizeImageSource = (payload: SpeciesBasics): ImageSourcePropType | undefined => {
  if (payload.image_source) {
    return typeof payload.image_source === 'string'
      ? { uri: payload.image_source }
      : payload.image_source;
  }

  if (payload.image_url) {
    return { uri: payload.image_url };
  }

  return undefined;
};

const buildSpeciesPageData = (
  payload: SpeciesBasics,
  slug: string | undefined,
): SpeciesPageData => {
  const fallback = mountainBallCactusData;
  // When the API starts returning environmental sections, nearby species, or heatmap snapshots,
  // extend `SpeciesBasics` and override `dataSections`, `nearbySpecies`, and `heatmap` here so
  // SpeciesPage renders fully dynamic content instead of falling back to sample data.
  return {
    ...fallback,
    id: slug ?? fallback.id,
    commonName: payload.common_name ?? fallback.commonName,
    scientificName: payload.scientific_name ?? fallback.scientificName,
    overview: {
      ...fallback.overview,
      description: payload.description ?? fallback.overview.description,
      imageSource: normalizeImageSource(payload) ?? fallback.overview.imageSource,
    },
  };
};

export default function SpeciesBasicsPage() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const slugParam = typeof slug === 'string' ? slug : undefined;

  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      if (!slugParam) {
        setLoading(false);
        console.error('Missing species identifier');
        return;
      }

      setLoading(true);

      try {
        const response = await fetchSpeciesBySlug(slugParam);
        if (!mounted) {
          return;
        }
        setData(response ?? null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load species';
        console.error(`Failed to load species '${slugParam}':`, message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slugParam]);

  if (loading && !data) {
    return null;
  }

  const resolvedPageData = data
    ? buildSpeciesPageData(data, slugParam)
    : mountainBallCactusData;

  return <SpeciesPage data={resolvedPageData} />;
}