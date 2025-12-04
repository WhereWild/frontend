import { Stack } from "expo-router";
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
} from '@expo-google-fonts/inter';
import {
  Domine_400Regular,
  Domine_600SemiBold,
  Domine_700Bold,
} from '@expo-google-fonts/domine';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_400Regular_Italic,
} from '@expo-google-fonts/jetbrains-mono';

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

  // TODO: Consider rendering the shared header here (outside the Stack) so iOS
  // navigation transitions don't visually sweep it away between screens.
  return <Stack screenOptions={{ headerShown: false }} />;
}
