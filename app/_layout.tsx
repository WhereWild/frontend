import { Stack, usePathname } from "expo-router";
import { View } from 'react-native';
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
import { SettingsProvider } from '@/context/SettingsContext';
import { WebPageHeader } from '@/components';
import {
  resolveHeaderConfigForRoute,
  WebPageHeaderProvider,
  useWebPageHeaderConfig,
} from '@/context/WebPageHeaderContext';

function RootLayoutFrame() {
  const pathname = usePathname();
  const { config } = useWebPageHeaderConfig();
  const resolvedConfig = resolveHeaderConfigForRoute(pathname, config);

  return (
    <View style={{ flex: 1 }}>
      <WebPageHeader
        showFilterButton={resolvedConfig.showFilterButton}
        onFilterPress={resolvedConfig.onFilterPress}
        filterLabel={resolvedConfig.filterLabel}
        showResetFilterButton={resolvedConfig.showResetFilterButton}
        onResetFilterPress={resolvedConfig.onResetFilterPress}
        showSearchResultsDropdown={resolvedConfig.showSearchResultsDropdown}
        initialQuery={resolvedConfig.initialQuery}
        filterParams={resolvedConfig.filterParams}
        onSearchingChanged={resolvedConfig.onSearchingChanged}
        onSearchResultsChanged={resolvedConfig.onSearchResultsChanged}
      />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
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
      <WebPageHeaderProvider>
        <RootLayoutFrame />
      </WebPageHeaderProvider>
    </SettingsProvider>
  );
}
