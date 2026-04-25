import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import api from '../../src/api';
import T from '../../src/theme';

export default function AdminQA() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { try { const r = await api.get('/admin/qa/overview'); setData(r.data); } catch {} };
  useEffect(() => { load(); }, []);

  const decide = async (moduleId: string, decision: string) => {
    try {
      await api.post(`/admin/modules/${moduleId}/qa-decision`, { decision, quality_score: decision === 'pass' ? 90 : 60, feedback: decision === 'pass' ? 'Approved' : 'Needs revision' });
      Alert.alert('Done', `QA: ${decision}`);
      load();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={T.primary} />}>
      <View testID="admin-qa" style={s.content}>
        <Text style={s.title}>QA Queue</Text>
        <View style={s.stats}>
          <Text style={s.stat}>Pending: {data?.pending_count || 0}</Text>
          <Text style={s.stat}>Approved today: {data?.approved_today || 0}</Text>
          <Text style={s.stat}>Revision rate: {data?.revision_rate || 0}%</Text>
        </View>
        {(data?.queue || []).map((m: any) => (
          <View key={m.module_id} style={s.card}>
            <Text style={s.cardTitle}>{m.title}</Text>
            <Text style={s.cardSub}>{m.developer_name || 'Unknown'} — Rev #{m.revision_count}</Text>
            {m.deliverable_url && <Text style={s.link}>{m.deliverable_url}</Text>}
            <View style={s.actions}>
              <TouchableOpacity testID={`qa-pass-${m.module_id}`} style={[s.btn, { backgroundColor: T.success + '22' }]} onPress={() => decide(m.module_id, 'pass')}>
                <Text style={[s.btnText, { color: T.success }]}>Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`qa-revision-${m.module_id}`} style={[s.btn, { backgroundColor: T.risk + '22' }]} onPress={() => decide(m.module_id, 'revision')}>
                <Text style={[s.btnText, { color: T.risk }]}>Revision</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {data?.queue?.length === 0 && <Text style={s.empty}>No items in QA queue</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.md },
  stats: { flexDirection: 'row', gap: T.md, marginBottom: T.lg },
  stat: { color: T.textMuted, fontSize: T.small },
  card: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.md, borderWidth: 1, borderColor: T.border },
  cardTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  cardSub: { color: T.textMuted, fontSize: T.small, marginTop: 4 },
  link: { color: T.info, fontSize: T.tiny, marginTop: 4 },
  actions: { flexDirection: 'row', gap: T.sm, marginTop: T.md },
  btn: { flex: 1, borderRadius: T.radiusSm, padding: 12, alignItems: 'center' },
  btnText: { fontWeight: '600', fontSize: T.body },
  empty: { color: T.textMuted, textAlign: 'center', marginTop: T.xl },
});
