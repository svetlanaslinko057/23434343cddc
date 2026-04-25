import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import T from '../../src/theme';

// Wave 9 — Admin Market Health / Flow Alerts
// Principle: System recommends — market decides. Never auto-assign.
// Surfaces: Overloaded developers · Modules at risk (stuck) · Modules needing invite-to-bid · Underused capacity

type Alerts = {
  overloaded: { developer_id: string; name: string; active: number; capacity: number; load_pct: number }[];
  underused: { developer_id: string; name: string; capacity: number; skills: string[] }[];
  at_risk: { module_id: string; title: string; status: string; assigned_to?: string; reason: string }[];
  needs_invite: { module_id: string; title: string; price: number; hours_open: number }[];
  summary: { overloaded_count: number; at_risk_count: number; needs_invite_count: number };
};

export default function AdminMarket() {
  const router = useRouter();
  const [data, setData] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/flow/alerts');
      setData(r.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load flow alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const reopen = async (moduleId: string) => {
    setActing(`reopen-${moduleId}`);
    try {
      await api.post(`/modules/${moduleId}/reopen-bidding`);
      Alert.alert('Reopened', 'Bidding reopened.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setActing(null); }
  };

  const boost = async (moduleId: string) => {
    setActing(`boost-${moduleId}`);
    try {
      await api.post(`/admin/modules/${moduleId}/boost`);
      Alert.alert('Boosted', 'Price boosted +20%.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Boost failed');
    } finally { setActing(null); }
  };

  const openWorkspaceForProject = (projectId?: string | null) => {
    if (!projectId) { Alert.alert('Navigation', 'No project linked. Open from /admin/projects.'); return; }
    router.push(`/workspace/${projectId}` as any);
  };

  if (loading && !data) {
    return <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={T.primary} /></View>;
  }

  const d = data!;
  const healthy = d.summary.overloaded_count === 0 && d.summary.at_risk_count === 0 && d.summary.needs_invite_count === 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: T.md, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      testID="admin-market-screen">
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Flow Alerts</Text>
          <Text style={s.subtitle}>System recommends — market decides. No auto-assign.</Text>
        </View>
        <TouchableOpacity testID="flow-refresh-btn" style={s.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={T.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary banner */}
      <View style={[s.summary, { borderColor: healthy ? T.success + '55' : T.risk + '55' }]} testID="flow-summary">
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: d.summary.overloaded_count ? T.danger : T.textMuted }]}>{d.summary.overloaded_count}</Text>
          <Text style={s.summaryLbl}>Overloaded</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: d.summary.at_risk_count ? T.risk : T.textMuted }]}>{d.summary.at_risk_count}</Text>
          <Text style={s.summaryLbl}>At risk</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: d.summary.needs_invite_count ? T.info : T.textMuted }]}>{d.summary.needs_invite_count}</Text>
          <Text style={s.summaryLbl}>Need invite</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: T.primary }]}>{d.underused.length}</Text>
          <Text style={s.summaryLbl}>Underused</Text>
        </View>
      </View>

      {healthy && (
        <View style={s.healthy} testID="flow-healthy">
          <Ionicons name="checkmark-circle" size={22} color={T.success} />
          <Text style={s.healthyText}>Flow is healthy — no action needed.</Text>
        </View>
      )}

      {/* Overloaded Developers */}
      <Section icon="flame" color={T.danger} title="Overloaded developers" count={d.overloaded.length} />
      {d.overloaded.length === 0
        ? <Empty text="No one is at or above capacity." />
        : d.overloaded.map(dv => (
          <View key={dv.developer_id} style={[s.card, { borderLeftColor: T.danger }]} testID={`overloaded-${dv.developer_id}`}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{dv.name}</Text>
              <Text style={[s.loadPill, { color: T.danger, borderColor: T.danger + '77' }]}>{dv.active}/{dv.capacity}</Text>
            </View>
            <Text style={s.cardHint}>Load {dv.load_pct}% · redirect new modules to other qualified developers</Text>
          </View>
        ))}

      {/* Modules At Risk */}
      <Section icon="warning" color={T.risk} title="Modules at risk" count={d.at_risk.length} />
      {d.at_risk.length === 0
        ? <Empty text="No stuck modules." />
        : d.at_risk.map(m => (
          <View key={m.module_id} style={[s.card, { borderLeftColor: T.risk }]} testID={`at-risk-${m.module_id}`}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{m.title}</Text>
              <Text style={[s.statusPill, { color: T.risk, borderColor: T.risk + '77' }]}>{m.status.replace('_', ' ')}</Text>
            </View>
            <Text style={s.cardHint}>{m.reason}</Text>
            <View style={s.actRow}>
              <TouchableOpacity
                testID={`flow-reopen-${m.module_id}`}
                style={[s.actBtn, { backgroundColor: T.primary }]}
                onPress={() => reopen(m.module_id)}
                disabled={acting === `reopen-${m.module_id}`}>
                {acting === `reopen-${m.module_id}`
                  ? <ActivityIndicator color={T.bg} size="small" />
                  : <><Ionicons name="refresh" size={13} color={T.bg} /><Text style={s.actPrimaryText}>Reopen bidding</Text></>}
              </TouchableOpacity>
              <TouchableOpacity
                testID={`flow-open-ws-${m.module_id}`}
                style={[s.actBtn, s.actGhost]}
                onPress={() => openWorkspaceForProject(m.project_id)}>
                <Ionicons name="open-outline" size={13} color={T.text} />
                <Text style={s.actGhostText}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      {/* Needs Invite */}
      <Section icon="person-add" color={T.info} title="Modules needing invite-to-bid" count={d.needs_invite.length} />
      {d.needs_invite.length === 0
        ? <Empty text="All open modules have traction." />
        : d.needs_invite.map(m => (
          <View key={m.module_id} style={[s.card, { borderLeftColor: T.info }]} testID={`needs-invite-${m.module_id}`}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{m.title}</Text>
              <Text style={s.cardPrice}>${m.price}</Text>
            </View>
            <Text style={s.cardHint}>Open {m.hours_open}h · 0 bids · consider inviting top-3 qualified devs</Text>
            <View style={s.actRow}>
              <TouchableOpacity
                testID={`flow-invite-open-${m.module_id}`}
                style={[s.actBtn, { backgroundColor: T.primary }]}
                onPress={() => openWorkspaceForProject(m.project_id)}>
                <Ionicons name="people" size={13} color={T.bg} />
                <Text style={s.actPrimaryText}>Recommend top-3 →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`flow-boost-${m.module_id}`}
                style={[s.actBtn, s.actGhost]}
                onPress={() => boost(m.module_id)}
                disabled={acting === `boost-${m.module_id}`}>
                {acting === `boost-${m.module_id}`
                  ? <ActivityIndicator color={T.risk} size="small" />
                  : <><Ionicons name="trending-up" size={13} color={T.risk} /><Text style={[s.actGhostText, { color: T.risk }]}>Boost +20%</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        ))}

      {/* Underused capacity */}
      <Section icon="battery-half" color={T.primary} title="Underused capacity" count={d.underused.length} />
      {d.underused.length === 0
        ? <Empty text="Everyone is engaged." />
        : d.underused.map(dv => (
          <View key={dv.developer_id} style={[s.card, { borderLeftColor: T.primary }]} testID={`underused-${dv.developer_id}`}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{dv.name}</Text>
              <Text style={[s.loadPill, { color: T.primary, borderColor: T.primary + '77' }]}>0/{dv.capacity}</Text>
            </View>
            <Text style={s.cardHint}>Skills: {dv.skills.length ? dv.skills.join(', ') : 'unknown'} · consider inviting to open modules</Text>
          </View>
        ))}
    </ScrollView>
  );
}

function Section({ icon, color, title, count }: { icon: string; color: string; title: string; count: number }) {
  return (
    <View style={s.section}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[s.sectionTitle, { color }]}>{title}</Text>
      <View style={[s.sectionBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <Text style={[s.sectionBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={s.empty}><Text style={s.emptyText}>{text}</Text></View>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.small, marginTop: 2, fontStyle: 'italic' },
  refreshBtn: { width: 40, height: 40, borderRadius: T.radiusSm, backgroundColor: T.surface1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  summary: { flexDirection: 'row', backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, borderWidth: 1, marginBottom: T.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 26, fontWeight: '800' },
  summaryLbl: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  healthy: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.success + '15', borderColor: T.success + '44', borderWidth: 1, padding: T.md, borderRadius: T.radiusSm, marginBottom: T.md },
  healthyText: { color: T.success, fontWeight: '600', fontSize: T.small },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: T.md, marginBottom: T.sm },
  sectionTitle: { fontSize: T.h3, fontWeight: '700', flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  sectionBadgeText: { fontWeight: '700', fontSize: T.tiny },
  card: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: T.text, fontSize: T.body, fontWeight: '600', flex: 1 },
  cardHint: { color: T.textMuted, fontSize: T.small, marginBottom: 4 },
  cardPrice: { color: T.primary, fontWeight: '700' },
  loadPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, fontSize: T.tiny, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, fontSize: T.tiny, fontWeight: '700' },
  actRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: T.radiusSm },
  actPrimaryText: { color: T.bg, fontWeight: '700', fontSize: T.small },
  actGhost: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border },
  actGhostText: { color: T.text, fontWeight: '600', fontSize: T.small },
  empty: { padding: T.md, backgroundColor: T.surface1 + '88', borderRadius: T.radiusSm, borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', marginBottom: T.sm },
  emptyText: { color: T.textMuted, fontSize: T.small, textAlign: 'center', fontStyle: 'italic' },
});
