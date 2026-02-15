import type { ImageSourcePropType } from 'react-native';

export type SpeciesIdentifiers = {
  taxonId: number;
  scientificName: string;
  commonName: string;
};

/**
 * Shared data contracts for hooking the WhereWild UI up to real APIs.
 * These interfaces deliberately avoid importing component props so the same
 * objects can be reused on the client, in tests, or by API clients.
 */

/**
 * Minimal description of a species that can be rendered in cards or lists.
 */
export type SpeciesSummary = SpeciesIdentifiers & {
  description: string;
  imageSource?: ImageSourcePropType;
  commonNames?: string[];
};

/**
 * Static map snapshot assets used on the home page.
 */
export type MapSnapshot = {
  heatmapImage: ImageSourcePropType;
  controlsImage: ImageSourcePropType;
};

/**
 * Home screen payload describing featured map data and nearby species recommendations.
 */
export type HomePageData = {
  map: MapSnapshot;
  recommendations: {
    items: SpeciesSummary[];
  };
};

/**
 * Detail rows that appear inside InlineExpandableRows sections.
 */
export type EnvironmentalDataDetail = {
  label: string;
  value: string;
};

export type EnvironmentalDataEntry = {
  dataName: string;
  dataPoint: string;
  details?: EnvironmentalDataDetail[];
  /**
   * If true, this entry can be expanded to reveal additional details (e.g., a list of EnvironmentalDataDetail rows).
   * Use when the entry has more information that should be hidden by default and shown on user interaction.
   *
   * If true, the UI will render an expand/collapse control for this entry.
   */
  expandable?: boolean;
  /**
   * If true, a graph visualization (e.g., chart or plot) should be rendered for this entry.
   * Use when the dataPoint represents a value that benefits from graphical representation.
   *
   * This flag is independent of `expandable`; both can be true, false, or set individually.
   * If both are true, the UI should render both the expand/collapse control and the graph.
   */
  showGraph?: boolean;
};

/**
 * Environmental data sections relevant to this species.
 * Each section contains a title and a list of environmental data entries.
 */
export type EnvironmentalDataSection = {
  title: string;
  entries: EnvironmentalDataEntry[];
};

/**
 * Hero copy shown at the top of the species page.
 */
export type SpeciesOverview = {
  description: string;
  descriptionProfile?: SpeciesDescriptionProfile | null;
  imageSource: ImageSourcePropType;
  imageLicense?: string;
  imageCreator?: string;
  imageRightsHolder?: string;
  imageReferences?: string;
};

export type SpeciesDescriptionCategory = {
  category: string;
  notable: boolean;
  level?: string | null;
  detail?: string | null;
  variable_id?: string;
  metric?: string;
  direction?: string;
  percentile?: number;
  context_count?: number;
};

export type SpeciesDescriptionLine = {
  prefix?: string | null;
  body: string;
  parts?: SpeciesDescriptionPart[];
};

export type SpeciesDescriptionPart = {
  text: string;
  role?: 'descriptor' | 'group' | 'plain';
  color?: string;
};

export type SpeciesDescriptionSection = {
  id: string;
  title: string;
  lines: SpeciesDescriptionLine[];
};

export type SpeciesDescriptionProfile = {
  summary?: string;
  habitat?: string | null;
  climate?: string | null;
  locations?: string | null;
  categories?: SpeciesDescriptionCategory[];
  sections?: SpeciesDescriptionSection[];
  text?: string;
};

export type HeatmapSnapshot = {
  imageSource: ImageSourcePropType;
};

export type SpeciesOccurrence = {
  catalogNumber: number | string;
  latitude: number;
  longitude: number;
};

export type LocationSearchResult = {
  gid: string;
  name: string;
  level: number;
  hierarchy: string[];
};

/**
 * Full payload required to render the species detail page.
 */
export type SpeciesPageData = SpeciesSummary & {
  overview: SpeciesOverview;
  dataSections: EnvironmentalDataSection[];
  nearbySpecies: SpeciesSummary[];
  heatmap: HeatmapSnapshot;
  taxonomyPath?: string | null;
};

