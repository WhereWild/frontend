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
import {
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { WebMetadata } from '@/utils/webMetadata';
import HELP_CONTENT from '@/content/help.md';

// Markdown `![alt](key)` images resolve through this map (see Markdown's
// `images` prop doc comment) — Metro needs a static require() per asset, so
// this can't be built dynamically from the filenames referenced in
// help.md.
const HELP_IMAGES: Record<string, ImageSourcePropType> = {
  help_species_overview: require('@/assets/images/help_species_overview.png'),
  help_density_temperature: require('@/assets/images/help_density_temperature.png'),
  help_variable_category_tabs: require('@/assets/images/help_variable_category_tabs.png'),
  help_density_soil_clay: require('@/assets/images/help_density_soil_clay.png'),
  help_relative_rankings_expanded: require('@/assets/images/help_relative_rankings_expanded.png'),
  help_landcover_nominal_bar: require('@/assets/images/help_landcover_nominal_bar.png'),
  help_aspect_polar_chart: require('@/assets/images/help_aspect_polar_chart.png'),
  help_occurrence_map_elevation: require('@/assets/images/help_occurrence_map_elevation.png'),
  help_observation_popup: require('@/assets/images/help_observation_popup.png'),
  help_point_query_popup: require('@/assets/images/help_point_query_popup.png'),
  help_density_selected_point: require('@/assets/images/help_density_selected_point.png'),
  help_out_of_range_precipitation: require('@/assets/images/help_out_of_range_precipitation.png'),
  help_filters_panel: require('@/assets/images/help_filters_panel.png'),
  help_location_filter_canada: require('@/assets/images/help_location_filter_canada.png'),
  help_recent_weather_1hr: require('@/assets/images/help_recent_weather_1hr.png'),
  help_winter_observation_popup: require('@/assets/images/help_winter_observation_popup.png'),
  help_recent_weather_3month: require('@/assets/images/help_recent_weather_3month.png'),
  help_out_of_range_temperature: require('@/assets/images/help_out_of_range_temperature.png'),
  help_slice_single_range: require('@/assets/images/help_slice_single_range.png'),
  help_slice_multiple_ranges: require('@/assets/images/help_slice_multiple_ranges.png'),
  help_slice_chaining_precipitation: require('@/assets/images/help_slice_chaining_precipitation.png'),
  help_slice_chaining_landcover: require('@/assets/images/help_slice_chaining_landcover.png'),
  help_colormap_picker: require('@/assets/images/help_colormap_picker.png'),
  help_nominal_color_options: require('@/assets/images/help_nominal_color_options.png'),
  help_circular_color_options: require('@/assets/images/help_circular_color_options.png'),
  help_upload_page_processed: require('@/assets/images/help_upload_page_processed.png'),
  help_species_page_download_button: require('@/assets/images/help_species_page_download_button.png'),
  help_advanced_search_panel: require('@/assets/images/help_advanced_search_panel.png'),
  help_advanced_search_cacti_temperature: require('@/assets/images/help_advanced_search_cacti_temperature.png'),
  help_advanced_search_snow_duration: require('@/assets/images/help_advanced_search_snow_duration.png'),
  help_opuntia_basilaris_sierra_outliers: require('@/assets/images/help_opuntia_basilaris_sierra_outliers.png'),
  help_maps_autoadapt_before: require('@/assets/images/help_maps_autoadapt_before.png'),
  help_maps_autoadapt_after: require('@/assets/images/help_maps_autoadapt_after.png'),
  help_maps_elevation_slice: require('@/assets/images/help_maps_elevation_slice.png'),
  help_maps_landcover_class_filter: require('@/assets/images/help_maps_landcover_class_filter.png'),
  help_maps_weather_code_globe: require('@/assets/images/help_maps_weather_code_globe.png'),
};

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
                <Markdown images={HELP_IMAGES}>{HELP_CONTENT}</Markdown>
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
