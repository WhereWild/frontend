import type { ImageSourcePropType } from 'react-native';

export type SpeciesIdentifiers = {
  taxonId: number;
  scientificName: string;
  commonName: string;
  commonNames: string[];
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
  taxonGroup?: string | null;
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
 * Hero copy shown at the top of the species page.
 */
export type SpeciesOverview = {
  description: string;
  sections?: SpeciesOverviewSection[];
  imageSource: ImageSourcePropType;
  imageLicense?: string;
  imageCreator?: string;
  imageRightsHolder?: string;
  imageReferences?: string;
};

export type SpeciesOverviewLine = {
  prefix?: string;
  body: string;
};

export type SpeciesOverviewSection = {
  id: string;
  title: string;
  lines: SpeciesOverviewLine[];
};

export type HeatmapSnapshot = {
  imageSource: ImageSourcePropType;
  liveAvailable?: boolean;
  liveTileUrl?: string | null;
  liveModelId?: string | null;
  phenologyAvailable?: boolean;
  fullAvailable?: boolean;
};

/**
 * Full payload required to render the species detail page.
 */
export type SpeciesPageData = SpeciesSummary & {
  overview: SpeciesOverview;
  nearbySpecies: SpeciesSummary[];
  heatmap: HeatmapSnapshot;
  taxonomyPath?: string | null;
  allObscured?: boolean;
  taxonRank?: string | null;
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
  circular_mean?: number | null;
  rbar?: number | null;
  circular_std?: number | null;
  unique_classes?: number | null;
  entropy?: number | null;
  mode?: number | string | null;
};

export type SpeciesEnvironmentHistogram = {
  bins: number[];
  counts: number[];
};

export type SpeciesEnvironmentBinSample = {
  index: number;
  observationIds: (number | string)[];
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

export type SpeciesOccurrencesResult = {
  occurrences: SpeciesOccurrence[];
  minTimestamp: number | null;
  maxTimestamp: number | null;
  phenologyCounts: Record<string, number> | null;
};

export type LocationSearchResult = {
  gid: string;
  name: string;
  level: number;
  hierarchy: string[];
};

export type LocationHierarchyEntry = {
  gid: string;
  name: string;
  level: number;
};

export type LocationDetail = LocationSearchResult & {
  parent_gid: string | null;
  ancestors: LocationHierarchyEntry[];
};

export type SpeciesApiNormalized = {
  taxon_id: number | null;
  scientific_name: string;
  common_name: string;
  common_names: string[];
  image_source: string | null;
  taxon_group?: string | null;
  taxon_rank?: string | null;
  _raw: unknown;
};

export type SpeciesApiDetail = SpeciesApiNormalized & {
  description: string;
  description_sections?: SpeciesOverviewSection[];
  image_license?: string | null;
  image_creator?: string | null;
  image_rights_holder?: string | null;
  image_references?: string | null;
  taxonomyPath?: string | null;
  heatmap?: {
    available?: boolean;
    resolved_model_id?: string | null;
    phenology_available?: boolean;
    full_available?: boolean;
  } | null;
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
  color?: string | null;
  count: number;
  fraction: number;
};

export type SpeciesEnvironmentCategorySamples = {
  value: number | string;
  observationIds: (number | string)[];
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
  observationCount?: number;
  allObscured?: boolean;
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

export type DataSourceReference = {
  authors: string;
  year?: number | null;
  title: string;
  journal?: string | null;
  doi?: string | null;
  url?: string | null;
};

export type DataSource = {
  name: string;
  url: string;
  license: string;
  license_url?: string | null;
  notes?: string | null;
  references: DataSourceReference[];
};

export type LegendClass = {
  id: number | string;
  name: string;
  color?: string | null;
};

export type EnvironmentVariableDefinition = {
  id: string;
  name?: string;
  units?: string | null;
  description?: string | null;
  valueType?: string | null;
  domain?: string | null;
  category?: string | null;
  sourceIds?: string[];
  legendClasses?: LegendClass[] | null;
  renderMin?: number | null;
  renderMax?: number | null;
};

/** Query parameters for numeric environment slice requests. */
export type EnvironmentSliceParams = {
  taxonId: number | string;
  variableId: string;
  min: number;
  max: number;
  limit?: number;
  location?: string | null;
  units?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
};

export type RelativeRankingEntry = {
  taxonId: number | string;
  scientificName?: string | null;
  commonName?: string | null;
  image_url?: string | null;
  image_file?: string | null;
  image_source?: string | null;
  rank?: string | null;
  value: number | null;
  position: number;
  percentile?: number | null;
  count: number;
  sample_count?: number | null;
};

export type RelativeRankingOption = {
  variable: string;
  metric: string;
  label: string;
  column: string;
  count: number;
};

export type RelativeRankingResponse = {
  ancestorTaxonId: number;
  rank: string;
  variable: string;
  units?: string | null;
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

export type TaxaQueryResult = SpeciesApiNormalized & {
  match_score?: number | null;
  image_url?: string | null;
  image_file?: string | null;
  sort_value?: number | null;
  sort_variable?: string | null;
  sort_metric?: string | null;
  count?: number | null;
  sample_count?: number | null;
  position?: number | null;
  percentile?: number | null;
};

export type TaxaQueryResponse = {
  query?: string | null;
  scope: {
    withinTaxon?: string | null;
    withinTaxonId?: number | null;
    descendantRank?: string | null;
    location?: string | null;
    minSamples?: number | null;
    includeSpeciesLike?: boolean | null;
  };
  sort: {
    variable?: string | null;
    metric?: string | null;
    order?: 'asc' | 'desc' | null;
    units?: string | null;
  };
  total: number;
  matchedTotal: number;
  eligibleTotal: number;
  emptyReason?:
    | 'no_query'
    | 'no_text_matches'
    | 'filtered_out'
    | 'ranking_ineligible'
    | null;
  limit: number;
  offset: number;
  results: TaxaQueryResult[];
};
