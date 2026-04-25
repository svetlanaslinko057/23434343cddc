import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import T from '../../src/theme';

export default function AdminProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = async () => {
    try { const r = await api.get('/admin/projects'); setProjects(r.data.projects || []); } catch {}
  };

  useEffect(() => { load(); }, []);

  const healthColor = (h: string) => h === 'on_track' ? T.success : h === 'attention' ? T.risk : h === 'blocked' ? T.danger : T.info;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={T.primary} />}>
      <View testID="admin-projects" style={s.content}>
        <Text style={s.title}>Projects</Text>
        {projects.map(p => (
          <TouchableOpacity key={p.project_id} testID={`project-${p.project_id}`} style={s.card} onPress={() => router.push(`/workspace/${p.project_id}`)}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{p.title}</Text>
              <View style={[s.healthBadge, { backgroundColor: healthColor(p.health) + '22' }]}>
                <Text style={[s.healthText, { color: healthColor(p.health) }]}>{p.health}</Text>
              </View>
            </View>
            <Text style={s.cardSub}>Client: {p.client_name}</Text>
            <View style={s.cardMeta}>
              <Text style={s.metaItem}>Modules: {p.modules_done}/{p.modules_total}</Text>
              <Text style={s.metaItem}>${p.total_value}</Text>
              <Text style={[s.metaItem, { color: p.status === 'active' ? T.success : T.textMuted }]}>{p.status}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },
  card: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.md, borderWidth: 1, borderColor: T.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: T.text, fontSize: T.h3, fontWeight: '700', flex: 1 },
  healthBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  healthText: { fontSize: T.tiny, fontWeight: '600' },
  cardSub: { color: T.textMuted, fontSize: T.small, marginTop: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: T.sm },
  metaItem: { color: T.textMuted, fontSize: T.small },
});
