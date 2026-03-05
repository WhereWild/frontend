import {
  NavigationPillList,
  SwitchField,
  ThemedText,
  TopAppBar,
  TopAppBarVariant,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

const HOME_LOGO_SOURCE = require('@/assets/images/wherewild.png');
const HOME_LOGO_ACCESSIBILITY_LABEL = 'WhereWild logo';

const VARIANTS: TopAppBarVariant[] = ['home', 'page', 'search'];
const VARIANT_PILLS = VARIANTS.map((value) => ({
  key: value,
  label: value,
  accessibilityLabel: `Select ${value} variant`,
}));

const noop = () => { };

export default function TopAppBarDevScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const responsive = useResponsive();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [variant, setVariant] = React.useState<TopAppBarVariant>('home');
  const [pageTitle, setPageTitle] = React.useState('Page Title');
  const [searchValue, setSearchValue] = React.useState('');
  const [hasSecondaryButton, setHasSecondaryButton] = React.useState(true);
  const [hasPrimaryButton, setHasPrimaryButton] = React.useState(true);
  const [primaryActionMode, setPrimaryActionMode] = React.useState<'responsive' | 'icon'>('responsive');

  const secondaryAction = {
    isVisible: hasSecondaryButton,
    onPress: noop,
  };

  const primaryAction = {
    isVisible: hasPrimaryButton,
    mode: primaryActionMode,
    onPress: noop,
  };

  const handleVariantChange = React.useCallback((key: string) => {
    if ((VARIANTS as readonly string[]).includes(key)) {
      setVariant(key as TopAppBarVariant);
    }
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}> 
      {variant === 'search' ? (
        <TopAppBar
          variant="search"
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSubmitSearch={setSearchValue}
          secondaryAction={secondaryAction}
          primaryAction={primaryAction}
        />
      ) : variant === 'page' ? (
        <TopAppBar
          variant="page"
          title={pageTitle}
          onPressBack={() => router.back()}
          secondaryAction={secondaryAction}
          primaryAction={primaryAction}
        />
      ) : (
        <TopAppBar
          variant="home"
          title={pageTitle}
          logoSource={HOME_LOGO_SOURCE}
          logoAccessibilityLabel={HOME_LOGO_ACCESSIBILITY_LABEL}
          onPressLogo={() => router.push('/')}
          secondaryAction={secondaryAction}
          primaryAction={primaryAction}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: responsive.marginHorizontal },
        ]}
        bounces={false}
      >
        <ThemedText variant="heading">Top App Bar Preview</ThemedText>
        <ThemedText variant="body">
          Rotate device and resize width to verify primary button collapse/expand behavior.
        </ThemedText>

        <View style={styles.variantRow}>
          <NavigationPillList
            pills={VARIANT_PILLS}
            selectedKey={variant}
            onSelectionChange={handleVariantChange}
            direction="horizontal"
            accessibilityLabel="Top app bar variant selection"
            testID="top-app-bar-variant-selector"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText variant="bodySmallStrong">Page title</ThemedText>
          <TextInput
            value={pageTitle}
            onChangeText={setPageTitle}
            placeholder="Page Title"
            placeholderTextColor={palette.text.disabled.default}
            style={[
              styles.titleInput,
              {
                backgroundColor: palette.background.default.secondary,
                borderColor: palette.border.default.default,
                color: palette.text.default.default,
              },
            ]}
            accessibilityLabel="Page title input"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {variant === 'search' ? (
          <View style={styles.searchValuePreview}>
            <ThemedText variant="bodySmall">Search value: {searchValue || '∅'}</ThemedText>
          </View>
        ) : null}

        <SwitchField
          label="Show secondary button"
          value={hasSecondaryButton}
          onValueChange={setHasSecondaryButton}
        />
        <SwitchField
          label="Show primary button"
          value={hasPrimaryButton}
          onValueChange={setHasPrimaryButton}
        />
        <SwitchField
          label="Force primary icon mode"
          value={primaryActionMode === 'icon'}
          onValueChange={(enabled) => setPrimaryActionMode(enabled ? 'icon' : 'responsive')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingVertical: Size.space['400'],
    gap: Size.space['300'],
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
  searchValuePreview: {
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['200'],
  },
  inputGroup: {
    gap: Size.space['100'],
  },
  titleInput: {
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['200'],
  },
});
