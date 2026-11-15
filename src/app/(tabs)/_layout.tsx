import { TopTabs, type MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, InTabsContext } from '../../components/ui';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

const ICONS: Record<string, string> = { index: 'home', train: 'train', history: 'hist', settings: 'gear' };
const LABELS: Record<string, string> = { index: 'tab.home', train: 'tab.train', history: 'tab.history', settings: 'tab.settings' };

/** Bottom bar for the swipeable tab pager. Sits above the Android navigation bar (safe area). */
function BottomBar({ state, navigateToTab, insets }: MaterialTopTabBarProps) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line, paddingBottom: insets.bottom }}>
      {state.routes.map((r, i) => {
        const on = state.index === i;
        const color = on ? t.c.accent : t.c.muted;
        return (
          <Pressable key={r.key} onPress={() => navigateToTab(r.key)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 3 }} android_ripple={{ color: t.c.surface2, borderless: true }}>
            <Icon name={ICONS[r.name] ?? 'info'} color={color} size={22} />
            <Text style={{ fontFamily: on ? t.font.semibold : t.font.medium, fontSize: 11, color }}>{tr(LABELS[r.name] ?? r.name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <InTabsContext.Provider value={true}>
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: MaterialTopTabBarProps) => <BottomBar {...props} />}
      screenOptions={{ swipeEnabled: true, lazy: true, lazyPreloadDistance: 1, sceneStyle: { backgroundColor: t.c.bg } }}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="train" />
      <TopTabs.Screen name="history" />
      <TopTabs.Screen name="settings" />
    </TopTabs>
    </InTabsContext.Provider>
  );
}
