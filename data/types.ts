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

export type EnvironmentalGraphConfig = {
  variableId: string;
  /**
   * Optional prefetched stats that can be passed directly to SpeciesEnvironmentSection
   * to avoid triggering another network request when the entry already resolved the data.
   */
  initialStats?: SpeciesEnvironmentStats;
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
  /**
   * Optional configuration that drives an inline SpeciesEnvironmentSection graph.
   * When provided, the entry will automatically render the graph inline using
   * the ambient species taxon ID for fetching data.
   */
  environmentGraph?: EnvironmentalGraphConfig;
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
  imageSource?: ImageSourcePropType;
};

export type HeatmapSnapshot = {
  imageSource?: ImageSourcePropType;
};

/**
 * Full payload required to render the species detail page.
 */
export type SpeciesPageData = SpeciesSummary & {
  overview: SpeciesOverview;
  dataSections: EnvironmentalDataSection[];
  nearbySpecies: SpeciesSummary[];
  heatmap: HeatmapSnapshot;
};

export type SpeciesEnvironmentSummary = {
  count: number;
  mean: number | null;
  stddev: number | null;
  q10: number | null;
  q90: number | null;
};

export type SpeciesEnvironmentHistogram = {
  bins: number[];
  counts: number[];
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
  binSamples?: SpeciesEnvironmentBinSample[];
  categoricalDistribution?: SpeciesEnvironmentCategory[];
  dominantCategories?: SpeciesEnvironmentCategory[];
  categoricalSamples?: SpeciesEnvironmentCategorySamples[];
};

export type EnvironmentVariableDefinition = {
  id: string;
  name?: string;
  units?: string | null;
  description?: string | null;
};

export type SpeciesEnvironmentBinSample = {
  index: number;
  observationIds: Array<number | string>;
};

export type SpeciesEnvironmentCategory = {
  value: number;
  className: string;
  description?: string | null;
  count: number;
  fraction: number;
};

export type SpeciesEnvironmentCategorySamples = {
  value: number;
  observationIds: Array<number | string>;
};
