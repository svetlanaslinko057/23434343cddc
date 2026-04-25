/**
 * BLOCK 3 — TEAM LAYER admin screen.
 * Lists all teamed modules + global load snapshot + quick assign-from-suggestion.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import api from '../../src/api';

type DevRow = { user_id: string; name: string; load: number; capacity: number; utilization: number };
type ModuleRow = {
  module_id: string;
  title: string;
  status?: string;
  price?: number;
  team_size: number;
  total_allocation: number;
  members: Array<{ developer_id: string; role: string; allocation: number; responsibility: number }>;
};
type Overview = {
  modules: ModuleRow[];
  developers: DevRow[];
  summary: { teamed_modules: number; overloaded_devs: number; idle_devs: number; total_devs: number };
};

export default function TeamsAdminScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/teams/overview');
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const quickAssign = async (moduleId: string) => {
    try {
      const s = await api.get(`/modules/${moduleId}/team/suggest?size=2`);
      const members = s.data.members || [];
      if (members.length === 0) {
        Alert.alert('No capacity', 'No developers with spare capacity available.');
        return;
      }
      await api.post(`/modules/${moduleId}/team/assign`, {
        members: members.map((m: any) => ({
          developer_id: m.developer_id,
          role: m.role,
          allocation: m.allocation,
          responsibility: m.responsibility,
        })),
      });
      await load();
      Alert.alert('Team assigned', `${members.length} dev(s) joined.`);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    }
  };

  const distribute = async (moduleId: string) => {
    try {
      const r = await api.post(`/modules/${moduleId}/team/distribute-tasks`, {
        strategy: 'by_responsibility',
      });
      Alert.alert('Distributed', `${r.data.distributed} tasks assigned`);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Error');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#22d3b4" />
      </SafeAreaView>
    );
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

  const s = data?.summary;
  return (
    <SafeAreaView style={styles.root} testID="teams-admin-screen">
      <Stack.Screen options={{ title: 'Team Layer', headerStyle: { backgroundColor: '#0a1214' }, headerTintColor: '#e5f6f3' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#22d3b4" />}
      >
        <Text style={styles.h1}>Team Layer</Text>
        <Text style={styles.sub}>Modules → N developers with roles & responsibility shares</Text>

        {/* SUMMARY */}
        <View style={styles.summaryRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Teamed</Text>
            <Text style={styles.statVal}>{s?.teamed_modules ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overloaded</Text>
            <Text style={[styles.statVal, (s?.overloaded_devs ?? 0) > 0 && styles.warn]}>{s?.overloaded_devs ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Idle devs</Text>
            <Text style={styles.statVal}>{s?.idle_devs ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statVal}>{s?.total_devs ?? 0}</Text>
          </View>
        </View>

        {/* DEVELOPERS */}
        <Text style={styles.h2}>Developers · Load</Text>
        {(data?.developers || []).length === 0 ? (
          <Text style={styles.empty}>No developers yet</Text>
        ) : (
          (data?.developers || []).map((d) => (
            <View key={d.user_id} style={styles.devRow} testID={`dev-load-${d.user_id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.devName}>{d.name}</Text>
                <Text style={styles.devMeta}>
                  load {(d.load * 100).toFixed(0)}% / capacity {(d.capacity * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={[
                styles.loadBar,
                { width: 100 },
              ]}>
                <View style={[
                  styles.loadFill,
                  {
                    width: `${Math.min(100, d.utilization * 100)}%`,
                    backgroundColor: d.utilization > 1 ? '#ff6b6b' : d.utilization > 0.8 ? '#f5b93a' : '#22d3b4',
                  },
                ]} />
              </View>
            </View>
          ))
        )}

        {/* TEAMED MODULES */}
        <Text style={styles.h2}>Teamed modules</Text>
        {(data?.modules || []).length === 0 ? (
          <Text style={styles.empty}>No modules have active teams.</Text>
        ) : (
          (data?.modules || []).map((m) => (
            <View key={m.module_id} style={styles.modCard} testID={`mod-card-${m.module_id}`}>
              <View style={styles.modHeader}>
                <Text style={styles.modTitle}>{m.title}</Text>
                <Text style={styles.modPrice}>${m.price || 0}</Text>
              </View>
              <Text style={styles.modMeta}>
                team of {m.team_size} · allocation {(m.total_allocation * 100).toFixed(0)}%
              </Text>
              <View style={styles.memberList}>
                {m.members.map((mem, idx) => (
                  <View key={`${mem.developer_id}-${idx}`} style={styles.memberChip}>
                    <Text style={[
                      styles.memberChipTxt,
                      mem.role === 'owner' && styles.memberOwner,
                    ]}>
                      {mem.role === 'owner' ? '★' : '•'} {(mem.responsibility * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actBtn}
                  onPress={() => distribute(m.module_id)}
                  testID={`distribute-${m.module_id}`}
                >
                  <Text style={styles.actBtnTxt}>Distribute tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actBtnPrimary]}
                  onPress={() => quickAssign(m.module_id)}
                  testID={`reassign-${m.module_id}`}
                >
                  <Text style={[styles.actBtnTxt, styles.actBtnPrimaryTxt]}>Re-suggest</Text>
                </TouchableOpacity>
              </View>
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
  h1: { color: '#e5f6f3', fontSize: 22, fontWeight: '800' },
  h2: { color: '#e5f6f3', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  sub: { color: '#6c7a7a', fontSize: 12, marginTop: 4, marginBottom: 16 },
  empty: { color: '#6c7a7a', fontSize: 13, fontStyle: 'italic', marginVertical: 8 },
  err: { color: '#ff6b6b', fontSize: 14 },
  btn: { backgroundColor: '#22d3b4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  btnTxt: { color: '#0a1214', fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#0f1b1f', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#1c2a2e',
  },
  statLabel: { color: '#6c7a7a', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { color: '#e5f6f3', fontSize: 20, fontWeight: '800', marginTop: 4 },
  warn: { color: '#ff6b6b' },

  devRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1c2a2e',
  },
  devName: { color: '#e5f6f3', fontSize: 14, fontWeight: '600' },
  devMeta: { color: '#6c7a7a', fontSize: 11, marginTop: 2 },
  loadBar: {
    height: 6, backgroundColor: '#1c2a2e', borderRadius: 3, overflow: 'hidden',
  },
  loadFill: { height: 6, backgroundColor: '#22d3b4' },

  modCard: {
    backgroundColor: '#0f1b1f', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#22d3b433',
  },
  modHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  modTitle: { color: '#e5f6f3', fontSize: 15, fontWeight: '700', flex: 1 },
  modPrice: { color: '#22d3b4', fontSize: 14, fontWeight: '700' },
  modMeta: { color: '#6c7a7a', fontSize: 11, marginTop: 4 },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  memberChip: {
    backgroundColor: '#1c2a2e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
  },
  memberChipTxt: { color: '#6c7a7a', fontSize: 11, fontWeight: '600' },
  memberOwner: { color: '#22d3b4' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: {
    flex: 1, backgroundColor: '#1c2a2e', paddingVertical: 8, borderRadius: 6,
    alignItems: 'center',
  },
  actBtnTxt: { color: '#e5f6f3', fontSize: 12, fontWeight: '600' },
  actBtnPrimary: { backgroundColor: '#22d3b4' },
  actBtnPrimaryTxt: { color: '#0a1214' },
});
