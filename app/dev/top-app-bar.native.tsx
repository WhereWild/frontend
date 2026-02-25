import {
  Button,
  SwitchField,
  ThemedText,
  TopAppBar,
  TopAppBarVariant,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

const VARIANTS: TopAppBarVariant[] = ['home', 'page', 'search'];

const noop = () => { };

export default function TopAppBarDevScreen() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [variant, setVariant] = React.useState<TopAppBarVariant>('home');
  const [pageTitle, setPageTitle] = React.useState('Page Title');
  const [searchValue, setSearchValue] = React.useState('');
  const [hasSecondaryButton, setHasSecondaryButton] = React.useState(true);
  const [hasPrimaryButton, setHasPrimaryButton] = React.useState(true);
  const [isPrimaryButtonIcon, setIsPrimaryButtonIcon] = React.useState(false);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}> 
      {variant === 'search' ? (
        <TopAppBar
          variant="search"
          title={pageTitle}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSubmitSearch={setSearchValue}
          hasSecondaryButton={hasSecondaryButton}
          hasPrimaryButton={hasPrimaryButton}
          isPrimaryButtonIcon={isPrimaryButtonIcon}
          onPressPrimaryButton={noop}
          onPressSecondaryButton={noop}
        />
      ) : variant === 'page' ? (
        <TopAppBar
          variant="page"
          title={pageTitle}
          onPressBack={noop}
          hasSecondaryButton={hasSecondaryButton}
          hasPrimaryButton={hasPrimaryButton}
          isPrimaryButtonIcon={isPrimaryButtonIcon}
          onPressPrimaryButton={noop}
          onPressSecondaryButton={noop}
        />
      ) : (
        <TopAppBar
          variant="home"
          title={pageTitle}
          hasSecondaryButton={hasSecondaryButton}
          hasPrimaryButton={hasPrimaryButton}
          isPrimaryButtonIcon={isPrimaryButtonIcon}
          onPressPrimaryButton={noop}
          onPressSecondaryButton={noop}
        />
      )}

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <ThemedText variant="heading">Top App Bar Preview</ThemedText>
        <ThemedText variant="body">
          Rotate device and resize width to verify primary button collapse/expand behavior.
        </ThemedText>

        <View style={styles.variantRow}>
          {VARIANTS.map((value) => (
            <Button
              key={value}
              variant={variant === value ? 'primary' : 'subtle'}
              label={value}
              onPress={() => setVariant(value)}
              accessibilityLabel={`Select ${value} variant`}
            />
          ))}
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
          value={isPrimaryButtonIcon}
          onValueChange={setIsPrimaryButtonIcon}
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
    paddingHorizontal: Size.space['400'],
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
