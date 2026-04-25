import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import T from '../../src/theme';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: T.surface1 }, headerTintColor: T.text, headerTitleStyle: { fontWeight: '700' }, tabBarStyle: { backgroundColor: T.surface1, borderTopColor: T.border, height: 60, paddingBottom: 8 }, tabBarActiveTintColor: T.danger, tabBarInactiveTintColor: T.textMuted, tabBarLabelStyle: { fontSize: 11 } }}>
      <Tabs.Screen name="control" options={{ title: 'Control', tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: ({ color, size }) => <Ionicons name="folder-open" size={size} color={color} /> }} />
      <Tabs.Screen name="qa" options={{ title: 'QA', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} /> }} />
      <Tabs.Screen name="integrations" options={{ href: null, title: 'Integrations' }} />
      <Tabs.Screen name="market" options={{ href: null, title: 'Flow Alerts' }} />
      <Tabs.Screen name="segments" options={{ href: null, title: 'Revenue Brain' }} />
      <Tabs.Screen name="platform" options={{ href: null, title: 'Platform Tier' }} />
      <Tabs.Screen name="metrics" options={{ href: null, title: 'Funnel Metrics' }} />
      <Tabs.Screen name="teams" options={{ href: null, title: 'Team Layer' }} />
      <Tabs.Screen name="intelligence" options={{ href: null, title: 'Intelligence' }} />
      <Tabs.Screen name="teams-intel" options={{ href: null, title: 'Team Intelligence' }} />
      <Tabs.Screen name="autonomy" options={{ href: null, title: 'System Actions' }} />
    </Tabs>
  );
}
