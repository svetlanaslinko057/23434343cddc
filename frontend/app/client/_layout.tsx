import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NotificationPoller from '../../src/notification-poller';
import T from '../../src/theme';

/**
 * Client tabs — canonical 5-tab architecture.
 *
 *   Home · Projects · Activity · Billing · Profile
 *
 * Anything else (control, support, more) stays as a routable file but is
 * hidden from the tab bar with `href: null`. Deep links still work; the bar
 * stays clean. Support lives INSIDE Profile now.
 */
export default function ClientLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NotificationPoller />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: T.surface1,
            borderTopColor: T.border,
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: T.info,
          tabBarInactiveTintColor: T.textMuted,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="projects/index"
          options={{
            title: 'Projects',
            tabBarIcon: ({ color, size }) => <Ionicons name="folder-open" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="projects/[id]" options={{ href: null }} />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ color, size }) => <Ionicons name="flash" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: 'Billing',
            tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
          }}
        />

        {/* Hidden from tab bar — kept as routable screens */}
        <Tabs.Screen name="control" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
