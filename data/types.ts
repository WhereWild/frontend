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
  imageSource: ImageSourcePropType;
  imageLicense?: string;
  imageCreator?: string;
  imageRightsHolder?: string;
  imageReferences?: string;
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

export type SpeciesApiNormalized = {
  taxon_id: number | null;
  scientific_name: string;
  common_name: string;
  common_names: string[];
  image_source: string | null;
  _raw: unknown;
};

export type SpeciesApiDetail = SpeciesApiNormalized & {
  description: string;
  image_license?: string | null;
  image_creator?: string | null;
  image_rights_holder?: string | null;
  image_references?: string | null;
};

/**
 * Full payload required to render the species detail page.
 */
export type SpeciesPageData = SpeciesSummary & {
  overview: SpeciesOverview;
  nearbySpecies: SpeciesSummary[];
  heatmap: HeatmapSnapshot;
};
