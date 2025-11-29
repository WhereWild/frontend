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
  PageHeader,
  SearchInput,
  SpeciesCard,
  ThemedText,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

const SPECIES_CARD_IMAGE = {
  uri: 'https://www.figma.com/api/mcp/asset/4518cadf-c93e-418b-8fce-72c496cb5efb',
} as const;

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

type AppRoute = '/' | '/about';

const noop = () => {};

export default function About() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const submitSearchQuery = (query: string) => {
    router.push({pathname: '/search', params: {query: query}});
  };
  const [lastSearchEvent, setLastSearchEvent] = useState('Waiting for input…');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
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

  const navigateTo = (path: AppRoute) => {
    if (pathname !== path) {
      router.push(path);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: Colors[mode].background.default.default }]}>
      <PageHeader
        searchValue={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        onSubmitSearch={submitSearchQuery}
        onLogoPress={() => navigateTo('/')}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <ThemedText variant="heading">Species Card</ThemedText>
          <SpeciesCard
            commonName="Common Name"
            scientificName="Binomial nomenclature"
            description="Description"
            imageSource={SPECIES_CARD_IMAGE}
          />
        </View>

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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: Size.space[600],
    gap: Size.space[600],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Size.space[300],
    flexWrap: 'wrap',
  },
});
