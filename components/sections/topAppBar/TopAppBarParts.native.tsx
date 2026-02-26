import {
  IconChevronLeft,
} from '@/assets/icons';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { SearchInput } from '@/components/inputs/SearchInput';
import { ThemedText } from '@/components/text/ThemedText';
import { Size } from '@/constants/theme';
import type {
  LeadingContentProps,
  PrimaryActionProps,
} from './TopAppBar.types';
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const LOGO_SIZE = 40;

export function LeadingContent(props: LeadingContentProps) {
  switch (props.variant) {
    case 'search':
      return (
        <View style={styles.searchWrapper} testID="top-app-bar-leading">
          <SearchInput
            value={props.searchValue}
            onQueryChange={props.onSearchValueChange}
            onSubmitSearch={props.onSubmitSearch}
            placeholder={props.searchPlaceholder ?? 'Search'}
          />
        </View>
      );
    case 'page':
      return (
        <View style={styles.leadingRow} testID="top-app-bar-leading">
          <IconButton
            variant="subtle"
            icon={<IconChevronLeft />}
            onPress={props.onPressBack}
            accessibilityLabel="Back"
          />
          <ThemedText
            variant="heading"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.title}
          >
            {props.title}
          </ThemedText>
        </View>
      );
    default:
      return (
        <View style={styles.leadingRow} testID="top-app-bar-leading">
          {typeof props.onPressLogo === 'function' ? (
            <Pressable
              onPress={props.onPressLogo}
              accessibilityRole="button"
              accessibilityLabel={props.logoAccessibilityLabel}
              style={styles.logoPressable}
            >
              <Image
                testID="top-app-bar-home-logo-image"
                source={props.logoSource}
                style={styles.logo}
                resizeMode="contain"
                accessibilityRole="image"
              />
            </Pressable>
          ) : (
            <Image
              testID="top-app-bar-home-logo-image"
              source={props.logoSource}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={props.logoAccessibilityLabel}
            />
          )}
          <ThemedText
            variant="heading"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.title}
          >
            {props.title}
          </ThemedText>
        </View>
      );
  }
}

export function PrimaryAction({
  hasPrimaryButton,
  shouldRenderPrimaryAsIcon,
  primaryButtonIcon,
  onPressPrimaryButton,
  primaryIconButtonAccessibilityLabel,
  primaryButtonAccessibilityLabel,
  primaryButtonLabel,
}: PrimaryActionProps) {
  if (!hasPrimaryButton) {
    return null;
  }

  const isPrimaryActionEnabled = typeof onPressPrimaryButton === 'function';

  if (shouldRenderPrimaryAsIcon) {
    return (
      <IconButton
        variant="primary"
        icon={primaryButtonIcon}
        onPress={onPressPrimaryButton}
        disabled={!isPrimaryActionEnabled}
        accessibilityLabel={primaryIconButtonAccessibilityLabel}
      />
    );
  }

  return (
    <View testID="top-app-bar-filter-button-wrapper">
      <Button
        variant="primary"
        iconStart={primaryButtonIcon}
        label={primaryButtonLabel}
        onPress={onPressPrimaryButton}
        disabled={!isPrimaryActionEnabled}
        accessibilityLabel={primaryButtonAccessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  leadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoPressable: {
    borderRadius: Size.radius['full'],
  },
  searchWrapper: {
    flex: 1,
    minWidth: 0,
  },
});
