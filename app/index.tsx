import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ButtonDanger, IconButton } from '@/components';
import { Colors, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconStar,
  IconTrash,
} from '@/assets/icons';
import type { IconSize } from '@/primitives';

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
  const iconSize: IconSize = '20';

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
        { label: 'Download', iconStart: <IconDownload size={iconSize} /> },
        { label: 'Continue', iconEnd: <IconArrowRight size={iconSize} /> },
        {
          label: 'Favorite',
          iconStart: <IconStar size={iconSize} />,
          iconEnd: <IconArrowRight size={iconSize} />,
        },
      ],
    },
    {
      title: 'Button — Neutral (Icons)',
      variant: 'neutral',
      buttons: [
        { label: 'Back', iconStart: <IconArrowLeft size={iconSize} /> },
        { label: 'Next', iconEnd: <IconArrowRight size={iconSize} /> },
        {
          label: 'Export',
          iconStart: <IconDownload size={iconSize} />,
          iconEnd: <IconArrowRight size={iconSize} />,
        },
      ],
    },
    {
      title: 'Button — Subtle (Icons)',
      variant: 'subtle',
      buttons: [
        { label: 'Highlight', iconStart: <IconStar size={iconSize} /> },
        { label: 'Learn More', iconEnd: <IconArrowRight size={iconSize} /> },
        {
          label: 'Browse',
          iconStart: <IconArrowLeft size={iconSize} />,
          iconEnd: <IconArrowRight size={iconSize} />,
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
        { label: 'Delete', iconStart: <IconTrash size={iconSize} /> },
        { label: 'Confirm', iconEnd: <IconArrowRight size={iconSize} /> },
        {
          label: 'Report',
          variant: 'subtle',
          iconStart: <IconAlertTriangle size={iconSize} />,
          iconEnd: <IconArrowRight size={iconSize} />,
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
                    onPress={() => {}}
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
                  onPress={() => {}}
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
                icon={<IconStar size={iconSize} />}
                accessibilityLabel="Star"
                size={size}
                disabled={disabled}
                onPress={disabled ? undefined : () => {}}
              />
            ))}
          </View>
        </View>
      ))}
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
