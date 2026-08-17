// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { IconDownload, IconUpload } from '@/assets/icons';
import { Button, ThemedText } from '@/components';
import { Size, type Colors } from '@/constants/theme';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { useResponsive } from '@/hooks/useResponsive';
import { anchorScrollMarginStyle } from '@/utils/anchors';
import { toKebabCase } from '@/utils/string';

type UploadStepCardAction = {
  isLoading?: boolean;
  label: string;
  loadingLabel?: string;
  onPress: () => void;
  variant?: React.ComponentProps<typeof Button>['variant'];
};

type UploadStepCardProps = {
  description: string;
  disabled?: boolean;
  isLoading: boolean;
  label: string;
  loadingLabel?: string;
  matchSiblingHeight?: boolean;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
  secondaryAction?: UploadStepCardAction;
  stepTitle: string;
  testID?: string;
  onPress: () => void;
};

export function UploadStepCard({
  description,
  disabled = false,
  isLoading,
  label,
  loadingLabel = 'Generating zip...',
  matchSiblingHeight = true,
  palette,
  secondaryAction,
  stepTitle,
  testID,
  onPress,
}: UploadStepCardProps) {
  const responsive = useResponsive();
  const { webHeaderHeight } = useLayoutChrome();
  const resolvedSecondaryAction = secondaryAction ?? null;
  const showPrimaryAction = !isLoading;
  const showPrimaryLoading = isLoading;
  const showSecondaryAction = Boolean(
    resolvedSecondaryAction && !resolvedSecondaryAction.isLoading,
  );
  const showSecondaryLoading = Boolean(resolvedSecondaryAction?.isLoading);

  return (
    <View
      testID={testID}
      style={[
        styles.stepCard,
        matchSiblingHeight
          ? styles.stepCardMatchSiblingHeight
          : styles.stepCardContentHeight,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ThemedText
        variant='heading'
        {...(Platform.OS === 'web'
          ? {
              nativeID: toKebabCase(stepTitle),
              style: anchorScrollMarginStyle(
                webHeaderHeight,
                responsive.breakpoint,
              ),
            }
          : {})}
      >
        {stepTitle}
      </ThemedText>
      <ThemedText
        variant='body'
        style={[
          styles.stepDescription,
          matchSiblingHeight && styles.stepDescriptionMatchSiblingHeight,
        ]}
      >
        {description}
      </ThemedText>
      <View style={styles.buttonRow} collapsable={false}>
        <View
          testID='upload-step-card-primary-slot'
          collapsable={false}
          style={!showPrimaryAction && styles.hiddenButtonSlot}
        >
          {showPrimaryAction ? (
            <Button
              iconStart={<IconUpload />}
              disabled={disabled}
              enableHaptics
              label={label}
              onPress={onPress}
            />
          ) : null}
        </View>

        <View
          testID='upload-step-card-primary-loading-slot'
          collapsable={false}
          style={!showPrimaryLoading && styles.hiddenButtonSlot}
        >
          {showPrimaryLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={palette.icon.brand.default} />
              <ThemedText variant='body'>{loadingLabel}</ThemedText>
            </View>
          ) : null}
        </View>

        <View
          testID='upload-step-card-secondary-slot'
          collapsable={false}
          style={!showSecondaryAction && styles.hiddenButtonSlot}
        >
          {showSecondaryAction && resolvedSecondaryAction ? (
            <Button
              iconStart={<IconDownload />}
              disabled={disabled}
              enableHaptics={true}
              label={resolvedSecondaryAction.label}
              onPress={resolvedSecondaryAction.onPress}
              variant={resolvedSecondaryAction.variant ?? 'neutral'}
            />
          ) : null}
        </View>

        <View
          testID='upload-step-card-secondary-loading-slot'
          collapsable={false}
          style={!showSecondaryLoading && styles.hiddenButtonSlot}
        >
          {showSecondaryLoading && resolvedSecondaryAction ? (
            <View style={styles.secondaryLoadingRow}>
              <ActivityIndicator color={palette.icon.brand.default} />
              <ThemedText variant='body'>
                {resolvedSecondaryAction.loadingLabel ??
                  resolvedSecondaryAction.label}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepCard: {
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space.text.paragraph,
  },
  stepCardMatchSiblingHeight: {
    flex: 1,
  },
  stepCardContentHeight: {
    width: '100%',
  },
  stepDescription: {
    width: '100%',
  },
  stepDescriptionMatchSiblingHeight: {
    flexGrow: 1,
  },
  buttonRow: {
    width: '100%',
    minHeight: Size.control.height.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Size.space['300'],
  },
  hiddenButtonSlot: {
    position: 'absolute',
  },
  loadingRow: {
    minHeight: Size.control.height.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.space['400'],
  },
  secondaryLoadingRow: {
    minHeight: Size.control.height.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.space['300'],
  },
});
