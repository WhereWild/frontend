// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

export default function HomeScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  const contentContainerStyle = getResponsiveContentContainerStyle(responsive);

  return (
    <PageSurface>
      <WebMetadata title='WhereWild' />
      <PageScrollContainer>
        <View style={[styles.container, contentContainerStyle]}>
          <PageTitle title='WhereWild' />
          <View style={styles.body}>
            <ThemedText variant='body'>
              {'Welcome to WhereWild. Get started by searching for a species using the search bar, or you can also use '}
              <ThemedText variant='link' onPress={() => router.push('/search')}>
                {'search filters'}
              </ThemedText>
              {' to sort and filter species by many criteria. Explore GIS data on the '}
              <ThemedText variant='link' onPress={() => router.push('/maps')}>
                {'maps'}
              </ThemedText>
              {' page, adjust your preferences in '}
              <ThemedText variant='link' onPress={() => router.push('/settings')}>
                {'settings'}
              </ThemedText>
              {', or read the '}
              <ThemedText variant='link' onPress={() => router.push('/help')}>
                {'help page'}
              </ThemedText>
              {' to learn more about how everything works.'}
            </ThemedText>
          </View>
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Size.space['400'],
    gap: Size.space['400'],
  },
  body: {
    gap: Size.space['200'],
  },
});
