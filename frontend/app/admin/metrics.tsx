import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import T from '../../src/theme';

type FunnelData = {
  counts: Record<string, number>;
  total_events: number;
  conversion_rate: number;
  since: string;
};

const FUNNEL_ORDER = [
  { key: 'demo_click',        label: 'Demo clicks',         color: T.primary },
  { key: 'wizard_started',    label: 'Wizard started',      color: T.primary },
  { key: 'wizard_completed',  label: 'Wizard completed',    color: T.success },
  { key: 'workspace_opened',  label: 'Workspace opened',    color: T.success },
  { key: 'first_action',      label: 'First CTA click',     color: T.risk },
  { key: 'action_confirmed',  label: 'Action confirmed',    color: T.danger },
  { key: 'tour_completed',    label: 'Tour completed',      color: T.textMuted },
];

export default function AdminMetricsScreen() {
  const router = useRouter();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/metrics/funnel');
      setData(r.data);
    } catch {
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <View style={[s.flex, { justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;
  }

  const counts = data?.counts || {};
  const maxCount = Math.max(...FUNNEL_ORDER.map(f => counts[f.key] || 0), 1);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} testID="metrics-back-btn">
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={load} testID="metrics-refresh-btn">
          <Text style={s.back}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.h1}>Funnel Metrics</Text>
      <Text style={s.sub}>Last 7 days · {data?.total_events || 0} events</Text>

      <View style={s.heroCard} testID="metrics-conversion-card">
        <Text style={s.heroLabel}>First action / Workspace opened</Text>
        <Text style={[s.heroValue, { color: (data?.conversion_rate ?? 0) >= 30 ? T.success : T.risk }]}>
          {(data?.conversion_rate ?? 0).toFixed(1)}%
        </Text>
        <Text style={s.heroHint}>
          {(data?.conversion_rate ?? 0) >= 50 ? '🔥 Ready to scale' :
           (data?.conversion_rate ?? 0) >= 30 ? '✓ Healthy conversion' :
           '⚠ UX problem — users not taking first action'}
        </Text>
      </View>

      <Text style={s.sectionLabel}>Funnel breakdown</Text>
      {FUNNEL_ORDER.map((f) => {
        const count = counts[f.key] || 0;
        const pct = (count / maxCount) * 100;
        return (
          <View key={f.key} style={s.barRow} testID={`metrics-bar-${f.key}`}>
            <View style={s.barLabelRow}>
              <Text style={s.barLabel}>{f.label}</Text>
              <Text style={s.barCount}>{count}</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${pct}%`, backgroundColor: f.color }]} />
            </View>
          </View>
        );
      })}

      <Text style={s.footer}>
        Target: first_action ≥ 30% of workspace_opened. Below that = UX bottleneck.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: { padding: T.lg, paddingTop: T.xl + T.md, paddingBottom: T.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: T.lg },
  back: { color: T.primary, fontSize: T.body, fontWeight: '600' },
  h1: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.xs },
  sub: { color: T.textMuted, fontSize: T.body, marginBottom: T.lg },

  heroCard: { backgroundColor: T.surface1, borderRadius: T.radiusLg, padding: T.lg, marginBottom: T.lg, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  heroLabel: { color: T.textMuted, fontSize: T.small, textTransform: 'uppercase', letterSpacing: 1, marginBottom: T.sm },
  heroValue: { fontSize: 48, fontWeight: '800', marginBottom: T.xs },
  heroHint: { color: T.text, fontSize: T.small },

  sectionLabel: { color: T.textMuted, fontSize: T.small, fontWeight: '600', marginBottom: T.md, textTransform: 'uppercase', letterSpacing: 1 },

  barRow: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderWidth: 1, borderColor: T.border },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: T.xs },
  barLabel: { color: T.text, fontSize: T.body, fontWeight: '600' },
  barCount: { color: T.primary, fontSize: T.body, fontWeight: '800' },
  barTrack: { height: 6, backgroundColor: T.surface2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  footer: { color: T.textMuted, fontSize: T.tiny, textAlign: 'center', marginTop: T.lg, fontStyle: 'italic' },
});
