/**
 * BLOCK 4.3 — Team Intelligence admin screen.
 * Strong / Stable / Fragile / Failing bands + recommendations feed.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import api from '../../src/api';

type Rec = {
  module_id: string;
  module_title?: string;
  type: 'rebalance' | 'change_owner' | 'add_support' | 'escalate_qa';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
};
type TeamScore = {
  module_id: string;
  module_title: string;
  team_size: number;
  team_efficiency: number;
  team_risk: number;
  team_band: 'strong' | 'stable' | 'fragile' | 'failing';
  progress_velocity: number;
  avg_quality: number;
  load_balance: number;
  collaboration_stability: number;
  overload_risk: number;
  qa_risk: number;
  silence_risk: number;
  reassignment_risk: number;
  role_fit_risk: number;
  recommendation_count: number;
};
type Overview = {
  counts: { strong: number; stable: number; fragile: number; failing: number; total: number };
  strong: TeamScore[];
  fragile: TeamScore[];
  failing: TeamScore[];
  recommendations: Rec[];
};

const BAND: Record<string, { fg: string; bg: string; label: string }> = {
  strong:  { fg: '#22d3b4', bg: '#0d3a2f', label: 'STRONG' },
  stable:  { fg: '#6fd67a', bg: '#1b3020', label: 'STABLE' },
  fragile: { fg: '#f5b93a', bg: '#3a2f1b', label: 'FRAGILE' },
  failing: { fg: '#ff6b6b', bg: '#3a1b1b', label: 'FAILING' },
};

const REC_ICON: Record<string, string> = {
  rebalance:    '⚖️',
  change_owner: '👑',
  add_support:  '➕',
  escalate_qa:  '🚨',
};

function TeamRow({ t }: { t: TeamScore }) {
  const band = BAND[t.team_band] || BAND.fragile;
  return (
    <View style={styles.teamRow} testID={`team-score-${t.module_id}`}>
      <View style={[styles.pill, { backgroundColor: band.bg }]}>
        <Text style={[styles.pillEff, { color: band.fg }]}>
          {t.team_efficiency.toFixed(0)}
        </Text>
        <Text style={[styles.pillRisk, { color: band.fg }]}>
          R{t.team_risk.toFixed(0)}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.tTitle}>{t.module_title || t.module_id}</Text>
        <Text style={styles.tMeta}>
          size {t.team_size} · velocity {(t.progress_velocity * 100).toFixed(0)}% ·
          balance {(t.load_balance * 100).toFixed(0)}% ·
          Q {t.avg_quality.toFixed(0)}
        </Text>
        {t.recommendation_count > 0 && (
          <Text style={styles.tRecs}>{t.recommendation_count} recommendation(s)</Text>
        )}
      </View>
      <Text style={[styles.bandTxt, { color: band.fg }]}>{band.label}</Text>
    </View>
  );
}

function RecCard({ r }: { r: Rec }) {
  const sevColor = r.severity === 'high' ? '#ff6b6b' : r.severity === 'medium' ? '#f5b93a' : '#6fd67a';
  return (
    <View style={styles.recCard} testID={`rec-${r.module_id}-${r.type}`}>
      <View style={styles.recHeader}>
        <Text style={styles.recIcon}>{REC_ICON[r.type] || '•'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.recTitle}>{r.title}</Text>
          <Text style={styles.recModule}>{r.module_title || r.module_id}</Text>
        </View>
        <Text style={[styles.recSev, { color: sevColor }]}>{r.severity.toUpperCase()}</Text>
      </View>
      <Text style={styles.recDetail}>{r.detail}</Text>
    </View>
  );
}

export default function TeamsIntelligenceScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/intelligence/admin/teams');
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recompute = async () => {
    setBusy(true);
    try {
      const r = await api.post('/intelligence/recalculate-team', {});
      Alert.alert('Recomputed', `${r.data.recomputed} team(s) refreshed`);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#22d3b4" /></SafeAreaView>;
  if (error) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.err}>{error}</Text>
      <TouchableOpacity onPress={load} style={styles.btn}><Text style={styles.btnTxt}>Retry</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const c = data?.counts;
  return (
    <SafeAreaView style={styles.root} testID="teams-intel-screen">
      <Stack.Screen options={{ title: 'Team Intelligence', headerStyle: { backgroundColor: '#0a1214' }, headerTintColor: '#e5f6f3' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#22d3b4" />}
      >
        <View style={styles.hRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Team Intelligence</Text>
            <Text style={styles.sub}>Block 4.3 · efficiency × risk per module</Text>
          </View>
          <TouchableOpacity
            style={[styles.recompBtn, busy && { opacity: 0.5 }]}
            onPress={recompute} disabled={busy}
            testID="recompute-teams-btn"
          >
            <Text style={styles.recompTxt}>{busy ? '...' : 'Recompute'}</Text>
          </TouchableOpacity>
        </View>

        {/* Band counts */}
        <View style={styles.bandsRow}>
          {(['strong', 'stable', 'fragile', 'failing'] as const).map((b) => {
            const color = BAND[b];
            return (
              <View key={b} style={[styles.bandCard, { borderColor: color.fg + '55' }]}>
                <Text style={[styles.bandLabel, { color: color.fg }]}>{color.label}</Text>
                <Text style={styles.bandNum}>{c?.[b] ?? 0}</Text>
              </View>
            );
          })}
        </View>

        {/* Recommendations feed */}
        <Text style={styles.h2}>💡 Active recommendations</Text>
        {(data?.recommendations || []).length === 0 ? (
          <Text style={styles.empty}>No open recommendations · all teams stable</Text>
        ) : (
          (data?.recommendations || []).slice(0, 10).map((r, i) => (
            <RecCard key={`${r.module_id}-${r.type}-${i}`} r={r} />
          ))
        )}

        <Text style={styles.h2}>🏆 Strong teams</Text>
        {(data?.strong || []).length === 0
          ? <Text style={styles.empty}>None yet · need efficiency ≥75 and risk &lt;35</Text>
          : (data?.strong || []).map((t) => <TeamRow key={t.module_id} t={t} />)
        }

        <Text style={styles.h2}>⚠ Fragile</Text>
        {(data?.fragile || []).length === 0
          ? <Text style={styles.empty}>None</Text>
          : (data?.fragile || []).map((t) => <TeamRow key={t.module_id} t={t} />)
        }

        <Text style={styles.h2}>🚨 Failing</Text>
        {(data?.failing || []).length === 0
          ? <Text style={styles.empty}>None</Text>
          : (data?.failing || []).map((t) => <TeamRow key={t.module_id} t={t} />)
        }

        <Text style={styles.hint}>
          Bands: STRONG (eff ≥75 AND risk &lt;35) · STABLE (≥60/&lt;50) ·
          FRAGILE (≥40/&lt;70) · else FAILING.
          {'\n'}Efficiency = velocity×40 + avg_quality×25 + load_balance×20 + stability×15.
          {'\n'}Risk = overload×30 + qa×25 + silence×20 + reassign×15 + role_fit×10.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1214' },
  center: { flex: 1, backgroundColor: '#0a1214', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  hRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  h1: { color: '#e5f6f3', fontSize: 22, fontWeight: '800' },
  h2: { color: '#e5f6f3', fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  sub: { color: '#6c7a7a', fontSize: 12, marginTop: 4 },
  empty: { color: '#6c7a7a', fontSize: 13, fontStyle: 'italic' },
  err: { color: '#ff6b6b', fontSize: 14 },
  btn: { backgroundColor: '#22d3b4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  btnTxt: { color: '#0a1214', fontWeight: '700' },

  recompBtn: { backgroundColor: '#22d3b4', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  recompTxt: { color: '#0a1214', fontSize: 12, fontWeight: '700' },

  bandsRow: { flexDirection: 'row', gap: 8 },
  bandCard: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#0f1b1f', borderWidth: 1 },
  bandLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  bandNum: { color: '#e5f6f3', fontSize: 22, fontWeight: '800', marginTop: 4 },

  teamRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1c2a2e',
  },
  pill: { width: 56, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  pillEff: { fontSize: 18, fontWeight: '800' },
  pillRisk: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  tTitle: { color: '#e5f6f3', fontSize: 14, fontWeight: '600' },
  tMeta: { color: '#6c7a7a', fontSize: 11, marginTop: 2 },
  tRecs: { color: '#f5b93a', fontSize: 11, marginTop: 3, fontWeight: '600' },
  bandTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginLeft: 8 },

  recCard: {
    backgroundColor: '#0f1b1f', borderRadius: 10, padding: 12,
    marginVertical: 6, borderWidth: 1, borderColor: '#1c2a2e',
  },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recIcon: { fontSize: 18 },
  recTitle: { color: '#e5f6f3', fontSize: 14, fontWeight: '700' },
  recModule: { color: '#6c7a7a', fontSize: 11, marginTop: 2 },
  recSev: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recDetail: { color: '#9fb3b3', fontSize: 12, marginTop: 8, lineHeight: 16 },

  hint: {
    color: '#6c7a7a', fontSize: 11, marginTop: 20, fontStyle: 'italic', lineHeight: 16,
  },
});
