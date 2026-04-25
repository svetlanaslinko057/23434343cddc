/**
 * BLOCK 5.1 — Admin System Actions feed.
 * Shows auto_actions with revert button + confidence gauge.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import api from '../../src/api';

type Action = {
  action_id: string;
  module_id: string;
  module_title?: string;
  type: 'auto_rebalance' | 'auto_add_support';
  payload: any;
  confidence: number;
  confidence_breakdown?: { signal_strength: number; data_confidence: number; stability: number };
  status: 'pending' | 'executed' | 'skipped' | 'reverted' | 'failed';
  executed_at?: string;
  reverted_at?: string;
  revert_available?: boolean;
  team_band_at_creation?: string;
  team_risk?: number;
  team_efficiency?: number;
  enriched?: { from_dev_name?: string; to_dev_name?: string; candidate_name?: string };
};

const TYPE_ICON: Record<string, string> = {
  auto_rebalance: '⚖️',
  auto_add_support: '➕',
};
const STATUS_COLOR: Record<string, string> = {
  executed: '#22d3b4',
  pending:  '#f5b93a',
  reverted: '#9fb3b3',
  skipped:  '#6c7a7a',
  failed:   '#ff6b6b',
};

function describeAction(a: Action): string {
  const e = a.enriched || {};
  const p = a.payload || {};
  if (a.type === 'auto_rebalance') {
    return `Moved "${p.task_title || 'task'}" from ${e.from_dev_name || p.from_dev} → ${e.to_dev_name || p.to_dev}`;
  }
  if (a.type === 'auto_add_support') {
    return `Added ${e.candidate_name || p.candidate_name || 'support dev'} as executor (triggered by silence/low velocity)`;
  }
  return JSON.stringify(p);
}

export default function AutonomyAdminScreen() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/auto-actions?limit=50');
      setActions(res.data.actions || []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setBusy(true);
    try {
      const r = await api.post('/auto-actions/scan', {});
      Alert.alert(
        'Scan complete',
        `Evaluated ${r.data.evaluated} · created ${r.data.created} · executed ${r.data.executed}`
      );
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    } finally { setBusy(false); }
  };

  const revert = async (id: string) => {
    try {
      await api.post(`/auto-actions/${id}/revert`, {});
      Alert.alert('Reverted', 'Action rolled back');
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#22d3b4" /></SafeAreaView>;
  if (error) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.err}>{error}</Text>
      <TouchableOpacity onPress={load} style={styles.btn}><Text style={styles.btnTxt}>Retry</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const executed = actions.filter(a => a.status === 'executed');
  const pending = actions.filter(a => a.status === 'pending');
  const reverted = actions.filter(a => a.status === 'reverted');

  return (
    <SafeAreaView style={styles.root} testID="autonomy-admin-screen">
      <Stack.Screen options={{ title: 'System Actions', headerStyle: { backgroundColor: '#0a1214' }, headerTintColor: '#e5f6f3' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#22d3b4" />}
      >
        <View style={styles.hRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>System Actions</Text>
            <Text style={styles.sub}>Block 5.1 · Controlled autonomy · revert-able</Text>
          </View>
          <TouchableOpacity
            style={[styles.scanBtn, busy && { opacity: 0.5 }]}
            onPress={scan} disabled={busy}
            testID="autonomy-scan-btn"
          >
            <Text style={styles.scanTxt}>{busy ? '...' : 'Scan now'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <View style={styles.sCard}><Text style={styles.sLbl}>EXECUTED</Text><Text style={styles.sNum}>{executed.length}</Text></View>
          <View style={styles.sCard}><Text style={styles.sLbl}>PENDING</Text><Text style={[styles.sNum, { color: '#f5b93a' }]}>{pending.length}</Text></View>
          <View style={styles.sCard}><Text style={styles.sLbl}>REVERTED</Text><Text style={[styles.sNum, { color: '#9fb3b3' }]}>{reverted.length}</Text></View>
        </View>

        <Text style={styles.hint}>
          Confidence ≥ 0.80 → auto-execute · 0.6 to 0.8 → recommendation only · &lt; 0.6 ignored.
          Cooldown 10 min per module · same action 24 h.
        </Text>

        {actions.length === 0 ? (
          <Text style={styles.empty}>No autonomous actions yet. Click "Scan now" or wait for the 5-min scheduler.</Text>
        ) : (
          actions.map((a) => (
            <View key={a.action_id} style={styles.card} testID={`action-${a.action_id}`}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{TYPE_ICON[a.type]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {a.type.replace('auto_', '').replace('_', ' ')}
                  </Text>
                  <Text style={styles.cardModule}>{a.module_title || a.module_id}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[a.status] + '22' }]}>
                  <Text style={[styles.statusTxt, { color: STATUS_COLOR[a.status] }]}>
                    {a.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardBody}>{describeAction(a)}</Text>

              <View style={styles.confRow}>
                <Text style={styles.confLbl}>confidence</Text>
                <View style={styles.confBar}>
                  <View style={[
                    styles.confFill,
                    { width: `${a.confidence * 100}%`,
                      backgroundColor: a.confidence >= 0.8 ? '#22d3b4' : a.confidence >= 0.6 ? '#f5b93a' : '#ff6b6b' },
                  ]} />
                </View>
                <Text style={styles.confVal}>{(a.confidence * 100).toFixed(0)}%</Text>
              </View>

              {a.confidence_breakdown && (
                <Text style={styles.breakdown}>
                  signal {(a.confidence_breakdown.signal_strength * 100).toFixed(0)}% ·
                  data {(a.confidence_breakdown.data_confidence * 100).toFixed(0)}% ·
                  stability {(a.confidence_breakdown.stability * 100).toFixed(0)}%
                </Text>
              )}

              {a.status === 'executed' && a.revert_available && (
                <TouchableOpacity
                  style={styles.revertBtn}
                  onPress={() => revert(a.action_id)}
                  testID={`revert-${a.action_id}`}
                >
                  <Text style={styles.revertTxt}>↶ Undo</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
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
  sub: { color: '#6c7a7a', fontSize: 12, marginTop: 4 },
  err: { color: '#ff6b6b', fontSize: 14 },
  btn: { backgroundColor: '#22d3b4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  btnTxt: { color: '#0a1214', fontWeight: '700' },
  scanBtn: { backgroundColor: '#22d3b4', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  scanTxt: { color: '#0a1214', fontSize: 12, fontWeight: '700' },

  summary: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sCard: { flex: 1, backgroundColor: '#0f1b1f', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1c2a2e' },
  sLbl: { color: '#6c7a7a', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sNum: { color: '#22d3b4', fontSize: 22, fontWeight: '800', marginTop: 4 },

  hint: { color: '#6c7a7a', fontSize: 11, marginBottom: 16, fontStyle: 'italic', lineHeight: 16 },
  empty: { color: '#6c7a7a', fontSize: 13, fontStyle: 'italic', marginTop: 20, textAlign: 'center' },

  card: {
    backgroundColor: '#0f1b1f', borderRadius: 12, padding: 14, marginVertical: 6,
    borderWidth: 1, borderColor: '#1c2a2e',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: '#e5f6f3', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  cardModule: { color: '#6c7a7a', fontSize: 11, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardBody: { color: '#9fb3b3', fontSize: 12, marginTop: 10, lineHeight: 16 },

  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  confLbl: { color: '#6c7a7a', fontSize: 10, width: 76 },
  confBar: { flex: 1, height: 5, backgroundColor: '#1c2a2e', borderRadius: 3, overflow: 'hidden' },
  confFill: { height: 5 },
  confVal: { color: '#22d3b4', fontSize: 12, fontWeight: '700', width: 42, textAlign: 'right' },

  breakdown: { color: '#6c7a7a', fontSize: 10, marginTop: 6 },

  revertBtn: {
    marginTop: 12, borderWidth: 1, borderColor: '#9fb3b3',
    paddingVertical: 6, borderRadius: 6, alignItems: 'center',
  },
  revertTxt: { color: '#e5f6f3', fontSize: 12, fontWeight: '600' },
});
