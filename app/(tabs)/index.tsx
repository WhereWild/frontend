import { Image } from 'expo-image';
import { Platform, StyleSheet, Text } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

import { useTypographyStyles } from '@/hooks/use-typography-styles';

const componentStyles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepContainer: { gap: 8, marginBottom: 8 },
  reactLogo: { height: 178, width: 290, bottom: 0, left: 0, position: 'absolute' },
});

export default function HomeScreen() {
  const typographyStyles = useTypographyStyles();

  const styles = { ...componentStyles, ...typographyStyles };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <Text style={styles.titleHero}>Welcome!</Text>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Text style={styles.subtitle}>Step 1: Try it</Text>
        <Text style={styles.body}>
          Edit <Text style={styles.bodyStrong}>app/(tabs)/index.tsx</Text> to see changes.
          Press{' '}
          <Text style={styles.bodyStrong}>
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </Text>{' '}
          to open developer tools.
        </Text>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <Text style={styles.subtitle}>Step 2: Explore</Text>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <Text style={styles.body}>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </Text>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Text style={styles.subtitle}>Step 3: Get a fresh start</Text>
        <Text style={styles.body}>
          {`When you're ready, run `}
          <Text style={styles.code}>npm run reset-project</Text> to get a fresh{' '}
          <Text style={styles.bodyStrong}>app</Text> directory. This will move the current{' '}
          <Text style={styles.bodyStrong}>app</Text> to{' '}
          <Text style={styles.bodyStrong}>app-example</Text>.
        </Text>
      </ThemedView>
    </ParallaxScrollView>
  );
}