export type SpeciesEnvironmentSummary = {
  count: number;
  min: number | null;
  mean: number | null;
  max: number | null;
  stddev?: number | null;
  q01?: number | null;
  q10?: number | null;
  q90?: number | null;
  q99?: number | null;
};

export type SpeciesEnvironmentHistogram = {
  bins: number[];
  counts: number[];
};

export type SpeciesEnvironmentBinSample = {
  index: number;
  observationIds: Array<number | string>;
};

export type SpeciesEnvironmentDensity = {
  points: number[];
  density: number[];
};

export type SpeciesEnvironmentObservation = {
  catalogNumber: number | string;
  value?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type SpeciesOccurrence = {
  catalogNumber: number | string;
  latitude: number;
  longitude: number;
};

export type LocationSearchResult = {
  gid: string;
  name: string;
  level: number;
  hierarchy: string[];
};

export type SpeciesEnvironmentSliceResponse = {
  speciesId: number;
  variable: string;
  range: { min: number; max: number };
  limit: number | null;
  count: number;
  observations: SpeciesEnvironmentObservation[];
};

export type SpeciesEnvironmentCategory = {
  value: number | string;
  className: string;
  description?: string | null;
  count: number;
  fraction: number;
};

export type SpeciesEnvironmentCategorySamples = {
  value: number | string;
  observationIds: Array<number | string>;
};

export type SpeciesEnvironmentCategoricalTotals = {
  totalSamples?: number;
  uniqueClasses?: number;
  significantUniqueClasses?: number;
};

export type SpeciesEnvironmentCategorySampleResponse = {
  speciesId: number;
  variable: string;
  classValue: number | string;
  observations: SpeciesEnvironmentObservation[];
  count: number;
};

export type SpeciesEnvironmentRelativeRank = {
  metric: string;
  label?: string | null;
  rank?: number | null;
  count?: number | null;
  percentile?: number | null;
  context?: string | null;
};

export type SpeciesEnvironmentStats = {
  speciesId: number;
  variable: string;
  variableName: string;
  units?: string | null;
  variableType?: string | null;
  generatedAt?: string;
  summary: SpeciesEnvironmentSummary;
  histogram: SpeciesEnvironmentHistogram | null;
  densityCurve?: SpeciesEnvironmentDensity | null;
  binSamples?: SpeciesEnvironmentBinSample[];
  categoricalDistribution?: SpeciesEnvironmentCategory[];
  dominantCategories?: SpeciesEnvironmentCategory[];
  categoricalSamples?: SpeciesEnvironmentCategorySamples[];
  relativeRanks?: SpeciesEnvironmentRelativeRank[];
  baselineSummary?: SpeciesEnvironmentSummary | null;
  baselineCategoricalDistribution?: SpeciesEnvironmentCategory[];
  baselineCategoricalTotals?: SpeciesEnvironmentCategoricalTotals | null;
};

export type EnvironmentVariableDefinition = {
  id: string;
  name?: string;
  units?: string | null;
  description?: string | null;
  valueType?: string | null;
  category?: string | null;
};

export type EnvironmentSliceParams = {
  taxonId: number | string;
  variableId: string;
  min: number;
  max: number;
  limit?: number;
  location?: string | null;
};

export type RelativeRankingEntry = {
  taxonId: number | string;
  scientificName?: string | null;
  commonName?: string | null;
  imageSource?: ImageSourcePropType;
  rank?: string | null;
  value: number | null;
  position: number;
  percentile?: number | null;
  count: number;
  sampleCount?: number | null;
};

export type RelativeRankingOption = {
  variable: string;
  metric: string;
  column: string;
  count: number;
};

export type RelativeRankingResponse = {
  ancestorTaxonId: number;
  rank: string;
  variable: string;
  metric: string;
  total: number;
  limit: number;
  order?: 'asc' | 'desc';
  minSamples?: number;
  includeSpeciesLike?: boolean;
  entries: RelativeRankingEntry[];
  distribution?: SpeciesEnvironmentDensity | null;
};

export type RelativeRankingOptionsResponse = {
  ancestorTaxonId: number;
  rank: string;
  options: RelativeRankingOption[];
};
