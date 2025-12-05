import { PageHeaderPortal, PageHeaderPortalProvider } from '@/components/sections/PageHeaderPortal';
import {
  Domine_400Regular,
  Domine_600SemiBold,
  Domine_700Bold,
} from '@expo-google-fonts/domine';
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_400Regular_Italic,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Domine_400Regular,
    Domine_600SemiBold,
    Domine_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_400Regular_Italic,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PageHeaderPortalProvider>
      <View style={styles.container}>
        <View style={styles.headerWrapper}>
          <PageHeaderPortal />
        </View>
        <View style={styles.contentWrapper}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </PageHeaderPortalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  headerWrapper: {
    zIndex: 1,
    width: '100%',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
});
