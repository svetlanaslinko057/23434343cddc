// Client → Activity tab
//
// One live stream of what the system / developers / client did, in order.
// Thin projection of /api/activity/live (polled every 10s). The dot & verb
// come from backend — the UI only groups by time bucket.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import T from '../../src/theme';

type Event = {
  at: string;
  module_title: string;
  project_title: string;
  project_id: string;
  verb: 'completed' | 'moved to review' | 'started';
  dot: 'green' | 'yellow' | 'blue';
};

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function bucketFor(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'JUST NOW';
  if (m < 60) return 'TODAY';
  const h = Math.floor(m / 60);
  if (h < 24) return 'TODAY';
  if (h < 48) return 'YESTERDAY';
  return 'EARLIER';
}

const DOT_COLOR: Record<Event['dot'], string> = {
  green:  '#22c55e',
  yellow: '#f59e0b',
  blue:   '#60a5fa',
};

export default function ClientActivity() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/activity/live');
      const list: Event[] = Array.isArray(r.data?.events) ? r.data.events
                          : Array.isArray(r.data) ? r.data
                          : [];
      setEvents(list);
    } catch {
      /* silent — interceptor handles auth */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 10_000);
    return () => clearInterval(i);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[s.flex, s.center]} edges={['top']}>
        <ActivityIndicator color={T.primary} />
      </SafeAreaView>
    );
  }

  // Group events by time bucket, preserving order.
  const groups: { bucket: string; items: Event[] }[] = [];
  for (const e of events) {
    const b = bucketFor(e.at);
    const last = groups[groups.length - 1];
    if (last && last.bucket === b) last.items.push(e);
    else groups.push({ bucket: b, items: [e] });
  }

  return (
    <SafeAreaView style={s.flex} edges={['top']}>
      <ScrollView
        testID="client-activity"
        style={s.flex}
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={T.primary}
          />
        }
      >
        <Text style={s.title}>Activity</Text>
        <Text style={s.subtitle}>Live stream · what the system and your team did</Text>

        {events.length === 0 && (
          <View style={s.empty} testID="activity-empty">
            <Text style={s.emptyIcon}>⚡</Text>
            <Text style={s.emptyTitle}>Nothing happening yet</Text>
            <Text style={s.emptySub}>
              Once your project starts moving, every action from the system and
              your developers will appear here in real time.
            </Text>
          </View>
        )}

        {groups.map((g) => (
          <View key={g.bucket} style={s.group}>
            <Text style={s.bucket}>{g.bucket}</Text>
            {g.items.map((e, idx) => (
              <View
                key={`${e.project_id}-${e.at}-${idx}`}
                style={s.row}
                testID={`activity-row-${idx}`}
                onTouchEnd={() => router.push(`/client/projects/${e.project_id}` as any)}
              >
                <View style={[s.dot, { backgroundColor: DOT_COLOR[e.dot] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.line} numberOfLines={2}>
                    <Text style={s.module}>{e.module_title}</Text>
                    <Text style={s.verb}> {e.verb}</Text>
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {e.project_title} · {relativeTime(e.at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: T.lg, paddingBottom: 100 },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.small, marginTop: 4, marginBottom: T.lg },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  emptySub: { color: T.textMuted, fontSize: T.small, marginTop: 8, textAlign: 'center', maxWidth: 280 },
  group: { marginBottom: T.lg },
  bucket: { color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: T.md,
    marginBottom: 8,
    gap: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  line: { color: T.text, fontSize: T.body },
  module: { fontWeight: '700' },
  verb: { color: T.textMuted },
  meta: { color: T.textMuted, fontSize: T.tiny, marginTop: 3 },
});
