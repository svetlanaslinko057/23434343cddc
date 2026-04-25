import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth';
import { FeedbackProvider } from '../src/feedback';
import { StateShiftProvider } from '../src/state-shift';
import AppHeader from '../src/app-header';
import BottomTabs from '../src/bottom-tabs';
import T from '../src/theme';

/**
 * L0 App Shell — every screen renders inside this frame.
 *
 * Structure (top → bottom):
 *   [AppHeader]        — always (brand + title + identity). Works for guests.
 *   [<Slot />]         — the current route content.
 *   [BottomTabs]       — authed only, visible on L0 + workspace routes.
 *
 * GlobalControlBar is intentionally unmounted: its source endpoint
 * (/api/global/status) is 404, so it rendered null and only spammed the
 * network tab. Re-mount once the endpoint exists.
 */
function AppContent() {
  const { user, loading } = useAuth();
  const authed = !!user && !loading;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader />
      <View style={styles.body}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg }, animation: 'fade' }} />
      </View>
      {authed && <BottomTabs />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FeedbackProvider>
          <StateShiftProvider>
            <AppContent />
          </StateShiftProvider>
        </FeedbackProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1 },
});
