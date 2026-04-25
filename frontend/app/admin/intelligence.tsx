/**
 * BLOCK 4.1 — Admin Intelligence screen.
 * Top / Weak / At-risk developers + recompute action.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import api from '../../src/api';

type ScoreRow = {
  developer_id: string;
  name: string;
  level?: string;
  quality_score: number;
  band: 'strong' | 'stable' | 'weak' | 'risk';
  confidence: 'low' | 'medium' | 'high';
  qa_pass_rate: number;
  on_time_rate: number;
  completion_rate: number;
  issue_penalty: number;
};
type Overview = {
  counts: { strong: number; stable: number; weak: number; risk: number; total: number };
  reliability_counts?: { reliable: number; normal: number; unstable: number; unreliable: number };
  top: ScoreRow[];
  weak: ScoreRow[];
  at_risk: ScoreRow[];
  top_reliable?: ScoreRow[];
  unstable?: ScoreRow[];
  unreliable?: ScoreRow[];
  top_combined?: ScoreRow[];
};

const BAND_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  strong: { bg: '#0d3a2f', fg: '#22d3b4', label: 'STRONG' },
  stable: { bg: '#1b3020', fg: '#6fd67a', label: 'STABLE' },
  weak: { bg: '#3a2f1b', fg: '#f5b93a', label: 'WEAK' },
  risk: { bg: '#3a1b1b', fg: '#ff6b6b', label: 'RISK' },
};

function DevRow({ dev }: { dev: ScoreRow }) {
  const band = BAND_COLORS[dev.band] || BAND_COLORS.weak;
  return (
    <View style={styles.devRow} testID={`dev-score-${dev.developer_id}`}>
      <View style={[styles.pill, { backgroundColor: band.bg }]}>
        <Text style={[styles.pillScore, { color: band.fg }]}>
          {dev.quality_score.toFixed(0)}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name}>{dev.name}</Text>
        <Text style={styles.meta}>
          QA {(dev.qa_pass_rate * 100).toFixed(0)}% ·
          OnTime {(dev.on_time_rate * 100).toFixed(0)}% ·
          Done {(dev.completion_rate * 100).toFixed(0)}%
        </Text>
      </View>
      <Text style={[styles.bandTxt, { color: band.fg }]}>{band.label}</Text>
    </View>
  );
}

export default function IntelligenceScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/intelligence/admin/overview');
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
      const r = await api.post('/intelligence/recalculate', {});
      Alert.alert('Recomputed', `Quality scores refreshed for ${r.data.recomputed} developers`);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#22d3b4" /></SafeAreaView>;
  }
  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.err}>{error}</Text>
        <TouchableOpacity onPress={load} style={styles.btn}>
          <Text style={styles.btnTxt}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const c = data?.counts;
  return (
    <SafeAreaView style={styles.root} testID="intelligence-admin-screen">
      <Stack.Screen options={{ title: 'Intelligence', headerStyle: { backgroundColor: '#0a1214' }, headerTintColor: '#e5f6f3' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#22d3b4" />}
      >
        <View style={styles.hRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Intelligence Layer</Text>
            <Text style={styles.sub}>Block 4.1 · Developer Quality Score</Text>
          </View>
          <TouchableOpacity
            style={[styles.recompBtn, busy && styles.recompBtnBusy]}
            onPress={recompute}
            disabled={busy}
            testID="recompute-btn"
          >
            <Text style={styles.recompTxt}>{busy ? '...' : 'Recompute all'}</Text>
          </TouchableOpacity>
        </View>

        {/* BAND COUNTS */}
        <View style={styles.bandsRow}>
          {(['strong', 'stable', 'weak', 'risk'] as const).map((b) => {
            const color = BAND_COLORS[b];
            return (
              <View key={b} style={[styles.bandCard, { borderColor: color.fg + '55' }]}>
                <Text style={[styles.bandLabel, { color: color.fg }]}>{color.label}</Text>
                <Text style={styles.bandNum}>{c?.[b] ?? 0}</Text>
              </View>
            );
          })}
        </View>

        {/* TOP DEVS */}
        <Text style={styles.h2}>⭐ Top devs</Text>
        {(data?.top || []).length === 0 ? (
          <Text style={styles.empty}>None yet · need ≥80 score</Text>
        ) : (
          (data?.top || []).map((d) => <DevRow key={d.developer_id} dev={d} />)
        )}

        {/* WEAK */}
        <Text style={styles.h2}>⚠ Weak devs</Text>
        {(data?.weak || []).length === 0 ? (
          <Text style={styles.empty}>No weak devs 🎉</Text>
        ) : (
          (data?.weak || []).map((d) => <DevRow key={d.developer_id} dev={d} />)
        )}

        {/* AT RISK */}
        <Text style={styles.h2}>🚨 At risk</Text>
        {(data?.at_risk || []).length === 0 ? (
          <Text style={styles.empty}>No one at risk</Text>
        ) : (
          (data?.at_risk || []).map((d) => <DevRow key={d.developer_id} dev={d} />)
        )}

        {/* RELIABILITY SECTION (Block 4.2) */}
        <View style={styles.divider} />
        <Text style={styles.h1sub}>Reliability · Block 4.2</Text>

        <View style={styles.bandsRow}>
          {(['reliable', 'normal', 'unstable', 'unreliable'] as const).map((b) => {
            const color = {
              reliable:   { fg: '#22d3b4', label: 'RELIABLE' },
              normal:     { fg: '#6fd67a', label: 'NORMAL' },
              unstable:   { fg: '#f5b93a', label: 'UNSTABLE' },
              unreliable: { fg: '#ff6b6b', label: 'UNRELIABLE' },
            }[b];
            return (
              <View key={b} style={[styles.bandCard, { borderColor: color.fg + '55' }]}>
                <Text style={[styles.bandLabel, { color: color.fg }]}>{color.label}</Text>
                <Text style={styles.bandNum}>{data?.reliability_counts?.[b] ?? 0}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.h2}>🏆 Top reliable</Text>
        {(data?.top_reliable || []).length === 0 ? (
          <Text style={styles.empty}>None — need ≥80 reliability</Text>
        ) : (
          (data?.top_reliable || []).map((d) => <DevRow key={`r-${d.developer_id}`} dev={d} />)
        )}

        <Text style={styles.h2}>⚠ Unstable</Text>
        {(data?.unstable || []).length === 0 ? (
          <Text style={styles.empty}>None</Text>
        ) : (
          (data?.unstable || []).slice(0, 5).map((d) => <DevRow key={`u-${d.developer_id}`} dev={d} />)
        )}

        <Text style={styles.h2}>🚨 Unreliable</Text>
        {(data?.unreliable || []).length === 0 ? (
          <Text style={styles.empty}>None</Text>
        ) : (
          (data?.unreliable || []).map((d) => <DevRow key={`un-${d.developer_id}`} dev={d} />)
        )}

        <Text style={styles.hint}>
          Reliability formula: consistency×35 + stability×25 + no-reassign×20 + responsiveness×20
          · 14-day window · combined = Q×0.6 + R×0.4
          · Owner gates: Q≥70 AND R≥65 · Exec gates: ≥40/≥40 · Exclude: &lt;30/&lt;30
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
  h1sub: { color: '#e5f6f3', fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#1c2a2e', marginVertical: 24 },
  sub: { color: '#6c7a7a', fontSize: 12, marginTop: 4 },
  h2: { color: '#e5f6f3', fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  empty: { color: '#6c7a7a', fontSize: 13, fontStyle: 'italic' },
  err: { color: '#ff6b6b', fontSize: 14 },
  btn: { backgroundColor: '#22d3b4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  btnTxt: { color: '#0a1214', fontWeight: '700' },

  recompBtn: {
    backgroundColor: '#22d3b4', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 6,
  },
  recompBtnBusy: { opacity: 0.5 },
  recompTxt: { color: '#0a1214', fontSize: 12, fontWeight: '700' },

  bandsRow: { flexDirection: 'row', gap: 8 },
  bandCard: {
    flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#0f1b1f',
    borderWidth: 1,
  },
  bandLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  bandNum: { color: '#e5f6f3', fontSize: 22, fontWeight: '800', marginTop: 4 },

  devRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1c2a2e',
  },
  pill: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  pillScore: { fontSize: 18, fontWeight: '800' },
  name: { color: '#e5f6f3', fontSize: 14, fontWeight: '600' },
  meta: { color: '#6c7a7a', fontSize: 11, marginTop: 2 },
  bandTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginLeft: 8 },

  hint: {
    color: '#6c7a7a', fontSize: 11, marginTop: 20, fontStyle: 'italic',
    lineHeight: 16,
  },
});
