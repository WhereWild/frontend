// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IconGithub } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { BACKEND_BASE, fetchJsonOrThrow } from '@/data/apiShared';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Constants from 'expo-constants';
import type { Href } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { IconButton } from '../../buttons/IconButton';
import { RoutePressable } from '../../navigation/RoutePressable';
import { ThemedText } from '../../text/ThemedText';

const WHEREWILD_GITHUB_URL = 'https://github.com/WhereWild';

const frontendBuildDateRaw = Constants.expoConfig?.extra?.buildDate as
  | string
  | undefined;
const frontendBuildDate = frontendBuildDateRaw
  ? new Date(frontendBuildDateRaw)
  : new Date();
const copyrightYear = frontendBuildDate.getFullYear();

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

type VersionResponse = {
  version?: string | null;
  api_build_date?: string | null;
};

const INTERNAL_LINKS: { label: string; route: Href }[] = [
  { label: 'Home', route: '/' },
  { label: 'Search', route: '/search' },
  { label: 'Maps', route: '/maps' },
  { label: 'Upload', route: '/upload' },
  { label: 'Help', route: '/help' },
  { label: 'Guides', route: '/guides' },
  { label: 'About', route: '/about' },
  { label: 'Settings', route: '/settings' },
  { label: 'Status', route: '/status' },
  { label: 'Acknowledgements', route: '/acknowledgements' },
];

export function WebPageFooter() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const isCompact = responsive.breakpoint !== 'desktop';
  const [gbifCrawlDate, setGbifCrawlDate] = React.useState<string | null>(null);
  const [apiBuildDate, setApiBuildDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    fetchJsonOrThrow(`${BACKEND_BASE}/version`, 'Failed to load API version')
      .then((data) => {
        if (cancelled) return;
        const { version, api_build_date } = data as VersionResponse;
        setGbifCrawlDate(version ?? null);
        setApiBuildDate(api_build_date ?? null);
      })
      .catch(() => {
        // Footer metadata is non-critical; silently omit the lines on failure.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tinyTextStyle = [
    { color: palette.text.default.tertiary },
    isCompact && styles.centeredText,
  ];

  return (
    <View
      style={[
        styles.container,
        isCompact ? styles.containerCompact : styles.containerWide,
        { borderTopColor: palette.border.default.secondary },
      ]}
    >
      <IconButton
        variant='subtle'
        size='small'
        icon={<IconGithub />}
        accessibilityLabel='WhereWild on GitHub'
        onPress={() => Linking.openURL(WHEREWILD_GITHUB_URL)}
      />
      <View style={[styles.column, isCompact && styles.columnCompact]}>
        <ThemedText variant='bodyTiny' style={tinyTextStyle}>
          {`© ${copyrightYear} The WhereWild Contributors`}
        </ThemedText>
        <ThemedText variant='bodyTiny' style={tinyTextStyle}>
          {`Website last build ${formatDate(frontendBuildDate)}`}
        </ThemedText>
        {apiBuildDate ? (
          <ThemedText variant='bodyTiny' style={tinyTextStyle}>
            {`API last build ${formatDate(new Date(apiBuildDate))}`}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.column, isCompact && styles.columnCompact]}>
        {/* Nested Text wraps like ordinary sentence text, so links and "|"
            separators flow and break naturally -- no manual layout
            measurement needed, and copy/paste extracts clean plain text
            (unlike a View-based layout, where each block-level View forces
            a newline into copied text regardless of visual flex layout).
            The separator's leading spaces are regular (breakable) but its
            trailing space is non-breaking, so a line can only wrap before a
            "|", never between it and the label it precedes -- otherwise a
            "|" can strand itself alone at the end of a line. RoutePressable
            renders a real <a href> inline here, so ctrl/cmd/middle-click
            "open in new tab" works, unlike a plain onPress handler. */}
        <ThemedText
          variant='bodySmall'
          style={[styles.internalLinks, isCompact && styles.centeredText]}
        >
          {INTERNAL_LINKS.map(({ label, route }, index) => (
            <React.Fragment key={label}>
              {index > 0 ? (
                <ThemedText variant='bodyTiny' style={tinyTextStyle}>
                  {'  | '}
                </ThemedText>
              ) : null}
              <RoutePressable href={route} accessibilityRole='link'>
                <ThemedText variant='bodySmallLink'>{label}</ThemedText>
              </RoutePressable>
            </React.Fragment>
          ))}
        </ThemedText>
        {gbifCrawlDate ? (
          <ThemedText variant='bodyTiny' style={tinyTextStyle}>
            {`iNaturalist occurrence data (via GBIF) last crawled ${formatDate(new Date(gbifCrawlDate))}`}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingHorizontal: Size.space['800'],
    paddingVertical: Size.space['300'],
  },
  containerWide: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: Size.space['800'],
    rowGap: Size.space['200'],
  },
  containerCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: Size.space['300'],
  },
  column: {
    alignItems: 'flex-start',
    gap: Size.space['100'],
  },
  columnCompact: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  internalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: 340,
    rowGap: Size.space['100'],
  },
  internalLinksCentered: {
    justifyContent: 'center',
  },
  internalLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
});
