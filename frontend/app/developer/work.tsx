// Block 10.0 canonical: consumes GET /api/dev/work (dev_work.py)
// Clean minimal contract — "what should I do right now?" only.
// No earnings breakdown, no marketplace, no per-module timestamps.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';

type Task = {
  task_id: string;
  module_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  order: number;
  share: number;
  estimated_hours: number;
  spent_hours?: number;
  last_review_feedback?: string;
};

// Minimal canonical module row from /api/dev/work
type ModuleRow = {
  module_id: string;
  module_title: string;
  project_id?: string;
  project_title?: string;
  status: string;
  paused_by_system?: boolean;
  progress_pct: number;
  budget: number;
  earned: number;
};

type DevWork = {
  developer: {
    developer_id: string;
    name: string;
    rank: string;                 // A | B | C | D — single letter
  };
  summary: {
    paid: number;
    earned: number;
    pending: number;
    active_count: number;
    qa_count: number;
    blocked_count: number;
    available_count: number;      // number only — marketplace is its own screen
  };
  headline: string;
  active: ModuleRow[];
  qa: ModuleRow[];
  blocked: ModuleRow[];
  generated_at: string;
};

export default function DeveloperWork() {
  const [ws, setWs] = useState<DevWork | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/dev/work');
      setWs(r.data);
      const first = r.data?.active?.[0]?.module_id;
      if (first && !selectedModule) {
        setSelectedModule(first);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedModule]);

  const loadTasks = useCallback(async (module_id: string) => {
    try {
      const r = await api.get(`/dev/tasks?module_id=${module_id}`);
      setTasks(r.data?.tasks || []);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedModule) loadTasks(selectedModule);
  }, [selectedModule, loadTasks]);

  const startTask = async (taskId: string) => {
    try {
      await api.post(`/dev/tasks/${taskId}/start`);
      await loadTasks(selectedModule!);
      await load();
    } catch (e: any) {
      Alert.alert('Cannot start', e?.response?.data?.detail || 'Failed');
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const r = await api.post(`/dev/tasks/${taskId}/complete`, { message: 'Done' });
      Alert.alert('Submitted for review', `Spent: ${r.data?.spent_hours ?? '—'}h`);
      await loadTasks(selectedModule!);
      await load();
    } catch (e: any) {
      Alert.alert('Cannot complete', e?.response?.data?.detail || 'Failed');
    }
  };

  if (loading) {
    return (
      <View style={[s.flex, s.center]}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }
  if (!ws) return null;

  const byStatus = (st: Task['status']) => tasks.filter((t) => t.status === st).sort((a, b) => a.order - b.order);

  return (
    <SafeAreaView style={s.flex} edges={['top']}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.primary} />}
      >
        <View style={s.screenHeader}>
          <Text style={s.screenTitle}>Workspace</Text>
          <View style={s.rankPill} testID="dev-rank">
            <Text style={s.rankText}>{ws.developer.rank}</Text>
          </View>
        </View>
        <Text style={s.headline} testID="dev-headline">{ws.headline}</Text>

        {/* Header stats — derived from summary */}
        <View style={s.statsRow}>
          <View style={s.statCard} testID="stat-active-modules">
            <Text style={s.statValue}>{ws.summary.active_count}</Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
          <View style={s.statCard} testID="stat-qa">
            <Text style={s.statValue}>{ws.summary.qa_count}</Text>
            <Text style={s.statLabel}>In QA</Text>
          </View>
          <View style={s.statCard} testID="stat-blocked">
            <Text style={[s.statValue, ws.summary.blocked_count > 0 && { color: '#ef4444' }]}>
              {ws.summary.blocked_count}
            </Text>
            <Text style={s.statLabel}>Blocked</Text>
          </View>
          <View style={s.statCard} testID="stat-earnings">
            <Text style={[s.statValue, { color: T.success }]}>${ws.summary.pending}</Text>
            <Text style={s.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Active modules */}
        {ws.active.length === 0 && ws.qa.length === 0 && ws.blocked.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="folder-open-outline" size={28} color={T.textMuted} />
            <Text style={s.emptyText}>No active modules.</Text>
            <Text style={s.emptySub}>Make a bid in the Market to get assigned.</Text>
          </View>
        )}

        {ws.active.length > 0 && (
          <>
            <Text style={s.sectionTitle}>🚀 Active · {ws.active.length}</Text>
            {ws.active.map((m) => (
              <ModuleCard
                key={m.module_id}
                m={m}
                selected={selectedModule === m.module_id}
                onPress={() => setSelectedModule(m.module_id)}
              />
            ))}
          </>
        )}

        {ws.qa.length > 0 && (
          <>
            <Text style={s.sectionTitle}>⏳ In QA · {ws.qa.length}</Text>
            {ws.qa.map((m) => (
              <ModuleCard key={m.module_id} m={m} selected={false} onPress={() => {}} tone="qa" />
            ))}
          </>
        )}

        {ws.blocked.length > 0 && (
          <>
            <Text style={s.sectionTitle}>⛔ Blocked · {ws.blocked.length}</Text>
            {ws.blocked.map((m) => (
              <ModuleCard key={m.module_id} m={m} selected={false} onPress={() => {}} tone="blocked" />
            ))}
          </>
        )}

        {/* Tasks Kanban for selected active module */}
        {selectedModule && tasks.length > 0 && (
          <View style={s.board} testID="tasks-kanban">
            <Text style={s.boardTitle}>Tasks</Text>
            {(['todo', 'in_progress', 'review', 'done'] as const).map((st) => {
              const colTasks = byStatus(st);
              if (colTasks.length === 0) return null;
              const currentBudget =
                ws.active.find((m) => m.module_id === selectedModule)?.budget || 0;
              return (
                <View key={st} style={s.column} testID={`column-${st}`}>
                  <View style={s.colHeader}>
                    <Text style={[s.colLabel, columnColor(st)]}>{columnLabel(st)}</Text>
                    <Text style={s.colCount}>{colTasks.length}</Text>
                  </View>
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.task_id}
                      task={t}
                      priceShare={Math.round(currentBudget * (t.share || 0))}
                      onStart={() => startTask(t.task_id)}
                      onComplete={() => completeTask(t.task_id)}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Earnings line — tiny, inline with summary. Full breakdown lives elsewhere. */}
        {(ws.summary.paid > 0 || ws.summary.earned > 0) && (
          <Text style={s.earningsLine} testID="earnings-line">
            Earned ${ws.summary.earned} · Paid ${ws.summary.paid}
          </Text>
        )}

        {/* Marketplace hint — count only. Browsing/claiming lives on /marketplace. */}
        {ws.summary.available_count > 0 && (
          <TouchableOpacity
            style={s.availHint}
            testID="available-hint"
            onPress={() => {/* deep link to marketplace lives in bottom nav */}}
            activeOpacity={0.7}
          >
            <Text style={s.availHintText}>
              🛒 {ws.summary.available_count} modules available on the marketplace
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModuleCard({
  m,
  selected,
  onPress,
  tone,
}: {
  m: ModuleRow;
  selected: boolean;
  onPress: () => void;
  tone?: 'qa' | 'blocked';
}) {
  const border =
    tone === 'blocked'
      ? { borderColor: '#ef4444' }
      : tone === 'qa'
      ? { borderColor: '#f59e0b' }
      : selected
      ? { borderColor: T.primary, backgroundColor: T.primary + '11' }
      : undefined;
  return (
    <TouchableOpacity
      testID={`module-row-${m.module_id}`}
      style={[s.moduleCard, border]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.moduleHeader}>
        <Text style={s.moduleTitle} numberOfLines={1}>{m.module_title}</Text>
        <Text style={s.modulePrice}>${m.budget}</Text>
      </View>
      {m.project_title ? (
        <Text style={s.moduleProject} numberOfLines={1}>{m.project_title}</Text>
      ) : null}
      <View style={s.progressRow}>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${m.progress_pct}%` }]} />
        </View>
        <Text style={s.progressText}>{m.progress_pct}%</Text>
      </View>
      <View style={s.moduleMeta}>
        <Text style={s.moduleMetaText}>{m.status.toUpperCase()}</Text>
        {m.paused_by_system && <Text style={[s.moduleMetaText, { color: '#ef4444' }]}>· SYSTEM PAUSED</Text>}
        <Text style={[s.moduleMetaText, { color: T.success, marginLeft: 'auto', fontWeight: '700' }]}>
          +${m.earned}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TaskCard({
  task,
  priceShare,
  onStart,
  onComplete,
}: {
  task: Task;
  priceShare: number;
  onStart: () => void;
  onComplete: () => void;
}) {
  return (
    <View style={s.taskCard} testID={`task-card-${task.task_id}`}>
      <View style={s.taskHeader}>
        <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
        <Text style={s.taskPrice}>${priceShare}</Text>
      </View>
      <Text style={s.taskDesc} numberOfLines={2}>{task.description}</Text>
      <View style={s.taskFooter}>
        <Text style={s.taskMeta}>
          {task.estimated_hours}h est.
          {typeof task.spent_hours === 'number' && task.spent_hours > 0 && ` · ${task.spent_hours}h spent`}
        </Text>
        {task.status === 'todo' && (
          <TouchableOpacity testID={`task-start-${task.task_id}`} style={s.startBtn} onPress={onStart}>
            <Text style={s.startBtnText}>Start</Text>
          </TouchableOpacity>
        )}
        {task.status === 'in_progress' && (
          <TouchableOpacity testID={`task-complete-${task.task_id}`} style={s.completeBtnSm} onPress={onComplete}>
            <Text style={s.completeBtnSmText}>Complete</Text>
          </TouchableOpacity>
        )}
        {task.status === 'review' && (
          <Text style={s.reviewTag}>⏳ In review</Text>
        )}
        {task.status === 'done' && (
          <Text style={s.doneTag}>✓ Done</Text>
        )}
      </View>
      {task.last_review_feedback && task.status === 'todo' && (
        <Text style={s.feedbackText}>↩ {task.last_review_feedback}</Text>
      )}
    </View>
  );
}

function columnLabel(st: string) {
  return { todo: 'TODO', in_progress: 'IN PROGRESS', review: 'REVIEW', done: 'DONE' }[st as any] || st;
}
function columnColor(st: string) {
  const c = { todo: '#64748b', in_progress: T.primary, review: '#f59e0b', done: T.success }[st as any] || '#64748b';
  return { color: c };
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: T.lg, paddingBottom: 100 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  screenTitle: { color: T.text, fontSize: T.h2 ?? 24, fontWeight: '800' },
  rankPill: { backgroundColor: T.primary, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 12 },
  rankText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  headline: { color: T.textMuted, fontSize: 12, marginBottom: T.lg, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: T.sm, marginBottom: T.lg },
  statCard: { flex: 1, backgroundColor: T.surface1, borderRadius: 10, padding: T.md, borderWidth: 1, borderColor: T.border },
  statValue: { color: T.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: T.textMuted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: T.text, fontSize: 14, fontWeight: '800', marginTop: T.md, marginBottom: T.sm },
  empty: { alignItems: 'center', padding: 24, marginTop: 20 },
  emptyText: { color: T.textMuted, marginTop: 8 },
  emptySub: { color: T.textMuted, fontSize: 11 },
  moduleCard: {
    backgroundColor: T.surface1, borderRadius: 12, padding: T.md, marginBottom: T.sm,
    borderWidth: 1, borderColor: T.border,
  },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  moduleTitle: { color: T.text, fontWeight: '700', fontSize: 14, flex: 1, marginRight: 8 },
  moduleProject: { color: T.textMuted, fontSize: 11, marginBottom: 8 },
  modulePrice: { color: T.primary, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: T.primary },
  progressText: { color: T.textMuted, fontSize: 11, fontWeight: '700', width: 40, textAlign: 'right' },
  moduleMeta: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  moduleMetaText: { color: T.textMuted, fontSize: 11 },
  board: { marginTop: T.lg },
  boardTitle: { color: T.text, fontSize: 16, fontWeight: '800', marginBottom: T.sm },
  column: { backgroundColor: T.surface1, borderRadius: 10, padding: 10, marginBottom: T.sm, borderWidth: 1, borderColor: T.border },
  colHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  colLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  colCount: { color: T.textMuted, fontSize: 11 },
  taskCard: { backgroundColor: T.bg, borderRadius: 8, padding: 10, marginTop: 6, borderWidth: 1, borderColor: T.border },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitle: { color: T.text, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  taskPrice: { color: T.success, fontSize: 12, fontWeight: '700' },
  taskDesc: { color: T.textMuted, fontSize: 11, marginTop: 4 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  taskMeta: { color: T.textMuted, fontSize: 10 },
  startBtn: { backgroundColor: T.primary, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  startBtnText: { color: '#000', fontWeight: '800', fontSize: 11 },
  completeBtnSm: { backgroundColor: T.success, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  completeBtnSmText: { color: '#000', fontWeight: '800', fontSize: 11 },
  reviewTag: { color: '#f59e0b', fontSize: 11, fontWeight: '700' },
  doneTag: { color: T.success, fontSize: 11, fontWeight: '700' },
  feedbackText: { color: '#f59e0b', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  activityBlock: { marginTop: T.lg, backgroundColor: T.surface1, borderRadius: 10, padding: T.md, borderWidth: 1, borderColor: T.border },
  earningsLine: { color: T.textMuted, fontSize: 12, marginTop: T.lg, textAlign: 'center' },
  availHint: { marginTop: T.md, backgroundColor: T.surface1, borderRadius: 8, padding: T.md, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  availHintText: { color: T.primary, fontSize: 12, fontWeight: '700' },
});
