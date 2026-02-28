import { Stack, usePathname, useRouter } from "expo-router";
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Domine_400Regular,
  Domine_600SemiBold,
  Domine_700Bold,
} from '@expo-google-fonts/domine';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  IconHome,
  IconInfo,
  IconSearch,
  IconSettings,
} from '@/assets/icons';
import {
  NavigationBar,
  type NavigationBarProps,
} from '@/components';
import { Time } from '@/constants/theme';
import { SettingsProvider } from '@/context/SettingsContext';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const navigateIfDifferent = useCallback((targetPath: '/' | '/about' | '/search' | '/settings') => {
    if (pathname !== targetPath) {
      router.replace(targetPath);
    }
  }, [pathname, router]);

  const navigationTabs: NonNullable<NavigationBarProps['tabs']> = useMemo(() => [
    {
      key: 'home',
      label: 'Home',
      icon: IconHome,
      state: pathname === '/' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/'),
      accessibilityLabel: 'Home tab',
    },
    {
      key: 'search',
      label: 'Search',
      icon: IconSearch,
      state: pathname === '/search' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/search'),
      accessibilityLabel: 'Search tab',
    },
    {
      key: 'about',
      label: 'About',
      icon: IconInfo,
      state: pathname === '/about' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/about'),
      accessibilityLabel: 'About tab',
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: IconSettings,
      state: pathname === '/settings' ? 'active' : 'default' as const,
      onPress: () => navigateIfDifferent('/settings'),
      accessibilityLabel: 'Settings tab',
    },
  ], [navigateIfDifferent, pathname]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Domine_400Regular,
    Domine_600SemiBold,
    Domine_700Bold,
    JetBrainsMono_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SettingsProvider>
      <View style={styles.appShell}>
        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: Time.duration.short }} />
        </View>
        <NavigationBar tabs={navigationTabs} />
      </View>
    </SettingsProvider>
  )
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
