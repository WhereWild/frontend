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
  IconButton,
  NavigationPillList,
  NearbySpeciesCarousel,
  WebPageHeader,
  RadioGroup,
  SearchInput,
  SelectField,
  SwitchField,
  SpeciesCard,
  SpeciesPageTitle,
  Tabs,
  ThemedText,
} from '@/components';
import type { ButtonProps } from '@/components';
import { Colors, Shadows, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { TimeEasingMatrixSection } from './TimeEasingMatrixSection';
import Head from 'expo-router/head';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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

const noop = () => { };

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
  const [selectSearchableValue, setSelectSearchableValue] = useState('');
  const [selectSearchableTertiaryValue, setSelectSearchableTertiaryValue] = useState('');
  const [selectSearchablePlaceholderValue, setSelectSearchablePlaceholderValue] = useState('');
  const [selectSearchableDisabledValue] = useState('hello');
  const [selectSearchableErrorValue, setSelectSearchableErrorValue] = useState('hello');
  const [selectListOnlyValue, setSelectListOnlyValue] = useState('');
  const [selectListOnlyPlaceholderValue, setSelectListOnlyPlaceholderValue] = useState('');
  const [selectLongPlaceValue, setSelectLongPlaceValue] = useState('');
  const [switchValue, setSwitchValue] = useState(true);
  const [radioGroupValue, setRadioGroupValue] = useState('checked');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [overviewPill, setOverviewPill] = useState('all');
  const [habitatPill, setHabitatPill] = useState('soil');
  const [trackingPill, setTrackingPill] = useState('recent');
  const [imagesPill, setImagesPill] = useState('all');
  const [notesPill, setNotesPill] = useState('notes');
  const speciesSample = mountainBallCactusData;
  const selectOptions = [
    { label: 'Hello World', value: 'hello' },
    { label: 'Option 2', value: 'option-2' },
    { label: 'Option 3', value: 'option-3' },
    { label: 'Option 4', value: 'option-4' },
    { label: 'Option 5', value: 'option-5' },
    { label: 'Option 6', value: 'option-6' },
    { label: 'Option 7', value: 'option-7' },
    { label: 'Option 8', value: 'option-8' },
    { label: 'Option 9', value: 'option-9' },
    { label: 'Option 10', value: 'option-10' },
  ];
  const longPlaceOptions = [
    {
      label: 'Parque Nacional Torres del Paine, Región de Magallanes y de la Antártica Chilena, Chile',
      value: 'torres-del-paine-chile',
    },
    {
      label: 'Grosser Aletschgletscher and Jungfrau-Aletsch UNESCO World Heritage Site, Switzerland',
      value: 'jungfrau-aletsch-switzerland',
    },
    {
      label: 'Wadi Rum Protected Area (Valley of the Moon), Aqaba Governorate, Jordan',
      value: 'wadi-rum-jordan',
    },
    {
      label: 'Papahānaumokuākea Marine National Monument, Northwestern Hawaiian Islands, USA',
      value: 'papahanaumokuakea-usa',
    },
    {
      label: 'Kluane / Wrangell-St. Elias / Glacier Bay / Tatshenshini-Alsek World Heritage Site, Canada-USA',
      value: 'kluane-wrangell-glacier-bay',
    },
    {
      label: 'Te Urewera Forest and Lake Waikaremoana, North Island, Aotearoa New Zealand',
      value: 'te-urewera-new-zealand',
    },
    {
      label: 'Bialowieza Forest (Białowieża), Podlaskie Voivodeship, Poland-Belarus',
      value: 'bialowieza-forest',
    },
    {
      label: 'Sagarmatha National Park (Everest Region), Province No. 1, Nepal',
      value: 'sagarmatha-nepal',
    },
  ];
  const radioOptions = [
    { label: 'Label', description: 'Description', value: 'checked' },
    { label: 'Label', description: 'Description', value: 'unchecked' },
  ];
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
      <ThemedText variant="body">{content}</ThemedText>
    </View>
  );

  return (
    <>
      <Head>
        <title>WhereWild | About</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <WebPageHeader />

        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
            includeBottomPadding: true,
            includeGap: true,
          })}
        >
          <View>
            <ThemedText variant="heading">Search Input</ThemedText>
            <View>
              <SearchInput
                value={searchQuery}
                placeholder="Search species"
                onQueryChange={(value) => {
                  setSearchQuery(value);
                  setLastSearchEvent(value ? `Query changed: ${value}` : 'Search cleared');
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
                returnKeyType="search"
                accessibilityLabel="Search species"
              />
            </View>
            <ThemedText variant="body">{lastSearchEvent}</ThemedText>
            <ThemedText variant="bodyStrong">Disabled</ThemedText>
            <View>
              <SearchInput
                placeholder="Search species"
                accessibilityLabel="Search species"
                disabled
              />
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Select Field</ThemedText>
            <View style={styles.selectGrid}>
              <SelectField
                label="Label (Searchable)"
                description="Type to filter"
                value={selectSearchableValue}
                placeholder="Value"
                options={selectOptions}
                onValueChange={setSelectSearchableValue}
              />
              <SelectField
                label="Label (Searchable, tertiary)"
                description="Type to filter"
                value={selectSearchableTertiaryValue}
                options={selectOptions}
                variant="tertiary"
                onValueChange={setSelectSearchableTertiaryValue}
              />
              <SelectField
                label="Label (Searchable - Placeholder)"
                description="No selection"
                value={selectSearchablePlaceholderValue}
                placeholder="Value"
                options={selectOptions}
                onValueChange={setSelectSearchablePlaceholderValue}
              />
              <SelectField
                label="Label (Searchable - Disabled)"
                description="Disabled"
                value={selectSearchableDisabledValue}
                placeholder="Value"
                options={selectOptions}
                disabled
              />
              <SelectField
                label="Label (Searchable - Error)"
                description="Shows error"
                value={selectSearchableErrorValue}
                placeholder="Value"
                options={selectOptions}
                onValueChange={setSelectSearchableErrorValue}
                errorMessage="Error"
              />
              <SelectField
                label="Label (List Only)"
                description="No text entry"
                value={selectListOnlyValue}
                placeholder="Value"
                options={selectOptions}
                allowSearch={false}
                onValueChange={setSelectListOnlyValue}
              />
              <SelectField
                label="Label (List Only - Placeholder)"
                description="No selection"
                value={selectListOnlyPlaceholderValue}
                placeholder="Value"
                options={selectOptions}
                allowSearch={false}
                onValueChange={setSelectListOnlyPlaceholderValue}
              />
              <SelectField
                label="Label (Searchable - Long place names)"
                description="Type to filter"
                value={selectLongPlaceValue}
                placeholder="Start typing a place name"
                options={longPlaceOptions}
                onValueChange={setSelectLongPlaceValue}
              />
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Switch Field</ThemedText>
            <View style={styles.selectGrid}>
              <SwitchField
                label="Label"
                description="Description"
                value={switchValue}
                onValueChange={setSwitchValue}
              />
              <SwitchField
                label="Label"
                description="Description"
                value={false}
                disabled
              />
              <SwitchField
                label="Label"
                description="Description"
                value={true}
                disabled
              />
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Radio Field</ThemedText>
            <View style={styles.selectGrid}>
              <View style={styles.radioStateGroup}>
                <ThemedText variant="body">State=Default</ThemedText>
                <RadioGroup
                  options={radioOptions}
                  value={radioGroupValue}
                  onValueChange={setRadioGroupValue}
                />
              </View>

              <View style={styles.radioStateGroup}>
                <ThemedText variant="body">State=Disabled</ThemedText>
                <RadioGroup
                  options={radioOptions}
                  value="checked"
                  disabled
                />
              </View>
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Species Card</ThemedText>
            <SpeciesCard
              taxonId={speciesSample.taxonId}
              commonName="Common Name"
              scientificName="Binomial nomenclature"
              description="Description"
              imageSource={SPECIES_CARD_IMAGE}
            />
            <ThemedText variant="bodyStrong">Mini (search results)</ThemedText>
            <SpeciesCard
              taxonId={12345}
              commonName="Common Name"
              scientificName="Binomial nomenclature"
              imageSource={SPECIES_CARD_IMAGE}
              size="compact"
            />
          </View>

          <View>
            <ThemedText variant="heading">Species Page Components</ThemedText>
            <ThemedText variant="body">
              Preview of the composable building blocks used on the species detail page.
            </ThemedText>
            <View
              style={[
                styles.speciesPreview,
              ]}
            >
              <SpeciesPageTitle
                commonName={speciesSample.commonName}
                scientificName={speciesSample.scientificName}
                onPressDownload={noop}
              />
              <NearbySpeciesCarousel species={speciesSample.nearbySpecies} />
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Tabs</ThemedText>
            <ThemedText variant="body">Controlled tabs with keyboard navigation.</ThemedText>
            <View style={styles.tabsRow}>
              <Tabs
                tabs={tabsSample}
                selectedKey={selectedTab}
                onSelectionChange={setSelectedTab}
                accessibilityLabel="Species tabs"
              />
            </View>
            <View style={styles.pillExamples}>
              {selectedTab === 'overview' && (
                <View style={styles.pillExampleGroup}>
                  <ThemedText variant="bodySmallStrong">Horizontal wrap</ThemedText>
                  <NavigationPillList
                    pills={overviewPills}
                    selectedKey={overviewPill}
                    onSelectionChange={setOverviewPill}
                    accessibilityLabel="Overview filters"
                  />
                  {renderPillContentCard(overviewContent[overviewPill])}
                </View>
              )}
              {selectedTab === 'habitat' && (
                <View style={styles.pillExampleGroup}>
                  <ThemedText variant="bodySmallStrong">Vertical list</ThemedText>
                  <NavigationPillList
                    pills={habitatPills}
                    selectedKey={habitatPill}
                    onSelectionChange={setHabitatPill}
                    direction="vertical"
                    accessibilityLabel="Habitat filters"
                  />
                  {renderPillContentCard(habitatContent[habitatPill])}
                </View>
              )}
              {selectedTab === 'tracking' && (
                <View style={styles.pillExampleGroup}>
                  <ThemedText variant="bodySmallStrong">Mixed label lengths</ThemedText>
                  <NavigationPillList
                    pills={trackingPills}
                    selectedKey={trackingPill}
                    onSelectionChange={setTrackingPill}
                    accessibilityLabel="Tracking filters"
                  />
                  {renderPillContentCard(trackingContent[trackingPill])}
                </View>
              )}
              {selectedTab === 'images' && (
                <View style={styles.pillExampleGroup}>
                  <ThemedText variant="bodySmallStrong">Image categories</ThemedText>
                  <NavigationPillList
                    pills={imagesPills}
                    selectedKey={imagesPill}
                    onSelectionChange={setImagesPill}
                    accessibilityLabel="Image filters"
                  />
                  {renderPillContentCard(imagesContent[imagesPill])}
                </View>
              )}
              {selectedTab === 'notes' && (
                <View style={styles.pillExampleGroup}>
                  <ThemedText variant="bodySmallStrong">Notes sections</ThemedText>
                  <NavigationPillList
                    pills={notesPills}
                    selectedKey={notesPill}
                    onSelectionChange={setNotesPill}
                    accessibilityLabel="Notes filters"
                  />
                  {renderPillContentCard(notesContent[notesPill])}
                </View>
              )}
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Typography Tokens</ThemedText>
            <ThemedText variant="body">Preview of every WhereWild typography variant.</ThemedText>
            <View style={styles.tokenSection}>
              {TYPOGRAPHY_VARIANTS.map((variant) => (
                <View
                  key={variant}
                  testID="typography-sample"
                  style={[
                    styles.typographyExample,
                    { borderBottomColor: palette.border.default.default },
                  ]}
                >
                  <ThemedText variant="bodySmallStrong">{formatTokenLabel(variant)}</ThemedText>
                  <ThemedText variant={variant}>
                    {TYPOGRAPHY_SAMPLE_TEXT}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View>
            <ThemedText variant="heading">Shadow Tokens</ThemedText>
            <ThemedText variant="body">React Native previews for each drop shadow token.</ThemedText>
            <View style={styles.shadowGrid}>
              {SHADOW_TOKEN_KEYS.map((tokenName) => {
                const shadowToken = Shadows[tokenName];
                return (
                  <View
                    key={tokenName}
                    testID="shadow-sample"
                    style={[
                      styles.shadowCard,
                      {
                        backgroundColor: palette.background.default.secondary,
                      },
                      shadowToken.style,
                    ]}
                  >
                    <ThemedText variant="bodySmallStrong">{formatTokenLabel(tokenName)}</ThemedText>
                    <ThemedText variant="body">{SHADOW_SAMPLE_TEXT}</ThemedText>
                    <ThemedText variant="bodySmall">
                      {shadowToken.layers.length} layer{shadowToken.layers.length === 1 ? '' : 's'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>

          <TimeEasingMatrixSection palette={palette} />

          <View>
            <ThemedText variant="heading">Buttons</ThemedText>
            {buttonRows.map(({ title, variant, buttons, danger }) => (
              <View key={title}>
                <ThemedText variant="bodyStrong">{title}</ThemedText>
                <View style={styles.row}>
                  {buttons.map(({ label, size, iconStart, iconEnd, disabled, variant: overrideVariant }) => {
                    const buttonVariant = overrideVariant ?? variant;

                    if (danger) {
                      const dangerVariant = buttonVariant === 'subtle' ? 'subtle' : 'primary';
                      return (
                        <ButtonDanger
                          key={label}
                          size={size}
                          variant={dangerVariant}
                          disabled={disabled}
                          iconStart={iconStart}
                          iconEnd={iconEnd}
                          onPress={noop}
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
                      >
                        {label}
                      </Button>
                    );
                  })}
                </View>
              </View>
            ))}

            {iconButtonVariants.map(({ title, variant }) => (
              <View key={title}>
                <ThemedText variant="bodyStrong">{title}</ThemedText>
                <View style={styles.row}>
                  {iconButtonStates.map(({ size, disabled }) => (
                    <IconButton
                      key={`${size}-${disabled}`}
                      variant={variant}
                      icon={<IconStar />}
                      accessibilityLabel="Star"
                      size={size}
                      disabled={disabled}
                      onPress={disabled ? undefined : noop}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
});
