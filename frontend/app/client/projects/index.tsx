// Client → Projects tab
//
// Real read of /api/projects/mine — the canonical "what do I own" endpoint.
// Each card shows progress + module counts derived from the project document.

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/api';
import T from '../../../src/theme';

type Project = {
  project_id: string;
  name?: string;
  title?: string;
  status?: string;
  current_stage?: string;
  progress?: number;
  production_mode?: string;
  created_at?: string;
};

type ModuleSummary = {
  module_id: string;
  project_id: string;
  status: string;
  title?: string;
};

const STAGE_LABEL: Record<string, string> = {
  development: 'In development',
  delivered:   'Delivered',
  review:      'In review',
  paused:      'Paused',
  draft:       'Planning',
};

const MODE_LABEL: Record<string, string> = {
  ai:     'AI Build',
  hybrid: 'AI + Engineering',
  dev:    'Full Engineering',
};

export default function ClientProjects() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [modulesByProject, setModulesByProject] = useState<Record<string, ModuleSummary[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/projects/mine');
      const list: Project[] = Array.isArray(r.data) ? r.data : [];
      setProjects(list);

      // Pull modules for each project (cheap N=2-5 fan-out, same as web admin).
      const next: Record<string, ModuleSummary[]> = {};
      await Promise.all(list.map(async (p) => {
        try {
          const w = await api.get(`/client/project/${p.project_id}/workspace`);
          const mods: ModuleSummary[] = (w.data?.modules || []).map((m: any) => ({
            module_id: m.module_id,
            project_id: p.project_id,
            status: m.status,
            title: m.module_title || m.title,
          }));
          next[p.project_id] = mods;
        } catch {
          next[p.project_id] = [];
        }
      }));
      setModulesByProject(next);
    } catch {
      /* silent — auth interceptor handles 401 */
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={s.flex} edges={['top']}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={T.primary}
          />
        }
      >
        <Text style={s.title}>Projects</Text>
        <Text style={s.subtitle}>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</Text>

        <TouchableOpacity
          testID="projects-new-cta"
          style={s.cta}
          onPress={() => router.push('/project/wizard' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color={T.bg} />
          <Text style={s.ctaText}>Start new project</Text>
        </TouchableOpacity>

        {projects.length === 0 && (
          <View style={s.empty} testID="projects-empty">
            <Text style={s.emptyTitle}>No projects yet</Text>
            <Text style={s.emptySub}>Tap "Start new project" — 4 questions, ready in 10 seconds.</Text>
          </View>
        )}

        {projects.map((p) => {
          const mods = modulesByProject[p.project_id] || [];
          const total = mods.length;
          const done = mods.filter(m => m.status === 'done' || m.status === 'completed').length;
          const inProgress = mods.filter(m => m.status === 'in_progress').length;
          const review = mods.filter(m => m.status === 'review').length;
          const paused = mods.filter(m => m.status === 'paused').length;
          const progress = p.progress ?? (total > 0 ? Math.round((done / total) * 100) : 0);
          const stage = STAGE_LABEL[p.current_stage || ''] || (p.status || '—');
          const mode = MODE_LABEL[p.production_mode || ''] || p.production_mode || '';

          return (
            <TouchableOpacity
              key={p.project_id}
              testID={`projects-card-${p.project_id}`}
              style={s.card}
              onPress={() => router.push(`/client/projects/${p.project_id}` as any)}
              activeOpacity={0.85}
            >
              <View style={s.cardHeader}>
                <Text style={s.cardTitle} numberOfLines={1}>{p.name || p.title || 'Untitled project'}</Text>
                <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
              </View>
              <Text style={s.cardMeta} numberOfLines={1}>
                {stage}{mode ? ` · ${mode}` : ''}
              </Text>

              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress}%` }]} />
              </View>
              <View style={s.statsRow}>
                <Text style={s.statsLabel}>{progress}% done</Text>
                <Text style={s.statsLabel}>{done}/{total} modules</Text>
              </View>

              {(inProgress + review + paused) > 0 && (
                <View style={s.chipsRow}>
                  {inProgress > 0 && <Chip color={T.info}    label={`${inProgress} in progress`} />}
                  {review > 0     && <Chip color="#f59e0b"   label={`${review} in review`} />}
                  {paused > 0     && <Chip color={T.danger}  label={`${paused} paused`} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <View style={[s.chip, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={[s.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: { padding: T.lg, paddingBottom: 100 },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.small, marginTop: 4 },

  cta: {
    marginTop: T.lg,
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: T.bg, fontSize: T.body, fontWeight: '800' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  emptySub: { color: T.textMuted, fontSize: T.small, marginTop: 8, textAlign: 'center', maxWidth: 280 },

  card: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: T.text, fontSize: T.h3, fontWeight: '700', flex: 1, marginRight: 8 },
  cardMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 4, letterSpacing: 0.3 },

  progressBg: { height: 6, backgroundColor: T.surface2, borderRadius: 3, overflow: 'hidden', marginTop: T.md },
  progressFill: { height: 6, backgroundColor: T.primary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  statsLabel: { color: T.textMuted, fontSize: T.small },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: T.sm },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: T.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
