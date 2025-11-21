import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconStar,
  IconTrash,
} from '@/assets/icons';
import { Button, ButtonDanger, IconButton, SearchInput, SpeciesCard } from '@/components';
import { Colors, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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

export default function Index() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchEvent, setLastSearchEvent] = useState('Waiting for input…');
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
    <ScrollView contentContainerStyle={[
      styles.container,
      { backgroundColor: Colors[mode].background.default.default }
    ]}>
      <View>
        <Text style={Typography[mode].heading}>Species Card</Text>
        <SpeciesCard
          commonName="Common Name"
          scientificName="Binomial nomenclature"
          description="Description"
          imageSource={SPECIES_CARD_IMAGE}
        />
      </View>

      <View>
        <Text style={Typography[mode].heading}>Search Input</Text>
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
        <Text style={Typography[mode].body}>{lastSearchEvent}</Text>
        <Text style={Typography[mode].bodyStrong}>Disabled</Text>
        <View>
          <SearchInput
            placeholder="Search species"
            accessibilityLabel="Search species"
            disabled
          />
        </View>
      </View>

      <View>
        <Text style={Typography[mode].heading}>Buttons</Text>
        {buttonRows.map(({ title, variant, buttons, danger }) => (
          <View key={title}>
            <Text style={Typography[mode].bodyStrong}>{title}</Text>
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
                      onPress={() => { }}
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
                    onPress={() => { }}
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
            <Text style={Typography[mode].bodyStrong}>{title}</Text>
            <View style={styles.row}>
              {iconButtonStates.map(({ size, disabled }) => (
                <IconButton
                  key={`${size}-${disabled}`}
                  variant={variant}
                  icon={<IconStar />}
                  accessibilityLabel="Star"
                  size={size}
                  disabled={disabled}
                  onPress={disabled ? undefined : () => { }}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Size.space[600],
    gap: Size.space[600],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Size.space[300],
  },
});
