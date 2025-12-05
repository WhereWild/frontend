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
  InlineExpandableRows,
  NearbySpeciesCarousel,
  SearchInput,
  SelectField,
  SpeciesCard,
  SpeciesPageHeader,
  SwitchField,
  ThemedText,
} from '@/components';
import { Colors, Responsive, Shadows, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useColorScheme } from '@/hooks/useColorScheme';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const SPECIES_CARD_IMAGE = require('@/assets/images/placeholder.png');
const SELECT_FIELD_OPTIONS = [
  { label: 'Fennec Fox', value: 'fennec' },
  { label: 'Red Panda', value: 'panda' },
  { label: 'Snowy Owl', value: 'owl' },
  { label: 'Lynx', value: 'lynx' },
];

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
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  disabled?: boolean;
  variant?: ButtonVariant;
};

const noop = () => { };

export default function About() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchEvent, setLastSearchEvent] = useState('Waiting for input…');
  const [selectedSpecies, setSelectedSpecies] = useState<string | undefined>();
  const [switchOnValue, setSwitchOnValue] = useState(true);
  const [switchOffValue, setSwitchOffValue] = useState(false);
  const selectedSpeciesLabel = SELECT_FIELD_OPTIONS.find((option) => option.value === selectedSpecies)?.label;
  const speciesSample = mountainBallCactusData;
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

  return (
    <>
      <Head>
        <title>WhereWild | About</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
        testID="about-screen"
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.pageTitleContainer}>
            <View style={styles.pageTitle}>
              <ThemedText variant="titlePage">About WhereWild</ThemedText>
              <View
                style={[
                  styles.pageTitleDivider,
                  { backgroundColor: palette.border.brand.secondary },
                ]}
              />
              <ThemedText variant="body">
                WhereWild is a naturalist companion that blends field observations, environmental
                summaries, and predictive heatmaps so explorers can plan responsibly and share
                insights with their teams.
              </ThemedText>
            </View>
          </View>

          <View style={styles.playgroundSection}>
            <ThemedText variant="heading">Component Playground</ThemedText>
            <ThemedText variant="body">
              Experiment with live design-system primitives below to validate copy, interactions,
              and accessibility behaviors before promoting them into production screens.
            </ThemedText>
          </View>

          <View style={styles.playgroundContent}>
            <View>
              <ThemedText variant="subheading">Search Input</ThemedText>
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
              <ThemedText variant="subheading">Select Field</ThemedText>
              <ThemedText variant="body">
                {selectedSpeciesLabel
                  ? `Current selection: ${selectedSpeciesLabel}`
                  : 'Pick a species to update the selection state.'}
              </ThemedText>
              <View style={styles.fieldRow}>
                <View style={styles.selectFieldItem}>
                  <SelectField
                    label="Species"
                    description="Updates the About playground state"
                    options={SELECT_FIELD_OPTIONS}
                    placeholder="Choose a species"
                    value={selectedSpecies}
                    onValueChange={setSelectedSpecies}
                  />
                </View>
                <View style={styles.selectFieldItem}>
                  <SelectField
                    label="Disabled"
                    description="Pre-selected + read only"
                    options={SELECT_FIELD_OPTIONS}
                    defaultValue={SELECT_FIELD_OPTIONS[0].value}
                    disabled
                  />
                </View>
                <View style={styles.selectFieldItem}>
                  <SelectField
                    label="Validation"
                    description="Demonstrates error messaging"
                    options={SELECT_FIELD_OPTIONS}
                    placeholder="Select one"
                    errorMessage="Selection required"
                  />
                </View>
              </View>
            </View>

            <View>
              <ThemedText variant="subheading">Switch Field</ThemedText>
              <View style={styles.switchGrid}>
                <View style={styles.switchFieldItem}>
                  <SwitchField
                    label="Sightings alerts"
                    description="Send push notifications when rare species are nearby."
                    value={switchOnValue}
                    onValueChange={setSwitchOnValue}
                  />
                </View>
                <View style={styles.switchFieldItem}>
                  <SwitchField
                    label="Location sharing"
                    description="Allow WhereWild to access device GPS data."
                    value={switchOffValue}
                    onValueChange={setSwitchOffValue}
                  />
                </View>
                <View style={styles.switchFieldItem}>
                  <SwitchField
                    label="Summary emails"
                    description="Weekly recap is always on for team admins."
                    value
                    disabled
                  />
                </View>
                <View style={styles.switchFieldItem}>
                  <SwitchField
                    label="Auto-download maps"
                    description="Disabled until offline mode is enabled."
                    value={false}
                    disabled
                  />
                </View>
              </View>
            </View>

            <View>
              <ThemedText variant="subheading">Species Card</ThemedText>
              <SpeciesCard
                taxonId={speciesSample.taxonId}
                commonName="Common Name"
                scientificName="Binomial nomenclature"
                description="Description"
                imageSource={SPECIES_CARD_IMAGE}
              />
            </View>

            <View>
              <ThemedText variant="subheading">Species Page Components</ThemedText>
              <ThemedText variant="body">
                Preview of the composable building blocks used on the species detail page.
              </ThemedText>
              <View
                style={[
                  styles.speciesPreview,
                ]}
              >
                <SpeciesPageHeader
                  commonName={speciesSample.commonName}
                  scientificName={speciesSample.scientificName}
                  onPressDownload={noop}
                />
                <InlineExpandableRows
                  sections={speciesSample.dataSections}
                  taxonId={speciesSample.taxonId}
                />
                <NearbySpeciesCarousel species={speciesSample.nearbySpecies} />
              </View>
            </View>

            <View>
              <ThemedText variant="subheading">Shadow Tokens</ThemedText>
              <ThemedText variant="body">
                Drop shadow tokens translate directly to React Native styles. The card below uses the
                heaviest token (dropShadow600) so you can verify the visual depth.
              </ThemedText>
              <View style={styles.shadowDemoWrapper}>
                <View
                  style={[
                    styles.shadowDemoCard,
                    {
                      backgroundColor: palette.background.default.secondary,
                      borderColor: palette.border.default.secondary,
                    },
                    Shadows.dropShadow600.style,
                  ]}
                >
                  <ThemedText variant="bodyStrong">dropShadow600</ThemedText>
                  <ThemedText variant="body">
                    Built from the design system token with a 16px Y-offset and 32px blur.
                  </ThemedText>
                </View>
              </View>
            </View>

            <View>
              <ThemedText variant="subheading">Buttons</ThemedText>
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
  container: {
    width: '100%',
    paddingTop: Size.space['800'],
    paddingBottom: Size.space['1600'],
    paddingHorizontal: Responsive.marginHorizontal,
    alignItems: 'center',
    gap: Size.space['800'],
  },
  pageTitleContainer: {
    width: '100%',
    alignItems: 'center',
  },
  pageTitle: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    gap: Size.space['300'],
  },
  pageTitleDivider: {
    height: Size.stroke.border,
    width: '100%',
  },
  playgroundSection: {
    width: '100%',
    maxWidth: Responsive.textWidth,
    gap: Size.space['200'],
  },
  playgroundContent: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    gap: Size.space['800'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Size.space['300'],
    flexWrap: 'wrap',
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
  },
  selectFieldItem: {
    flex: 1,
    minWidth: Size.space['4000'],
  },
  switchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
  },
  switchFieldItem: {
    flex: 1,
    minWidth: Size.space['4000'],
  },
  speciesPreview: {
    gap: Size.space['400'],
    padding: Size.space['400'],
    borderRadius: Size.radius['400'],
  },
  shadowDemoWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: Size.space['400'],
  },
  shadowDemoCard: {
    width: '100%',
    maxWidth: Size.space['8000'],
    borderRadius: Size.radius['400'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: Size.space['600'],
    gap: Size.space['300'],
  },

});
