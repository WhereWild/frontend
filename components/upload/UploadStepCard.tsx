import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { IconUpload } from '@/assets/icons';
import { Button, ThemedText } from '@/components';
import { Size, type Colors } from '@/constants/theme';

type UploadStepCardProps = {
  description: string;
  disabled?: boolean;
  isLoading: boolean;
  label: string;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
  stepTitle: string;
  onPress: () => void;
};

export function UploadStepCard({
  description,
  disabled = false,
  isLoading,
  label,
  palette,
  stepTitle,
  onPress,
}: UploadStepCardProps) {
  return (
    <View
      style={[
        styles.stepCard,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ThemedText variant='heading'>{stepTitle}</ThemedText>
      <ThemedText variant='body' style={styles.stepDescription}>
        {description}
      </ThemedText>
      <View style={styles.buttonRow}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.icon.brand.default} />
            <ThemedText variant='body'>Generating zip...</ThemedText>
          </View>
        ) : (
          <Button
            iconStart={<IconUpload />}
            disabled={disabled}
            label={label}
            onPress={onPress}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepCard: {
    flex: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['300'],
  },
  stepDescription: {
    flexGrow: 1,
  },
  buttonRow: {
    width: '100%',
    minHeight: Size.control.height.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    minHeight: Size.control.height.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.space['400'],
  },
});
