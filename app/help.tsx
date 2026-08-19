// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Markdown,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { WebMetadata } from '@/utils/webMetadata';
import HELP_CONTENT from '@/content/help.md';

const TUTORIAL_VIDEO_ID = 'IDPiObga3C8';
const TUTORIAL_EMBED_URL = `https://www.youtube.com/embed/${TUTORIAL_VIDEO_ID}`;

// Same split as SpeciesOccurrenceMap.tsx's map iframe/WebView: a raw
// <iframe> on web (react-native-webview's own web support isn't used
// elsewhere in this codebase, so stay consistent) and react-native-webview
// on native.
function HelpVideoEmbed() {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      src: TUTORIAL_EMBED_URL,
      style: { width: '100%', height: '100%', border: '0' },
      title: 'WhereWild Guide & Tutorial',
      'data-testid': 'help-video-embed',
      frameBorder: '0',
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      referrerPolicy: 'strict-origin-when-cross-origin',
      allowFullScreen: true,
    });
  }

  return (
    <WebView
      testID='help-video-embed'
      style={styles.videoWebView}
      source={{ uri: TUTORIAL_EMBED_URL }}
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction
    />
  );
}

export default function HelpScreen() {
  const responsive = useResponsive();
  // Lands on a specific section once it's rendered, e.g. /help#uploading-your-own-data.
  useScrollToHash([]);
  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Help'
          description='Learn how to search species, interpret maps, and use WhereWild effectively.'
          path='/help'
        />
      ) : null}
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? <PageTitle title='Help' /> : null}
          <View
            style={[
              styles.contentShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View style={[styles.content, { maxWidth: responsive.textWidth }]}>
              <ThemedText variant='heading'>{'Video Tutorial'}</ThemedText>
              <View style={styles.videoFrame}>
                <HelpVideoEmbed />
              </View>
              <View style={styles.section}>
                <Markdown>{HELP_CONTENT}</Markdown>
              </View>
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
  section: {
    gap: Size.space.text.subsection,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  videoWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
