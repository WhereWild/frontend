// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconStar,
  IconTrash,
} from '@/assets/icons';
import {
  Button,
  ButtonDanger,
  Filters,
  IconButton,
  NavigationPillList,
  NearbySpeciesCarousel,
  NumberSpinner,
  ObservationCard,
  PageScrollContainer,
  RadioGroup,
  SearchInput,
  SwitchField,
  SpeciesCard,
  SpeciesPageTitle,
  Tabs,
  ThemedText,
} from '@/components';
import type { ButtonProps } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { Colors, Shadows, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { TimeEasingMatrixSection } from '@/components/sections/TimeEasingMatrixSection';
import { DateRangeSlider } from '@/components/inputs/DateRangeSlider';
import type { MonthYear } from '@/components/inputs/DateRangeSlider';
import Head from 'expo-router/head';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import {
  ASPECT_CONIC_CSS,
  ASPECT_NATIVE_COLOR,
  VIRIDIS_COLORS,
  VIRIDIS_CSS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';

const SPECIES_CARD_IMAGE = require('@/assets/images/placeholder.png');

type ButtonVariant = 'primary' | 'neutral' | 'subtle';

type ButtonRow = {
  title: string;
  variant?: ButtonVariant;
  danger?: boolean;
  buttons: ButtonEntry[];
};

type ButtonEntry = {
  label: string;
  size?: 'small' | 'medium';
  iconStart?: ButtonProps['iconStart'];
  iconEnd?: ButtonProps['iconEnd'];
  disabled?: boolean;
  variant?: ButtonVariant;
};

const noop = () => {};

const TYPOGRAPHY_SAMPLE_TEXT = 'Sphinx of black quartz, judge my vow.';
const TYPOGRAPHY_VARIANTS = [
  'titleHero',
  'titlePage',
  'subtitle',
  'heading',
  'subheading',
  'body',
  'bodyEmphasis',
  'bodyStrong',
  'bodySmall',
  'bodySmallEmphasis',
  'bodySmallStrong',
  'bodySmallLink',
  'bodyTiny',
  'bodyTinyStrong',
  'link',
  'code',
  'singleLineBody',
  'singleLineBodySmall',
  'singleLineBodySmallStrong',
  'singleLineBodyTiny',
  'singleLineBodyTinyStrong',
] as const;

const SHADOW_TOKEN_KEYS = Object.keys(Shadows) as (keyof typeof Shadows)[];
const SHADOW_SAMPLE_TEXT = 'Shadow preview block';

const formatTokenLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

export default function About() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchEvent, setLastSearchEvent] = useState('Waiting for input…');
  const [switchValue, setSwitchValue] = useState(true);
  const [spinnerValue, setSpinnerValue] = useState(1);
  const [spinnerAtMinValue] = useState(1);
  const [spinnerAtMaxValue] = useState(10);
  const [spinnerNegativeValue, setSpinnerNegativeValue] = useState(0);
  const [spinnerDisabledValue] = useState(3);
  const [dateRangeStart, setDateRangeStart] = useState<MonthYear>({
    year: 2010,
    month: 1,
  });
  const [dateRangeEnd, setDateRangeEnd] = useState<MonthYear>({
    year: 2024,
    month: 6,
  });
  const [radioGroupValue, setRadioGroupValue] = useState('checked');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [overviewPill, setOverviewPill] = useState('all');
  const [habitatPill, setHabitatPill] = useState('soil');
  const [trackingPill, setTrackingPill] = useState('recent');
  const [imagesPill, setImagesPill] = useState('all');
  const [notesPill, setNotesPill] = useState('notes');
  const [buttonLongPressCount, setButtonLongPressCount] = useState(0);
  const [buttonLongPressLastLabel, setButtonLongPressLastLabel] = useState<
    string | null
  >(null);
  const [filterCountry, setFilterCountry] = useState('us');
  const [filterState, setFilterState] = useState('ut');
  const [filterCounty, setFilterCounty] = useState('salt-lake');
  const [filterTaxonQuery, setFilterTaxonQuery] = useState('');
  const [filterRank, setFilterRank] = useState('species');
  const [filterIncludeSubspecies, setFilterIncludeSubspecies] = useState(true);
  const [filterSortVariable, setFilterSortVariable] = useState('');
  const [filterSortMetric, setFilterSortMetric] = useState('average');
  const [filterSortOrder, setFilterSortOrder] = useState<
    'ascending' | 'descending'
  >('ascending');
  const [filterNumResults, setFilterNumResults] = useState(10);
  const [filterMinSamples, setFilterMinSamples] = useState(1);
  const speciesSample = mountainBallCactusData;
  const observationCardImageUri = useMemo(
    () => Asset.fromModule(SPECIES_CARD_IMAGE).uri,
    [],
  );
  const radioOptions = [
    { label: 'Label', description: 'Description', value: 'checked' },
    { label: 'Label', description: 'Description', value: 'unchecked' },
  ];
  const handleButtonLongPress = (label: string) => {
    setButtonLongPressCount((currentCount) => currentCount + 1);
    setButtonLongPressLastLabel(label);
  };
  const buttonRows: ButtonRow[] = [
    {
      title: 'Button — Primary',
      buttons: [
        { label: 'Medium' },
        { label: 'Small', size: 'small' },
        { label: 'Disabled', disabled: true },
        { label: 'Disabled Small', size: 'small', disabled: true },
      ],
    },
    {
      title: 'Button — Neutral',
      variant: 'neutral',
      buttons: [
        { label: 'Medium' },
        { label: 'Small', size: 'small' },
        { label: 'Disabled', disabled: true },
        { label: 'Disabled Small', size: 'small', disabled: true },
      ],
    },
    {
      title: 'Button — Subtle',
      variant: 'subtle',
      buttons: [
        { label: 'Medium' },
        { label: 'Small', size: 'small' },
        { label: 'Disabled', disabled: true },
        { label: 'Disabled Small', size: 'small', disabled: true },
      ],
    },
    {
      title: 'Button — Primary (Icons)',
      buttons: [
        { label: 'Download', iconStart: <IconDownload /> },
        { label: 'Continue', iconEnd: <IconArrowRight /> },
        {
          label: 'Favorite',
          iconStart: <IconStar />,
          iconEnd: <IconArrowRight />,
        },
      ],
    },
    {
      title: 'Button — Neutral (Icons)',
      variant: 'neutral',
      buttons: [
        { label: 'Back', iconStart: <IconArrowLeft /> },
        { label: 'Next', iconEnd: <IconArrowRight /> },
        {
          label: 'Export',
          iconStart: <IconDownload />,
          iconEnd: <IconArrowRight />,
        },
      ],
    },
    {
      title: 'Button — Subtle (Icons)',
      variant: 'subtle',
      buttons: [
        { label: 'Highlight', iconStart: <IconStar /> },
        { label: 'Learn More', iconEnd: <IconArrowRight /> },
        {
          label: 'Browse',
          iconStart: <IconArrowLeft />,
          iconEnd: <IconArrowRight />,
        },
      ],
    },
    {
      title: 'ButtonDanger — Primary',
      danger: true,
      buttons: [
        { label: 'Medium' },
        { label: 'Small', size: 'small' },
        { label: 'Disabled', disabled: true },
        { label: 'Disabled Small', size: 'small', disabled: true },
      ],
    },
    {
      title: 'ButtonDanger — Subtle',
      danger: true,
      variant: 'subtle',
      buttons: [
        { label: 'Medium' },
        { label: 'Small', size: 'small' },
        { label: 'Disabled', disabled: true },
        { label: 'Disabled Small', size: 'small', disabled: true },
      ],
    },
    {
      title: 'ButtonDanger — Icons',
      danger: true,
      buttons: [
        { label: 'Delete', iconStart: <IconTrash /> },
        { label: 'Confirm', iconEnd: <IconArrowRight /> },
        {
          label: 'Report',
          variant: 'subtle',
          iconStart: <IconAlertTriangle />,
          iconEnd: <IconArrowRight />,
        },
      ],
    },
  ];

  const iconButtonVariants: { title: string; variant: ButtonVariant }[] = [
    { title: 'IconButton — Primary', variant: 'primary' },
    { title: 'IconButton — Neutral', variant: 'neutral' },
    { title: 'IconButton — Subtle', variant: 'subtle' },
  ];

  const iconButtonStates: { size: 'medium' | 'small'; disabled: boolean }[] = [
    { size: 'medium', disabled: false },
    { size: 'small', disabled: false },
    { size: 'medium', disabled: true },
    { size: 'small', disabled: true },
  ];

  const tabsSample = [
    { key: 'overview', label: 'Overview' },
    { key: 'habitat', label: 'Habitat & Range' },
    { key: 'tracking', label: 'Tracking and Sightings' },
    { key: 'images', label: 'Images' },
    { key: 'notes', label: 'Field Notes' },
  ];

  const overviewPills = [
    { key: 'all', label: 'All' },
    { key: 'nearby', label: 'Nearby' },
    { key: 'seasonal', label: 'Seasonal' },
    { key: 'rare', label: 'Rare Finds' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'alerts', label: 'Alerts' },
  ];

  const habitatPills = [
    { key: 'soil', label: 'Soil' },
    { key: 'elevation', label: 'Elevation' },
    { key: 'climate', label: 'Climate' },
    { key: 'canopy', label: 'Canopy Cover' },
  ];

  const trackingPills = [
    { key: 'recent', label: 'Recent' },
    { key: 'verified', label: 'Verified' },
    { key: 'unverified', label: 'Needs Review' },
    { key: 'community', label: 'Community Notes' },
  ];

  const imagesPills = [
    { key: 'all', label: 'All Images' },
    { key: 'macro', label: 'Macro' },
    { key: 'habitat', label: 'Habitat' },
    { key: 'seasonal', label: 'Seasonal Color' },
  ];

  const notesPills = [
    { key: 'notes', label: 'Notes' },
    { key: 'care', label: 'Care Tips' },
    { key: 'hazards', label: 'Hazards' },
  ];

  const overviewContent: Record<string, string> = {
    all: 'Showing all recent observations and modeled occurrences in your region.',
    nearby: 'Nearby sightings within a 10 km radius based on recent reports.',
    seasonal: 'Seasonal activity highlights based on the current month.',
    rare: 'Rare finds include uncommon or low-frequency sightings.',
    favorites: 'Your starred species and saved locations.',
    alerts: 'Active alerts for unusual sightings or conditions.',
  };

  const habitatContent: Record<string, string> = {
    soil: 'Soil acidity, texture, and moisture indicators for the species.',
    elevation: 'Typical elevation range where the species thrives.',
    climate: 'Temperature and precipitation trends for this habitat.',
    canopy: 'Canopy cover estimates and light availability.',
  };

  const trackingContent: Record<string, string> = {
    recent: 'Most recent sightings from verified observers.',
    verified: 'Observations with confirmed IDs and supporting media.',
    unverified: 'Reports awaiting community review or expert confirmation.',
    community: 'Notes and insights from the local community.',
  };

  const imagesContent: Record<string, string> = {
    all: 'A mix of macro, habitat, and seasonal imagery.',
    macro: 'Close-up details for identification and morphology.',
    habitat: 'Contextual images showing surrounding vegetation.',
    seasonal: 'Seasonal color changes and flowering stages.',
  };

  const notesContent: Record<string, string> = {
    notes: 'General field notes and observations for this species.',
    care: 'Care considerations for conservation and restoration efforts.',
    hazards: 'Safety notes, toxins, or environmental hazards.',
  };

  const renderPillContentCard = (content: string) => (
    <View
      style={[
        styles.pillContentCard,
        {
          backgroundColor: palette.background.default.secondary,
          borderColor: palette.border.default.default,
        },
      ]}
    >
      <ThemedText variant='body'>{content}</ThemedText>
    </View>
  );

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | Dev</title>
        </Head>
      ) : null}
      <PageSurface>
        <View
          style={Platform.OS === 'web' ? styles.contentWeb : styles.content}
        >
          <PageScrollContainer
            contentContainerStyle={getResponsiveContentContainerStyle(
              responsive,
              {
                includeBottomPadding: true,
                includeGap: true,
              },
            )}
          >
            <View>
              <ThemedText variant='heading'>Filters Demo</ThemedText>
              <Filters
                countryValue={filterCountry}
                countryOptions={[
                  { label: 'United States', value: 'us' },
                  { label: 'Canada', value: 'ca' },
                  { label: 'Mexico', value: 'mx' },
                ]}
                onCountryChange={setFilterCountry}
                stateValue={filterState}
                stateOptions={[
                  { label: 'Utah', value: 'ut' },
                  { label: 'Colorado', value: 'co' },
                  { label: 'Arizona', value: 'az' },
                ]}
                onStateChange={setFilterState}
                countyValue={filterCounty}
                countyOptions={[
                  { label: 'Salt Lake', value: 'salt-lake' },
                  { label: 'Utah', value: 'utah' },
                  { label: 'Davis', value: 'davis' },
                ]}
                onCountyChange={setFilterCounty}
                baseTaxonQuery={filterTaxonQuery}
                onBaseTaxonQueryChange={setFilterTaxonQuery}
                rankValue={filterRank}
                rankOptions={[
                  { label: 'Species', value: 'species' },
                  { label: 'Genus', value: 'genus' },
                  { label: 'Family', value: 'family' },
                ]}
                onRankChange={setFilterRank}
                includeSubspecies={filterIncludeSubspecies}
                onIncludeSubspeciesChange={setFilterIncludeSubspecies}
                sortVariableValue={filterSortVariable}
                sortVariableOptions={[
                  { label: 'Temperature', value: 'temperature' },
                  { label: 'Elevation', value: 'elevation' },
                  { label: 'Precipitation', value: 'precipitation' },
                ]}
                onSortVariableChange={setFilterSortVariable}
                sortMetricValue={filterSortMetric}
                sortMetricOptions={[
                  { label: 'Average', value: 'average' },
                  { label: 'Median', value: 'median' },
                  { label: 'Maximum', value: 'maximum' },
                  { label: 'Minimum', value: 'minimum' },
                ]}
                onSortMetricChange={setFilterSortMetric}
                sortOrder={filterSortOrder}
                onSortOrderChange={setFilterSortOrder}
                sortReference={0}
                listOffset={0}
                minRbar={0.15}
                numberOfResults={filterNumResults}
                onNumberOfResultsChange={setFilterNumResults}
                minimumSamples={filterMinSamples}
                onMinimumSamplesChange={setFilterMinSamples}
                onResetFilters={() => {
                  setFilterCountry('us');
                  setFilterState('ut');
                  setFilterCounty('salt-lake');
                  setFilterTaxonQuery('');
                  setFilterRank('species');
                  setFilterIncludeSubspecies(true);
                  setFilterSortVariable('');
                  setFilterSortMetric('average');
                  setFilterSortOrder('ascending');
                  setFilterNumResults(10);
                  setFilterMinSamples(1);
                }}
              />
            </View>

            <View>
              <ThemedText variant='heading'>Search Input</ThemedText>
              <View>
                <SearchInput
                  value={searchQuery}
                  placeholder='Search species'
                  onQueryChange={(value) => {
                    setSearchQuery(value);
                    setLastSearchEvent(
                      value ? `Query changed: ${value}` : 'Search cleared',
                    );
                  }}
                  onCharacterAdd={(char, value) => {
                    setLastSearchEvent(`Added "${char}" -> ${value}`);
                  }}
                  onSubmitSearch={(value) => {
                    setLastSearchEvent(`Search submitted with "${value}"`);
                  }}
                  onClear={() => {
                    setLastSearchEvent('Search cleared');
                  }}
                  autoCorrect={false}
                  returnKeyType='search'
                  accessibilityLabel='Search species'
                />
              </View>
              <ThemedText variant='body'>{lastSearchEvent}</ThemedText>
              <ThemedText variant='bodyStrong'>Disabled</ThemedText>
              <View>
                <SearchInput
                  placeholder='Search species'
                  accessibilityLabel='Search species'
                  disabled
                />
              </View>
            </View>

            <View>
              <ThemedText variant='heading'>Number Spinner</ThemedText>
              <View style={styles.selectGrid}>
                <NumberSpinner
                  label='Label'
                  description='Min 1, max 10'
                  value={spinnerValue}
                  min={1}
                  max={10}
                  onValueChange={setSpinnerValue}
                />
                <NumberSpinner
                  label='Label'
                  description='At minimum'
                  value={spinnerAtMinValue}
                  min={1}
                  max={10}
                />
                <NumberSpinner
                  label='Label'
                  description='At maximum'
                  value={spinnerAtMaxValue}
                  min={1}
                  max={10}
                />
                <NumberSpinner
                  label='Label'
                  description='Allows negatives (-10 to 10)'
                  value={spinnerNegativeValue}
                  min={-10}
                  max={10}
                  onValueChange={setSpinnerNegativeValue}
                />
                <NumberSpinner
                  label='Label'
                  description='Disabled'
                  value={spinnerDisabledValue}
                  min={1}
                  max={10}
                  disabled
                />
              </View>
            </View>

            <View>
              <ThemedText variant='heading'>Date Range Slider</ThemedText>
              <ThemedText variant='bodySmall'>
                {`${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateRangeStart.month - 1]} ${dateRangeStart.year} → ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateRangeEnd.month - 1]} ${dateRangeEnd.year}`}
              </ThemedText>
              <DateRangeSlider
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                minDate={{ year: 1990, month: 1 }}
                maxDate={{ year: 2025, month: 12 }}
                onStartChange={setDateRangeStart}
                onEndChange={setDateRangeEnd}
              />
            </View>

            <View>
              <ThemedText variant='heading'>Species Card</ThemedText>
              <SpeciesCard
                taxonId={speciesSample.taxonId}
                commonName='Common Name'
                scientificName='Binomial nomenclature'
                description='Description'
                imageSource={SPECIES_CARD_IMAGE}
              />
              <ThemedText variant='bodyStrong'>
                Mini (search results)
              </ThemedText>
              <SpeciesCard
                taxonId='12345'
                commonName='Common Name'
                scientificName='Binomial nomenclature'
                imageSource={SPECIES_CARD_IMAGE}
                size='compact'
              />
            </View>

            <View>
              <ThemedText variant='heading'>Observation Card</ThemedText>
              <ThemedText variant='body'>
                No media data is captured yet, so the blank-image fallback is
                the expected default — the &quot;with image&quot; variant just
                proves the image-present layout ahead of that data existing.
              </ThemedText>
              <View style={styles.row}>
                <ObservationCard
                  catalogNumber='123456'
                  varLabel='12.3°C'
                  varColor={Colors.light.icon.brand.default}
                />
                <ObservationCard catalogNumber='234567' />
                <ObservationCard
                  catalogNumber='345678'
                  varLabel='9.1°C'
                  varColor={Colors.light.icon.brand.default}
                  imageUrl={observationCardImageUri}
                  attribution='© Jane Doe'
                  license='CC BY-NC 4.0'
                  licenseUrl='https://creativecommons.org/licenses/by-nc/4.0/'
                />
                <ObservationCard
                  catalogNumber='456789'
                  varLabel='9.8°C'
                  size='compact'
                />
              </View>
            </View>

            <View>
              <ThemedText variant='heading'>Species Page Components</ThemedText>
              <ThemedText variant='body'>
                Preview of the composable building blocks used on the species
                detail page.
              </ThemedText>
              <View style={[styles.speciesPreview]}>
                <SpeciesPageTitle
                  commonName={speciesSample.commonName}
                  scientificName={speciesSample.scientificName}
                  onPressDownload={noop}
                />
                <NearbySpeciesCarousel species={speciesSample.nearbySpecies} />
              </View>
            </View>

            <View>
              <ThemedText variant='heading'>Tabs</ThemedText>
              <ThemedText variant='body'>
                Controlled tabs with keyboard navigation.
              </ThemedText>
              <View style={styles.tabsRow}>
                <Tabs
                  tabs={tabsSample}
                  selectedKey={selectedTab}
                  onSelectionChange={setSelectedTab}
                  accessibilityLabel='Species tabs'
                />
              </View>
              <View style={styles.pillExamples}>
                {selectedTab === 'overview' && (
                  <View style={styles.pillExampleGroup}>
                    <ThemedText variant='bodySmallStrong'>
                      Horizontal wrap
                    </ThemedText>
                    <NavigationPillList
                      pills={overviewPills}
                      selectedKey={overviewPill}
                      onSelectionChange={setOverviewPill}
                      accessibilityLabel='Overview filters'
                    />
                    {renderPillContentCard(overviewContent[overviewPill])}
                  </View>
                )}
                {selectedTab === 'habitat' && (
                  <View style={styles.pillExampleGroup}>
                    <ThemedText variant='bodySmallStrong'>
                      Vertical list
                    </ThemedText>
                    <NavigationPillList
                      pills={habitatPills}
                      selectedKey={habitatPill}
                      onSelectionChange={setHabitatPill}
                      direction='vertical'
                      accessibilityLabel='Habitat filters'
                    />
                    {renderPillContentCard(habitatContent[habitatPill])}
                  </View>
                )}
                {selectedTab === 'tracking' && (
                  <View style={styles.pillExampleGroup}>
                    <ThemedText variant='bodySmallStrong'>
                      Mixed label lengths
                    </ThemedText>
                    <NavigationPillList
                      pills={trackingPills}
                      selectedKey={trackingPill}
                      onSelectionChange={setTrackingPill}
                      accessibilityLabel='Tracking filters'
                    />
                    {renderPillContentCard(trackingContent[trackingPill])}
                  </View>
                )}
                {selectedTab === 'images' && (
                  <View style={styles.pillExampleGroup}>
                    <ThemedText variant='bodySmallStrong'>
                      Image categories
                    </ThemedText>
                    <NavigationPillList
                      pills={imagesPills}
                      selectedKey={imagesPill}
                      onSelectionChange={setImagesPill}
                      accessibilityLabel='Image filters'
                    />
                    {renderPillContentCard(imagesContent[imagesPill])}
                  </View>
                )}
                {selectedTab === 'notes' && (
                  <View style={styles.pillExampleGroup}>
                    <ThemedText variant='bodySmallStrong'>
                      Notes sections
                    </ThemedText>
                    <NavigationPillList
                      pills={notesPills}
                      selectedKey={notesPill}
                      onSelectionChange={setNotesPill}
                      accessibilityLabel='Notes filters'
                    />
                    {renderPillContentCard(notesContent[notesPill])}
                  </View>
                )}
              </View>

              <View>
                <ThemedText variant='heading'>Switch Field</ThemedText>
                <View style={styles.selectGrid}>
                  <SwitchField
                    label='Label'
                    description='Description'
                    value={switchValue}
                    onValueChange={setSwitchValue}
                  />
                  <SwitchField
                    label='Label'
                    description='Description'
                    value={false}
                    disabled
                  />
                  <SwitchField
                    label='Label'
                    description='Description'
                    value={true}
                    disabled
                  />
                </View>
              </View>

              <View>
                <ThemedText variant='heading'>Radio Field</ThemedText>
                <View style={styles.selectGrid}>
                  <View style={styles.radioStateGroup}>
                    <ThemedText variant='body'>State=Default</ThemedText>
                    <RadioGroup
                      options={radioOptions}
                      value={radioGroupValue}
                      onValueChange={setRadioGroupValue}
                    />
                  </View>

                  <View style={styles.radioStateGroup}>
                    <ThemedText variant='body'>State=Disabled</ThemedText>
                    <RadioGroup
                      options={radioOptions}
                      value='checked'
                      disabled
                    />
                  </View>
                </View>
              </View>

              <View>
                <ThemedText variant='heading'>Number Spinner</ThemedText>
                <View style={styles.selectGrid}>
                  <NumberSpinner
                    label='Label'
                    description='Min 1, max 10'
                    value={spinnerValue}
                    min={1}
                    max={10}
                    onValueChange={setSpinnerValue}
                  />
                  <NumberSpinner
                    label='Label'
                    description='At minimum'
                    value={spinnerAtMinValue}
                    min={1}
                    max={10}
                  />
                  <NumberSpinner
                    label='Label'
                    description='At maximum'
                    value={spinnerAtMaxValue}
                    min={1}
                    max={10}
                  />
                  <NumberSpinner
                    label='Label'
                    description='Allows negatives (-10 to 10)'
                    value={spinnerNegativeValue}
                    min={-10}
                    max={10}
                    onValueChange={setSpinnerNegativeValue}
                  />
                  <NumberSpinner
                    label='Label'
                    description='Disabled'
                    value={spinnerDisabledValue}
                    min={1}
                    max={10}
                    disabled
                  />
                </View>
              </View>

              <View>
                <ThemedText variant='heading'>Typography Tokens</ThemedText>
                <ThemedText variant='body'>
                  Preview of every WhereWild typography variant.
                </ThemedText>
                <View style={styles.tokenSection}>
                  {TYPOGRAPHY_VARIANTS.map((variant) => (
                    <View
                      key={variant}
                      testID='typography-sample'
                      style={[
                        styles.typographyExample,
                        { borderBottomColor: palette.border.default.default },
                      ]}
                    >
                      <ThemedText variant='bodySmallStrong'>
                        {formatTokenLabel(variant)}
                      </ThemedText>
                      <ThemedText variant={variant}>
                        {TYPOGRAPHY_SAMPLE_TEXT}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <ThemedText variant='heading'>Shadow Tokens</ThemedText>
                <ThemedText variant='body'>
                  React Native previews for each drop shadow token.
                </ThemedText>
                <View style={styles.shadowGrid}>
                  {SHADOW_TOKEN_KEYS.map((tokenName) => {
                    const shadowToken = Shadows[tokenName];
                    return (
                      <View
                        key={tokenName}
                        testID='shadow-sample'
                        style={[
                          styles.shadowCard,
                          {
                            backgroundColor:
                              palette.background.default.secondary,
                          },
                          shadowToken.style,
                        ]}
                      >
                        <ThemedText variant='bodySmallStrong'>
                          {formatTokenLabel(tokenName)}
                        </ThemedText>
                        <ThemedText variant='body'>
                          {SHADOW_SAMPLE_TEXT}
                        </ThemedText>
                        <ThemedText variant='bodySmall'>
                          {shadowToken.layers.length} layer
                          {shadowToken.layers.length === 1 ? '' : 's'}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>

              <TimeEasingMatrixSection palette={palette} />

              <View>
                <ThemedText variant='heading'>Buttons</ThemedText>
                <ThemedText variant='bodySmall'>
                  Long press demo count: {buttonLongPressCount}
                  {buttonLongPressLastLabel
                    ? ` (last: ${buttonLongPressLastLabel})`
                    : ''}
                </ThemedText>
                {buttonRows.map(({ title, variant, buttons, danger }) => (
                  <View key={title}>
                    <ThemedText variant='bodyStrong'>{title}</ThemedText>
                    <View style={styles.row}>
                      {buttons.map(
                        ({
                          label,
                          size,
                          iconStart,
                          iconEnd,
                          disabled,
                          variant: overrideVariant,
                        }) => {
                          const buttonVariant = overrideVariant ?? variant;

                          if (danger) {
                            const dangerVariant =
                              buttonVariant === 'subtle' ? 'subtle' : 'primary';
                            return (
                              <ButtonDanger
                                key={label}
                                size={size}
                                variant={dangerVariant}
                                disabled={disabled}
                                iconStart={iconStart}
                                iconEnd={iconEnd}
                                onPress={noop}
                                onLongPress={
                                  disabled
                                    ? undefined
                                    : () => handleButtonLongPress(label)
                                }
                              >
                                {label}
                              </ButtonDanger>
                            );
                          }

                          return (
                            <Button
                              key={label}
                              size={size}
                              variant={buttonVariant}
                              disabled={disabled}
                              iconStart={iconStart}
                              iconEnd={iconEnd}
                              onPress={noop}
                              onLongPress={
                                disabled
                                  ? undefined
                                  : () => handleButtonLongPress(label)
                              }
                            >
                              {label}
                            </Button>
                          );
                        },
                      )}
                    </View>
                  </View>
                ))}

                {iconButtonVariants.map(({ title, variant }) => (
                  <View key={title}>
                    <ThemedText variant='bodyStrong'>{title}</ThemedText>
                    <View style={styles.row}>
                      {iconButtonStates.map(({ size, disabled }) => (
                        <IconButton
                          key={`${size}-${disabled}`}
                          variant={variant}
                          icon={<IconStar />}
                          accessibilityLabel='Star'
                          size={size}
                          disabled={disabled}
                          onPress={disabled ? undefined : noop}
                          onLongPress={
                            disabled
                              ? undefined
                              : () =>
                                  handleButtonLongPress(
                                    `IconButton (${variant}, ${size})`,
                                  )
                          }
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.aboutMapSection}>
              <ThemedText variant='heading'>Map Legend Bar</ThemedText>
              <ThemedText variant='body'>
                Vertical gradient legend overlaid on the map (heatmap color
                ramp).
              </ThemedText>
              <View style={styles.legendExampleRow}>
                {[
                  {
                    label: 'Annual Mean Temp',
                    min: -53.5,
                    max: 34.75,
                    units: '°C',
                  },
                  { label: 'Elevation', min: -430, max: 8850, units: 'm' },
                  {
                    label: 'Annual Precipitation',
                    min: 0,
                    max: 11401,
                    units: 'mm',
                  },
                ].map(({ label, min, max, units }) => {
                  const fmt = (v: number) =>
                    Math.abs(v) >= 1000
                      ? v.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : v.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        });
                  const gradientCss = VIRIDIS_CSS;
                  const nativeColors = VIRIDIS_COLORS;
                  return (
                    <View key={label} style={styles.legendExampleItem}>
                      <ThemedText variant='bodySmall'>{label}</ThemedText>
                      <View
                        style={[
                          styles.legendOverlayBox,
                          {
                            backgroundColor:
                              palette.background.default.secondary,
                          },
                        ]}
                      >
                        <ThemedText
                          variant='bodyTiny'
                          style={styles.legendOverlayLabel}
                        >
                          {fmt(max)}
                        </ThemedText>
                        {Platform.OS === 'web' ? (
                          <View
                            style={[
                              styles.legendOverlayBar,
                              {
                                height: 100,
                                backgroundImage: gradientCss,
                              } as object,
                            ]}
                          />
                        ) : (
                          <View
                            style={[
                              styles.legendOverlayBarFallback,
                              { height: 100 },
                            ]}
                          >
                            {nativeColors.map((color, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.legendOverlaySegment,
                                  { backgroundColor: color },
                                ]}
                              />
                            ))}
                          </View>
                        )}
                        <ThemedText
                          variant='bodyTiny'
                          style={styles.legendOverlayLabel}
                        >
                          {fmt(min)}
                        </ThemedText>
                        {units ? (
                          <ThemedText
                            variant='bodyTiny'
                            style={styles.legendOverlayUnits}
                          >
                            {units}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {(() => {
                  const bgColor = palette.background.default.secondary;
                  const nominalClasses = [
                    {
                      color: '#006400',
                      name: 'Closed evergreen broadleaved forest',
                    },
                    {
                      color: '#00A000',
                      name: 'Closed deciduous broadleaved forest',
                    },
                    {
                      color: '#AAC800',
                      name: 'Open deciduous broadleaved forest',
                    },
                    { color: '#FFFF64', name: 'Rainfed cropland' },
                    { color: '#AAF0F0', name: 'Irrigated cropland' },
                    { color: '#B4B4B4', name: 'Urban / built-up' },
                    { color: '#F0F0F0', name: 'Permanent snow and ice' },
                  ];
                  return (
                    <View style={styles.legendExampleItem}>
                      <ThemedText variant='bodySmall'>Land Cover</ThemedText>
                      <View
                        style={[
                          styles.legendNominalBox,
                          { backgroundColor: bgColor },
                        ]}
                      >
                        {nominalClasses.map(({ color, name }) => (
                          <View key={name} style={styles.legendNominalRow}>
                            <View
                              style={[
                                styles.legendNominalDot,
                                { backgroundColor: color },
                              ]}
                            />
                            <ThemedText
                              variant='bodyTiny'
                              style={styles.legendNominalLabel}
                              numberOfLines={1}
                            >
                              {name}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
                {(() => {
                  const RING = 68;
                  const HOLE = 38;
                  const bgColor = palette.background.default.secondary;
                  const conicCss = ASPECT_CONIC_CSS;
                  return (
                    <View style={styles.legendExampleItem}>
                      <ThemedText variant='bodySmall'>Aspect</ThemedText>
                      <View
                        style={[
                          styles.legendOverlayBox,
                          { backgroundColor: bgColor },
                        ]}
                      >
                        <ThemedText
                          variant='bodyTiny'
                          style={styles.legendCircleCardinal}
                        >
                          N
                        </ThemedText>
                        <View style={styles.legendCircleRow}>
                          <ThemedText
                            variant='bodyTiny'
                            style={styles.legendCircleCardinal}
                          >
                            W
                          </ThemedText>
                          {Platform.OS === 'web' ? (
                            <View
                              style={[
                                styles.legendCircleOuter,
                                {
                                  width: RING,
                                  height: RING,
                                  borderRadius: RING / 2,
                                  backgroundImage: conicCss,
                                } as object,
                              ]}
                            >
                              <View
                                style={[
                                  styles.legendCircleHole,
                                  {
                                    width: HOLE,
                                    height: HOLE,
                                    borderRadius: HOLE / 2,
                                    backgroundColor: bgColor,
                                  },
                                ]}
                              />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.legendCircleOuter,
                                {
                                  width: RING,
                                  height: RING,
                                  borderRadius: RING / 2,
                                  backgroundColor: ASPECT_NATIVE_COLOR,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.legendCircleHole,
                                  {
                                    width: HOLE,
                                    height: HOLE,
                                    borderRadius: HOLE / 2,
                                    backgroundColor: bgColor,
                                  },
                                ]}
                              />
                            </View>
                          )}
                          <ThemedText
                            variant='bodyTiny'
                            style={styles.legendCircleCardinal}
                          >
                            E
                          </ThemedText>
                        </View>
                        <ThemedText
                          variant='bodyTiny'
                          style={styles.legendCircleCardinal}
                        >
                          S
                        </ThemedText>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>
          </PageScrollContainer>
        </View>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentWeb: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Size.space['300'],
    flexWrap: 'wrap',
  },
  speciesPreview: {
    gap: Size.space['400'],
    padding: Size.space['400'],
    borderRadius: Size.radius['400'],
  },
  tabsRow: {
    paddingTop: Size.space['200'],
  },
  pillExamples: {
    paddingTop: Size.space['400'],
    gap: Size.space['400'],
  },
  pillExampleGroup: {
    gap: Size.space['200'],
  },
  pillContentCard: {
    padding: Size.space['300'],
    gap: Size.space['150'],
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
  },
  tokenSection: {
    gap: Size.space['400'],
  },
  typographyExample: {
    paddingVertical: Size.space['200'],
    gap: Size.space['150'],
    borderBottomWidth: Size.stroke.border,
  },
  shadowGrid: {
    gap: Size.space['400'],
  },
  shadowCard: {
    padding: Size.space['400'],
    gap: Size.space['200'],
    borderRadius: Size.radius['200'],
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['600'],
  },
  radioStateGroup: {
    width: 340,
    gap: Size.space['300'],
  },
  aboutMapSection: {
    gap: Size.space['250'],
  },
  legendExampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
    alignItems: 'flex-start',
  },
  legendExampleItem: {
    alignItems: 'center',
    gap: Size.space['150'],
  },
  legendOverlay: {
    position: 'absolute',
    left: 8,
    // Leaflet zoom: 10px margin + 26px (+) + 1px separator + 26px (-) = 63px; add 9px gap = 72 → round to 82
    top: 82,
    bottom: 10,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    alignItems: 'center',
    gap: Size.space['100'],
  },
  legendOverlayBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  legendOverlayBarContainer: {
    width: 12,
    position: 'relative',
  },
  legendPinLine: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: '#fffffff2',
  },
  legendPinLabelContainer: {
    flex: 1,
    position: 'relative',
    marginLeft: 4,
  },
  legendPinLabel: {
    position: 'absolute',
    color: '#fffffff2',
    transform: [{ translateY: -6 }],
  },
  legendOverlayBox: {
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    alignItems: 'center',
    gap: Size.space['100'],
  },
  legendOverlayBar: {
    width: 12,
    borderRadius: 4,
  },
  legendOverlayBarFallback: {
    width: 12,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  legendOverlaySegment: {
    flex: 1,
    width: 12,
  },
  legendOverlayLabel: {
    textAlign: 'center',
  },
  legendOverlayUnits: {
    textAlign: 'center',
    opacity: 0.7,
  },
  legendCircleOverlay: {
    position: 'absolute',
    left: 8,
    top: 82,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    alignItems: 'center',
    gap: 2,
  },
  legendCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCircleOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendCircleHole: {
    // size and backgroundColor set inline
  },
  legendCircleCardinal: {
    textAlign: 'center',
    opacity: 0.8,
  },
  legendNominalOverlay: {
    position: 'absolute',
    left: 8,
    top: 82,
    bottom: 10,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    gap: Size.space['100'],
    maxWidth: 200,
    overflow: 'hidden',
  },
  legendNominalBox: {
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    gap: Size.space['100'],
    minWidth: 160,
  },
  legendNominalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
  legendNominalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendNominalLabel: {
    flex: 1,
  },
});
