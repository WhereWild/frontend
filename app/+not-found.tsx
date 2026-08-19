// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageSurface, ThemedText } from '@/components';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

export default function NotFoundScreen() {
  const router = useRouter();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Page Not Found'
          description="The page you're looking for doesn't exist."
        />
      ) : null}
      <PageSurface testID='not-found-screen' style={styles.screen}>
        <View
          style={styles.content}
          accessibilityLiveRegion='polite'
          accessible
          accessibilityLabel='Page not found'
        >
          <ThemedText variant='subheading'>Page not found</ThemedText>
          <ThemedText
            variant='body'
            style={{ color: palette.text.default.tertiary }}
          >
            {"We couldn't find the page you were looking for."}
          </ThemedText>
          <ThemedText variant='link' onPress={() => router.replace('/')}>
            Go back home
          </ThemedText>
        </View>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
});
