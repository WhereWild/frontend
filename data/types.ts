// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ImageSourcePropType } from 'react-native';

export type SpeciesIdentifiers = {
  taxonId: string;
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
  imageLicenseUrl?: string;
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
  largeTaxon?: boolean;
};

export type SpeciesEnvironmentSummary = {
  count: number;
  min: number | null;
  mean: number | null;
  max: number | null;
  median?: number | null;
  mode?: number | string | null;
  std?: number | null;
  stddev?: number | null;
  variance?: number | null;
  range?: number | null;
  q01?: number | null;
  q10?: number | null;
  q25?: number | null;
  q75?: number | null;
  q90?: number | null;
  q99?: number | null;
  iqr?: number | null;
  q10_90_range?: number | null;
  circular_mean?: number | null;
  rbar?: number | null;
  circular_std?: number | null;
  circular_var?: number | null;
  unique_classes?: number | null;
  entropy?: number | null;
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

/**
 * A KDE density grid over a 3-part ("ternary") compositional variable — e.g.
 * sand/silt/clay soil composition — fit in ILR (isometric log-ratio) space so
 * the components' fixed sum is respected rather than treating them as
 * independent. Generic across any such variable; which real-world quantities
 * `a`/`b`/`c` refer to and where they render on the triangle comes from the
 * variable's `compositionAxis` metadata (see `EnvironmentVariableDefinition`),
 * not from this type. Grid coordinates aren't transmitted — index i of
 * `density` corresponds to barycentric grid vertex i of a canonical
 * (resolution+1)-per-edge triangular grid, reconstructable from `resolution`
 * alone.
 */
export type TernaryCompositionDensity = {
  resolution: number;
  density: number[];
  /** Class id per grid vertex, classified server-side — only present for a
   * compositional variable that has a registered classifier (e.g. USDA
   * texture classes for soil_texture). A compositional variable with no
   * associated classes simply omits this — density-only is a valid shape. */
  classIds?: number[] | null;
  /** Exact class boundary line segments, computed server-side by binary
   * search against the real classifier (not approximated from the coarse
   * density grid) — so lines are straight regardless of a boundary's slope.
   * Flat, paired: (classBoundaryA[2k], classBoundaryB[2k]) and
   * (classBoundaryA[2k+1], classBoundaryB[2k+1]) are one segment's two
   * endpoints; the third component is derivable as 1 - a - b. */
  classBoundaryA?: number[] | null;
  classBoundaryB?: number[] | null;
  sampleA?: number[] | null;
  sampleB?: number[] | null;
  sampleC?: number[] | null;
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
  catalogAutoGenerated?: boolean;
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
  taxon_id: string | null;
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
  image_license_url?: string | null;
  image_creator?: string | null;
  image_rights_holder?: string | null;
  image_references?: string | null;
  taxonomyPath?: string | null;
  large_taxon?: boolean;
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
  ternaryCompositionDensity?: TernaryCompositionDensity | null;
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
  volume_issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
};

export type DataSource = {
  name: string;
  url: string;
  license: string;
  license_url?: string | null;
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
  group?: string | null;
  groupLabel?: string | null;
  agg?: string | null;
  version?: number | null;
  /** Which ternary/compositional group (if any) this variable's raw value is
   * a member of, e.g. "soil_texture" for sand/silt/clay — see
   * config/gis/catalog.json's composition_group. */
  compositionGroup?: string | null;
  /** Where this variable renders on the composition's triangle, when it's a
   * member of a composition_group. Absent on the group's own classifier/
   * legend variable (e.g. soil_texture itself isn't an axis). */
  compositionAxis?: 'top' | 'bottom_left' | 'bottom_right' | null;
  /** Short corner label for a composition triangle (e.g. "Sand"), distinct
   * from `name`/`display_name` which is the full label used elsewhere (e.g.
   * "Sand Content (0–5cm)") — too long for a small triangle corner. Falls
   * back to the full label if a compositional variable doesn't supply one. */
  compositionLabel?: string | null;
};

/**
 * An additional per-variable filter chained onto a slice/class-samples
 * request — e.g. holding an elevation range active while switching to and
 * slicing a landcover class. min/max (for a continuous/circular range) or
 * classValue (for an exact categorical match) are in DISPLAY units for that
 * filter's OWN variable, same convention as the primary slice's min/max.
 * classValues ORs together multiple classes of that same variable (e.g.
 * Forest OR Grassland) — ANDed against everything else same as classValue.
 * ranges ORs together multiple disjoint numeric ranges of that same
 * variable (e.g. two separately-selected slices of a histogram/KDE) — same
 * relationship to a single min/max as classValues has to classValue.
 */
export type ExtraVariableFilter =
  | { variableId: string; min: number; max: number }
  | { variableId: string; ranges: { min: number; max: number }[] }
  | { variableId: string; classValue: number }
  | { variableId: string; classValues: number[] };

/** Query parameters for numeric environment slice requests. */
export type EnvironmentSliceParams = {
  taxonId: string;
  variableId: string;
  min: number;
  max: number;
  limit?: number;
  location?: string | null;
  units?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
  /** Additional variable filters ANDed onto this slice — see chained-slice support. */
  extra?: ExtraVariableFilter[] | null;
};

export type RelativeRankingEntry = {
  taxonId: string;
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
  ancestorTaxonId: string;
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
  ancestorTaxonId: string;
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
    withinTaxonId?: string | null;
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
