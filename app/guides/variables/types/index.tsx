// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';
import { VARIABLE_TYPES } from '@/constants/variableTypes';

export default function VariableTypesIndexScreen() {
  const responsive = useResponsive();

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Variable Types'
          description='Reference for the measurement types (nominal, ordinal, interval, ratio, circular) used across WhereWild environmental variables.'
          path='/guides/variables/types'
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
          {Platform.OS === 'web' ? <PageTitle title='Variable Types' /> : null}

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
              <View style={styles.linkList}>
                {VARIABLE_TYPES.map((type) => (
                  <RoutePressable
                    key={type.key}
                    href={`/guides/variables/types/${type.key}`}
                    accessibilityRole='link'
                  >
                    <ThemedText variant='link'>{type.label}</ThemedText>
                  </RoutePressable>
                ))}
                {/* Not a value_type (see /guides/compositional) — listed
                    here too since a variable can be compositional on top of
                    being one of the types above, and this is the natural
                    place to look for it. */}
                <RoutePressable
                  href='/guides/compositional'
                  accessibilityRole='link'
                >
                  <ThemedText variant='link'>{'Compositional'}</ThemedText>
                </RoutePressable>
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
  linkList: {
    gap: Size.space.text.line,
  },
});
