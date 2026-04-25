import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';
import SystemBalance from '../../src/system-balance';
import SystemTruth from '../../src/system-truth';

export default function AdminControl() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/control/pressure');
      setData(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const MetricCard = ({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) => (
    <View style={[s.metric, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={s.metricVal}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}>
      <View testID="admin-control-center" style={s.content}>
        <Text style={s.screenTitle}>Control Center</Text>

        <SystemTruth />

        <SystemBalance />

        {data?.critical_events?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Critical Feed</Text>
            {data.critical_events.slice(0, 5).map((e: any, i: number) => (
              <View key={i} style={s.criticalItem}>
                <View style={s.critDot} />
                <Text style={s.critText}>{e.type}: {JSON.stringify(e.data).substring(0, 60)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.metricsGrid}>
          <MetricCard label="Active Projects" value={data?.active_projects || 0} color={T.success} icon="folder-open" />
          <MetricCard label="QA Queue" value={data?.qa_queue || 0} color={data?.qa_queue > 5 ? T.risk : T.info} icon="checkmark-circle" />
          <MetricCard label="Cashflow Pending" value={`$${data?.cashflow_pending || 0}`} color={T.info} icon="cash" />
          <MetricCard label="Team Load" value={`${data?.team_load_avg || 0}%`} color={T.primary} icon="people" />
          <MetricCard label="Overdue" value={`$${data?.overdue_amount || 0}`} color={data?.overdue_amount > 0 ? T.danger : T.success} icon="alert-circle" />
          <MetricCard label="Open Tickets" value={data?.open_tickets || 0} color={T.risk} icon="chatbubble-ellipses" />
        </View>

        {data?.recent_events?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recent Events</Text>
            {data.recent_events.slice(0, 8).map((e: any, i: number) => (
              <View key={i} style={s.eventItem}>
                <Ionicons name="ellipse" size={6} color={T.textMuted} />
                <Text style={s.eventText}>{e.type}</Text>
                <Text style={s.eventTime}>{new Date(e.created_at).toLocaleTimeString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.md },
  screenTitle: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },
  section: { marginBottom: T.lg },
  sectionTitle: { color: T.textMuted, fontSize: T.small, textTransform: 'uppercase', letterSpacing: 2, marginBottom: T.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: T.sm, marginBottom: T.lg },
  metric: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, width: '48%', borderLeftWidth: 3, borderWidth: 1, borderColor: T.border },
  metricVal: { color: T.text, fontSize: T.h2, fontWeight: '700', marginTop: T.xs },
  metricLabel: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  criticalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface2, borderRadius: T.radiusSm, padding: T.sm, marginBottom: T.xs },
  critDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.danger, marginRight: T.sm },
  critText: { color: T.text, fontSize: T.small, flex: 1 },
  eventItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: T.sm },
  eventText: { color: T.text, fontSize: T.small, flex: 1 },
  eventTime: { color: T.textMuted, fontSize: T.tiny },
});
