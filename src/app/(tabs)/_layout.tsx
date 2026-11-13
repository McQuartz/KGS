import { Tabs } from 'expo-router';
import { Icon } from '../../components/ui';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  const tr = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.c.accent,
        tabBarInactiveTintColor: t.c.muted,
        tabBarStyle: { backgroundColor: t.c.surface, borderTopColor: t.c.line },
        tabBarLabelStyle: { fontFamily: t.font.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: t.c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tab.home'), tabBarIcon: ({ color }) => <Icon name="home" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="train" options={{ title: tr('tab.train'), tabBarIcon: ({ color }) => <Icon name="train" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="history" options={{ title: tr('tab.history'), tabBarIcon: ({ color }) => <Icon name="hist" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="settings" options={{ title: tr('tab.settings'), tabBarIcon: ({ color }) => <Icon name="gear" color={String(color)} size={22} /> }} />
    </Tabs>
  );
}
