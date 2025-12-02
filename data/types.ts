import type { ImageSourcePropType } from 'react-native';

/**
 * Shared data contracts for hooking the WhereWild UI up to real APIs.
 * These interfaces deliberately avoid importing component props so the same
 * objects can be reused on the client, in tests, or by API clients.
 */

/**
 * Minimal description of a species that can be rendered in cards or lists.
 */
export type SpeciesSummary = {
  common_name: string;
  scientific_name: string;
  description: string;
  image_source?: ImageSourcePropType;
};

/**
 * Summary record that also includes a stable identifier for recommendation lists.
 */
export type HighlightedSpecies = SpeciesSummary & {
  id: string;
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
    items: HighlightedSpecies[];
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
  image_source: ImageSourcePropType;
};

export type HeatmapSnapshot = {
  image_source: ImageSourcePropType;
};

/**
 * Full payload required to render the species detail page.
 */
export type SpeciesPageData = {
  id: string;
  common_name: string;
  scientific_name: string;
  overview: SpeciesOverview;
  dataSections: EnvironmentalDataSection[];
  nearbySpecies: SpeciesSummary[];
  heatmap: HeatmapSnapshot;
};
