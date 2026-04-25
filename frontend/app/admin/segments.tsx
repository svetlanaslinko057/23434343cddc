import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';

// Wave 10 — Admin Client Revenue Brain / Segments
// Groups clients into revenue segments with quick actions.

const SEG_ORDER = ['expansion_ready', 'premium_ready', 'stable_core', 'slow_payer', 'churn_risk'];
const SEG_META: Record<string, { label: string; color: string; icon: string; note: string }> = {
  expansion_ready: { label: 'Expansion Ready', color: T.success, icon: 'trending-up', note: 'Fast payers, high trust — push upsells' },
  premium_ready: { label: 'Premium Ready', color: T.primary, icon: 'diamond', note: 'High spend, fast decisions — premium tier' },
  stable_core: { label: 'Stable', color: T.info, icon: 'shield-checkmark', note: 'Healthy, no urgent action' },
  slow_payer: { label: 'Slow Payers', color: T.risk, icon: 'time', note: 'Reduce pressure — wait before upsell' },
  churn_risk: { label: 'Churn Risk', color: T.danger, icon: 'warning', note: 'Focus on retention, not growth' },
};

export default function AdminSegments() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/segments');
      setData(r.data);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const regenerate = async (clientId: string, clientName: string) => {
    setActing(clientId);
    try {
      // find any project of this client, then call generate
      const projects = await api.get(`/admin/client-revenue-brain`);
      // fallback: ask server for specific project would need another endpoint; instead re-list segments (backend auto-generates on /client/opportunities call)
      Alert.alert('Tip', `${clientName}: opportunities auto-generate when client opens their dashboard. For manual push, open any of their projects and use /admin/opportunities/generate/{project_id}.`);
    } catch {} finally { setActing(null); load(); }
  };

  if (loading) return <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;
  if (!data) return null;

  const buckets = data.segments || {};
  const totals = data.totals || {};

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: T.md, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      testID="admin-segments-screen">
      <Text style={s.title}>Client Revenue Brain</Text>
      <Text style={s.subtitle}>System detects revenue opportunity. You decide.</Text>

      {/* Totals bar */}
      <View style={s.totalsRow}>
        {SEG_ORDER.map(k => {
          const m = SEG_META[k];
          return (
            <View key={k} style={[s.totalCard, { borderColor: m.color + '55' }]}>
              <Ionicons name={m.icon as any} size={14} color={m.color} />
              <Text style={[s.totalNum, { color: m.color }]}>{totals[k] || 0}</Text>
              <Text style={s.totalLbl}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      {SEG_ORDER.map(k => {
        const m = SEG_META[k];
        const list = buckets[k] || [];
        return (
          <View key={k} style={s.section} testID={`segment-${k}`}>
            <View style={s.sectionHead}>
              <Ionicons name={m.icon as any} size={16} color={m.color} />
              <Text style={[s.sectionTitle, { color: m.color }]}>{m.label}</Text>
              <View style={[s.badge, { backgroundColor: m.color + '22', borderColor: m.color + '55' }]}>
                <Text style={[s.badgeText, { color: m.color }]}>{list.length}</Text>
              </View>
            </View>
            <Text style={s.sectionNote}>{m.note}</Text>

            {list.length === 0
              ? <Text style={s.empty}>No clients in this bucket</Text>
              : list.map((c: any) => (
                <View key={c.client_id} style={[s.card, { borderLeftColor: m.color }]} testID={`seg-card-${c.client_id}`}>
                  <View style={s.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName}>{c.name}</Text>
                      <Text style={s.cardMeta}>
                        Spend ${c.total_spend.toLocaleString()}
                        {c.open_opportunities_value > 0 && (
                          <Text style={{ color: T.primary, fontWeight: '700' }}> · +${c.open_opportunities_value} open</Text>
                        )}
                      </Text>
                    </View>
                    <View style={s.scoreWrap}>
                      <Text style={[s.scoreVal, { color: k === 'churn_risk' ? T.danger : m.color }]}>
                        {k === 'churn_risk' ? c.retention_risk_score : c.expansion_readiness_score}
                      </Text>
                      <Text style={s.scoreLbl}>{k === 'churn_risk' ? 'risk' : 'exp'}</Text>
                    </View>
                  </View>

                  <View style={s.metricRow}>
                    <Metric lbl="Velocity" val={c.payment_velocity_score} />
                    {k !== 'churn_risk' && <Metric lbl="Expansion" val={c.expansion_readiness_score} />}
                    <Metric lbl="Risk" val={c.retention_risk_score} danger />
                  </View>

                  <View style={s.actRow}>
                    <TouchableOpacity
                      testID={`seg-opps-${c.client_id}`}
                      style={[s.actBtn, { backgroundColor: m.color }]}
                      onPress={() => regenerate(c.client_id, c.name)}
                      disabled={acting === c.client_id}>
                      {acting === c.client_id
                        ? <ActivityIndicator color={T.bg} size="small" />
                        : <>
                            <Ionicons name="flash" size={12} color={T.bg} />
                            <Text style={s.actText}>{k === 'churn_risk' ? 'Trigger check-in' : 'Generate offers'}</Text>
                          </>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Metric({ lbl, val, danger }: { lbl: string; val: number; danger?: boolean }) {
  const color = danger ? (val >= 60 ? T.danger : val >= 40 ? T.risk : T.textMuted) : (val >= 70 ? T.success : val >= 50 ? T.info : T.risk);
  return (
    <View style={s.metricCell}>
      <Text style={s.metricLbl}>{lbl}</Text>
      <Text style={[s.metricVal, { color }]}>{val}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.small, marginTop: 2, marginBottom: T.md, fontStyle: 'italic' },
  totalsRow: { flexDirection: 'row', gap: 6, marginBottom: T.md, flexWrap: 'wrap' },
  totalCard: { flex: 1, minWidth: 88, alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: 8, borderWidth: 1, gap: 2 },
  totalNum: { fontSize: T.h3, fontWeight: '800' },
  totalLbl: { color: T.textMuted, fontSize: 9, textAlign: 'center' },

  section: { marginBottom: T.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: T.sm, marginBottom: 4 },
  sectionTitle: { fontSize: T.h3, fontWeight: '700', flex: 1 },
  sectionNote: { color: T.textMuted, fontSize: T.small, fontStyle: 'italic', marginBottom: T.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontWeight: '700', fontSize: T.tiny },
  empty: { color: T.textMuted, fontSize: T.small, fontStyle: 'italic', padding: 10, backgroundColor: T.surface1 + '88', borderRadius: T.radiusSm, borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', textAlign: 'center' },

  card: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: T.sm },
  cardName: { color: T.text, fontSize: T.body, fontWeight: '700' },
  cardMeta: { color: T.textMuted, fontSize: T.small, marginTop: 2 },
  scoreWrap: { alignItems: 'center' },
  scoreVal: { fontSize: T.h2, fontWeight: '800' },
  scoreLbl: { color: T.textMuted, fontSize: 9 },

  metricRow: { flexDirection: 'row', gap: T.sm, marginTop: 8 },
  metricCell: { flex: 1 },
  metricLbl: { color: T.textMuted, fontSize: 9, letterSpacing: 0.5 },
  metricVal: { fontSize: T.body, fontWeight: '800' },

  actRow: { flexDirection: 'row', gap: 8, marginTop: T.sm },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: T.radiusSm },
  actText: { color: T.bg, fontWeight: '700', fontSize: T.small },
});
