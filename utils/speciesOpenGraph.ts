import { toKebabCase } from '@/utils/string';
import {
  normalizeMetadataPath,
  renderMetadataHtmlDocument,
} from '@/utils/webMetadata';

export type SpeciesOpenGraphPayload = {
  common_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  scientific_name?: string | null;
  slug?: string | null;
  taxon_id?: number | string | null;
};

const BOT_USER_AGENT_PATTERN =
  /bot|discordbot|slackbot|twitterbot|whatsapp|telegrambot|linkedinbot|embedly|facebookexternalhit|facebot|pinterest|googlebot|bingbot|duckduckbot/i;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isCrawlerUserAgent = (userAgent: string | null) =>
  typeof userAgent === 'string' && BOT_USER_AGENT_PATTERN.test(userAgent);

export const parseSpeciesPath = (pathname: string) => {
  const match = /^\/species\/(\d+)(?:\/([^/?#]+))?\/?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return {
    slug: match[2] ?? null,
    taxonId: match[1],
  };
};

export const buildSpeciesPath = ({
  commonName,
  scientificName,
  slug,
  taxonId,
}: {
  commonName?: string | null;
  scientificName?: string | null;
  slug?: string | null;
  taxonId: string | number;
}) => {
  const resolvedSlug =
    (isNonEmptyString(slug) && slug.trim()) ||
    toKebabCase(commonName || scientificName || '');

  return resolvedSlug
    ? `/species/${taxonId}/${resolvedSlug}`
    : `/species/${taxonId}`;
};

export const buildSpeciesMetadataFields = (
  payload: SpeciesOpenGraphPayload,
  {
    fallbackTaxonId,
    path,
  }: {
    fallbackTaxonId: string;
    path?: string;
  },
) => {
  const commonName =
    (isNonEmptyString(payload.common_name) && payload.common_name.trim()) ||
    'Species';
  const scientificName =
    (isNonEmptyString(payload.scientific_name) &&
      payload.scientific_name.trim()) ||
    '';
  const title = scientificName
    ? `WhereWild | ${commonName} (${scientificName})`
    : `WhereWild | ${commonName}`;
  const description =
    (isNonEmptyString(payload.description) && payload.description.trim()) ||
    `Explore habitat context, observations, and predictive maps for ${commonName}.`;
  const imageUrl =
    isNonEmptyString(payload.image_url) &&
    /^https?:\/\//i.test(payload.image_url)
      ? payload.image_url.trim()
      : undefined;
  const resolvedPath = isNonEmptyString(path)
    ? normalizeMetadataPath(path)
    : buildSpeciesPath({
        commonName,
        scientificName,
        slug: payload.slug,
        taxonId:
          (isNonEmptyString(payload.taxon_id) && payload.taxon_id.trim()) ||
          payload.taxon_id ||
          fallbackTaxonId,
      });

  return {
    description,
    imageUrl,
    path: resolvedPath,
    title,
  };
};

export const renderSpeciesOpenGraphHtml = ({
  noindex,
  origin,
  path,
  payload,
  taxonId,
}: {
  origin: string;
  path?: string;
  noindex?: boolean;
  payload: SpeciesOpenGraphPayload;
  taxonId: string;
}) => {
  const metadata = buildSpeciesMetadataFields(payload, {
    fallbackTaxonId: taxonId,
    path,
  });

  return renderMetadataHtmlDocument({
    ...metadata,
    noindex,
    origin,
    type: 'article',
  });
};

export const __SPECIES_OPEN_GRAPH_TESTING__ = {
  buildSpeciesMetadataFields,
  buildSpeciesPath,
  isCrawlerUserAgent,
  parseSpeciesPath,
  renderSpeciesOpenGraphHtml,
};
