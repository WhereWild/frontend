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
import { VARIABLE_TYPES } from '@/constants/variableTypes';
import { useResponsive } from '@/hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';
import { TYPE_GUIDES } from '@/content/guides/variables/types/index';

const NO_GUIDE_YET_CONTENT = 'More coming soon.';

type VariableTypeRouteParams = {
  type?: string;
};

export default function VariableTypeGuideScreen() {
  const params = useLocalSearchParams<VariableTypeRouteParams>();
  const typeKey = typeof params.type === 'string' ? params.type : '';
  const responsive = useResponsive();

  const type = VARIABLE_TYPES.find((entry) => entry.key === typeKey);
  const label = type?.label ?? typeKey;
  const guideContent = TYPE_GUIDES[typeKey] ?? NO_GUIDE_YET_CONTENT;

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title={`WhereWild | ${label} Variable Type`}
          description={`Reference for the ${label} measurement type used across WhereWild environmental variables.`}
          path={`/guides/variables/types/${typeKey}`}
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
          {Platform.OS === 'web' ? <PageTitle title={label} /> : null}

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
              {type ? (
                <Markdown>{guideContent}</Markdown>
              ) : (
                <ThemedText variant='body'>
                  {"We couldn't find that variable type."}
                </ThemedText>
              )}
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
});
