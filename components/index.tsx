// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Barrel export file for components.
 *
 * This file provides a single import point for all components in the /components directory.
 * Instead of importing from individual files like './Button', './ButtonDanger', etc.,
 * consumers can import everything from '@/components':
 *
 * @example
 * import { Button, ButtonDanger, IconButton, ThemedText } from '@/components';
 * import type { ButtonProps, IconButtonSize } from '@/components';
 */

export { Button } from './buttons/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './buttons/Button';

export { ButtonDanger } from './buttons/ButtonDanger';
export type {
  ButtonDangerProps,
  ButtonDangerSize,
  ButtonDangerVariant,
} from './buttons/ButtonDanger';

export { IconButton } from './buttons/IconButton';
export type {
  IconButtonProps,
  IconButtonSize,
  IconButtonVariant,
} from './buttons/IconButton';

export { DataEntry } from './lists/DataEntry';
export type { DataEntryDetail, DataEntryProps } from './lists/DataEntry';

export { DataEntrySection } from './lists/DataEntrySection';
export type {
  DataEntrySectionEntry,
  DataEntrySectionProps,
} from './lists/DataEntrySection';

export { WebPageHeader } from './sections/webPageHeader/WebPageHeader';
export type {
  WebPageHeaderAction,
  WebPageHeaderProps,
} from './sections/webPageHeader/WebPageHeader';

export { TopAppBar } from './sections/topAppBar/TopAppBar';
export type {
  TopAppBarProps,
  TopAppBarVariant,
} from './sections/topAppBar/TopAppBar';

export { SearchInput } from './inputs/SearchInput';
export type { SearchInputProps } from './inputs/SearchInput';

export { SearchResults } from './lists/SearchResults';
export type { SearchResultsProps } from './lists/SearchResults';

export { DateRangeSlider } from './inputs/DateRangeSlider';
export type { DateRangeSliderProps, MonthYear } from './inputs/DateRangeSlider';

export { SelectField } from './inputs/SelectField';
export type { SelectFieldProps, SelectOption } from './inputs/SelectField';

export { SwitchField } from './inputs/SwitchField';
export type { SwitchFieldProps } from './inputs/SwitchField';

export { NumberSpinner } from './inputs/NumberSpinner';
export type { NumberSpinnerProps } from './inputs/NumberSpinner';

export { RadioField } from './inputs/RadioField';
export type { RadioFieldProps } from './inputs/RadioField';

export { RadioGroup } from './inputs/RadioGroup';
export type { RadioGroupOption, RadioGroupProps } from './inputs/RadioGroup';

export { SpeciesCard } from './cards/SpeciesCard';
export type { SpeciesCardProps } from './cards/SpeciesCard';

export { ThemedText } from './text/ThemedText';

export { PageSurface } from './PageSurface';

export { PageScrollContainer } from './PageScrollContainer';

export { Tab } from './tabs/Tab';
export type { TabProps } from './tabs/Tab';

export { Tabs } from './tabs/Tabs';
export type { TabsProps } from './tabs/Tabs';

export { NavigationPill } from './navigation/NavigationPill';
export type { NavigationPillProps } from './navigation/NavigationPill';

export { NavigationPillList } from './navigation/NavigationPillList';
export type { NavigationPillListProps } from './navigation/NavigationPillList';

export { NavigationBar } from './sections/navigationBar/NavigationBar';
export type { NavigationBarProps } from './sections/navigationBar/NavigationBar';

export { SpeciesLocationFilters } from './sections/SpeciesLocationFilters';
export { SpeciesObservationFilters } from './sections/SpeciesObservationFilters';

export { SearchFilterPredicates } from './sections/SearchFilterPredicates';
export type { SearchFilterPredicatesProps } from './sections/SearchFilterPredicates';

export { SpeciesTimestampFilters } from './sections/SpeciesTimestampFilters';
export type { SpeciesTimestampFiltersProps } from './sections/SpeciesTimestampFilters';

export { PageTitle } from './sections/PageTitle';
export type { PageTitleProps } from './sections/PageTitle';

export { SpeciesPageTitle } from './sections/SpeciesPageTitle';
export type { SpeciesPageTitleProps } from './sections/SpeciesPageTitle';

export { SpeciesInformationSection } from './sections/SpeciesInformationSection';
export type { SpeciesInformationSectionProps } from './sections/SpeciesInformationSection';

export { LocalMapSection } from './sections/LocalMapSection';
export type { LocalMapSectionProps } from './sections/LocalMapSection';

export { HomeRecommendationFilter } from './sections/HomeRecommendationFilter';
export type { HomeRecommendationFilterProps } from './sections/HomeRecommendationFilter';

export { WeatherAttribution } from './sections/WeatherAttribution';

export { ActiveNearYouSection } from './sections/ActiveNearYouSection';
export type { ActiveNearYouSectionProps } from './sections/ActiveNearYouSection';

export { ContentImage } from './sections/ContentImage';
export type { ContentImageProps } from './sections/ContentImage';

export { Filters } from './sections/Filters';
export type { FiltersProps } from './sections/Filters';

export { InlineExpandableRows } from './lists/InlineExpandableRows';
export type {
  InlineExpandableRowEntry,
  InlineExpandableRowsProps,
  InlineExpandableRowsSection,
} from './lists/InlineExpandableRows';

export { NearbySpeciesCarousel } from './NearbySpeciesCarousel';
export type { NearbySpeciesCarouselProps } from './NearbySpeciesCarousel';

export { SpeciesEnvironmentSection } from './sections/speciesEnvironment/SpeciesEnvironmentSection';
export type { SpeciesEnvironmentSectionProps } from './sections/speciesEnvironment/SpeciesEnvironmentSection';

export { SpeciesOccurrenceMap } from './sections/SpeciesOccurrenceMap';
