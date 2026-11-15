import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDb } from '../db/db';
import { kvGet, kvSet, listMeasurements, listWorkouts } from '../db/repo';
import { generateDemoData } from '../lib/demo';
import { useSettings } from '../store/settings';
import { useTheme } from '../theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium,
  });
  const loaded = useSettings((s) => s.loaded);
  useEffect(() => {
    initDb().then(() => {
      useSettings.getState().load();
      // First run (or nearly empty DB): fill in demo data so every screen has something to show.
      // Demo rows are tagged and can be removed in Settings → Data.
      if (!kvGet('demo.autoseeded')) {
        if (listWorkouts().length < 3 && listMeasurements('weight').length < 7) {
          generateDemoData();
          useSettings.getState().set({ demoData: true });
        }
        kvSet('demo.autoseeded', '1');
      }
    });
  }, []);
  const t = useTheme();
  if (!fontsLoaded || !loaded) return <View style={{ flex: 1, backgroundColor: t.c.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log" options={{ presentation: 'modal' }} />
          <Stack.Screen name="workout/active" options={{ gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
