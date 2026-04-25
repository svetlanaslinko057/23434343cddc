import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NotificationPoller from '../../src/notification-poller';
import T from '../../src/theme';

export default function DeveloperLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Event Bridge: реагируем на push-ивенты модульных переходов. */}
      <NotificationPoller />
      <Tabs screenOptions={{ headerStyle: { backgroundColor: T.surface1 }, headerTintColor: T.text, headerTitleStyle: { fontWeight: '700' }, tabBarStyle: { backgroundColor: T.surface1, borderTopColor: T.border, height: 60, paddingBottom: 8 }, tabBarActiveTintColor: T.primary, tabBarInactiveTintColor: T.textMuted, tabBarLabelStyle: { fontSize: 11 } }}>
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
        <Tabs.Screen name="work" options={{ title: 'Work', tabBarIcon: ({ color, size }) => <Ionicons name="code-working" size={size} color={color} /> }} />
        <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} /> }} />
      </Tabs>
    </View>
  );
}
