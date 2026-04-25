// Client → Project Screen (single shell, no double nav)
//
// Lives inside the client tab bar — when the user opens a project from any
// client surface, they stay in the client shell. The page is just one screen
// with five vertical blocks:
//
//   1. Hero          — live status, money delivered/remaining, modules counter
//   2. Progress      — building / review / done counters, micro-rhythm
//   3. Decisions     — deliverables in `pending_approval` (Approve / Reject)
//   4. Modules       — operational cards (status + price + actions)
//   5. Activity      — inline live feed, scoped to this project

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/api';
import T from '../../../src/theme';

type Module = {
  module_id: string;
  module_title: string;
  status: string;
  paused_by_system?: boolean;
  progress_pct: number;
  price: number;
  cost: number;
  earned: number;
  paid: number;
  cost_status: string;
  developer_name?: string;
};

type Workspace = {
  project: { project_id: string; project_title: string };
  summary: {
    revenue: number; cost: number; earned: number; paid: number; profit: number;
    active_modules: number; total_modules: number;
  };
  status: 'healthy' | 'watch' | 'at_risk' | 'blocked';
  status_label: string;
  explanation: string;
  modules: Module[];
};

type Deliverable = {
  deliverable_id: string;
  project_id: string;
  title: string;
  summary: string;
  status: string;
  price?: number;
  blocks?: any[];
  resources?: { type: string; label: string; url?: string }[];
  version?: string;
};

type Invoice = {
  invoice_id: string;
  module_id?: string;
  amount: number;
  status: string; // paid | pending_payment | draft
  title?: string;
  paid_at?: string;
};

type ActivityEvent = {
  at: string;
  module_title: string;
  project_title: string;
  project_id: string;
  verb: string;
  dot: 'green' | 'yellow' | 'blue';
};

const POLL_MS = 8000;

const STATUS_HERO: Record<Workspace['status'], { label: string; tone: string }> = {
  healthy: { label: 'BUILDING',     tone: '#22c55e' },
  watch:   { label: 'MONITORING',   tone: '#60a5fa' },
  at_risk: { label: 'AT RISK',      tone: '#f59e0b' },
  blocked: { label: 'BLOCKED',      tone: '#ef4444' },
};

const MODULE_TONE: Record<string, string> = {
  pending:     '#6b7280',
  in_progress: '#60a5fa',
  review:      '#f59e0b',
  done:        '#22c55e',
  completed:   '#22c55e',
  paused:      '#ef4444',
};

function fmt(n: number | undefined): string {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DOT_COLOR: Record<ActivityEvent['dot'], string> = {
  green:  '#22c55e',
  yellow: '#f59e0b',
  blue:   '#60a5fa',
};

export default function ClientProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [w, d, a, inv] = await Promise.all([
        api.get(`/client/project/${id}/workspace`),
        api.get(`/client/projects/${id}/deliverables`).catch(() => ({ data: [] as Deliverable[] })),
        api.get('/activity/live').catch(() => ({ data: { events: [] } })),
        api.get('/client/invoices').catch(() => ({ data: [] as Invoice[] })),
      ]);
      setWs(w.data);
      const dList: Deliverable[] = Array.isArray(d.data) ? d.data : (d.data?.deliverables || []);
      setDeliverables(dList);
      const allEv: ActivityEvent[] = a.data?.events || [];
      setEvents(allEv.filter(e => e.project_id === id).slice(0, 8));
      const invList: Invoice[] = Array.isArray(inv.data) ? inv.data : [];
      setInvoices(invList.filter(i => i.module_id));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const pendingDelivs = useMemo(
    () => deliverables.filter(d => d.status === 'pending_approval'),
    [deliverables],
  );

  const counters = useMemo(() => {
    if (!ws) return { in_progress: 0, review: 0, done: 0, total: 0 };
    const mods = ws.modules || [];
    return {
      in_progress: mods.filter(m => m.status === 'in_progress').length,
      review:      mods.filter(m => m.status === 'review').length,
      done:        mods.filter(m => m.status === 'done' || m.status === 'completed').length,
      total:       mods.length,
    };
  }, [ws]);

  const decide = async (d: Deliverable, action: 'approve' | 'reject') => {
    setActing(d.deliverable_id);
    try {
      await api.post(`/client/deliverables/${d.deliverable_id}/${action}`,
        action === 'reject' ? { reason: 'requesting changes' } : {});
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const payInvoice = async (inv: Invoice) => {
    setPaying(inv.invoice_id);
    try {
      await api.post(`/client/invoices/${inv.invoice_id}/pay`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  // Index invoices by module — there's at most one open invoice per module.
  // Newest first wins (covers re-issues).
  const invoiceByModule: Record<string, Invoice> = {};
  for (const inv of [...invoices].sort((a, b) => (b.invoice_id).localeCompare(a.invoice_id))) {
    if (inv.module_id && !invoiceByModule[inv.module_id]) invoiceByModule[inv.module_id] = inv;
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.flex, s.center]} edges={['top']}>
        <ActivityIndicator color={T.primary} />
      </SafeAreaView>
    );
  }
  if (!ws) {
    return (
      <SafeAreaView style={[s.flex, s.center]} edges={['top']}>
        <Text style={s.empty}>Project not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Back to Projects</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hero = STATUS_HERO[ws.status];
  const delivered = ws.summary.paid;
  const remaining = Math.max(0, ws.summary.revenue - ws.summary.paid);

  return (
    <SafeAreaView style={s.flex} edges={['top']}>
      {/* ─── Inline header (← Back · Title · spacer) ─── */}
      <View style={s.topBar}>
        <TouchableOpacity
          testID="project-back"
          onPress={() => router.back()}
          style={s.backIcon}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={T.text} />
          <Text style={s.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{ws.project.project_title}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.container}
        testID="client-project-screen"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={T.primary}
          />
        }
      >
        {/* ─── 1. HERO ─── */}
        <View style={s.hero}>
          <View style={s.heroBadge}>
            <View style={[s.pulseDot, { backgroundColor: hero.tone }]} />
            <Text style={[s.heroBadgeText, { color: hero.tone }]}>{hero.label}</Text>
          </View>
          <Text style={s.heroTitle} numberOfLines={2}>{ws.project.project_title}</Text>
          <Text style={s.heroSub} numberOfLines={2}>{ws.explanation}</Text>

          <View style={s.heroRow}>
            <View style={s.heroCell}>
              <Text style={s.heroVal}>${fmt(delivered)}</Text>
              <Text style={s.heroLab}>delivered</Text>
            </View>
            <View style={s.heroCell}>
              <Text style={s.heroVal}>${fmt(remaining)}</Text>
              <Text style={s.heroLab}>remaining</Text>
            </View>
            <View style={s.heroCell}>
              <Text style={s.heroVal}>{counters.total}</Text>
              <Text style={s.heroLab}>{counters.total === 1 ? 'module' : 'modules'}</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. PROGRESS ENGINE ─── */}
        <View style={s.progress}>
          <Text style={s.sectionLabel}>PROGRESS</Text>
          <View style={s.counterRow}>
            <Counter dot="#60a5fa" n={counters.in_progress} label="in progress" />
            <Counter dot="#f59e0b" n={counters.review}      label="in review" />
            <Counter dot="#22c55e" n={counters.done}        label="done" />
          </View>
        </View>

        {/* ─── 3. DECISION ENGINE ─── */}
        {pendingDelivs.length > 0 && (
          <View style={s.decision} testID="decision-block">
            <View style={s.decisionHeader}>
              <Ionicons name="flash" size={16} color="#f59e0b" />
              <Text style={s.decisionTitle}>Action required</Text>
              <View style={s.decisionPill}>
                <Text style={s.decisionPillText}>{pendingDelivs.length}</Text>
              </View>
            </View>
            {pendingDelivs.map(d => (
              <View key={d.deliverable_id} style={s.decisionCard} testID={`decision-${d.deliverable_id}`}>
                <Text style={s.decisionCardTitle}>{d.title}</Text>
                <Text style={s.decisionCardSummary} numberOfLines={3}>{d.summary}</Text>
                {d.price ? <Text style={s.decisionCardPrice}>${fmt(d.price)}</Text> : null}
                <View style={s.decisionActions}>
                  <TouchableOpacity
                    testID={`approve-${d.deliverable_id}`}
                    style={[s.btn, s.btnPrimary, acting === d.deliverable_id && { opacity: 0.6 }]}
                    onPress={() => decide(d, 'approve')}
                    disabled={acting === d.deliverable_id}
                  >
                    <Text style={s.btnPrimaryText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`reject-${d.deliverable_id}`}
                    style={[s.btn, s.btnGhost, acting === d.deliverable_id && { opacity: 0.6 }]}
                    onPress={() => decide(d, 'reject')}
                    disabled={acting === d.deliverable_id}
                  >
                    <Text style={s.btnGhostText}>Request changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── 4. MODULES ─── */}
        <Text style={s.sectionLabel}>MODULES · {counters.total}</Text>
        {(ws.modules || []).map((m) => {
          const tone = MODULE_TONE[m.status] || T.textMuted;
          const inv = invoiceByModule[m.module_id];
          const invIsPending = inv && (inv.status === 'pending_payment' || inv.status === 'failed');
          const invIsPaid = inv && inv.status === 'paid';
          const showApprove = m.status === 'review' && !inv;
          return (
            <View key={m.module_id} style={s.moduleCard} testID={`module-${m.module_id}`}>
              <View style={s.moduleHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.moduleTitle} numberOfLines={1}>{m.module_title}</Text>
                  <Text style={s.moduleMeta}>
                    {m.developer_name ? `${m.developer_name} · ` : ''}
                    {m.cost_status === 'over_budget' ? 'OVER BUDGET' :
                     m.cost_status === 'warning' ? 'NEAR LIMIT' : ''}
                  </Text>
                </View>
                <View style={[s.modulePill, { borderColor: tone + '66', backgroundColor: tone + '14' }]}>
                  <Text style={[s.modulePillText, { color: tone }]}>{m.status.replace('_', ' ')}</Text>
                </View>
              </View>

              <View style={s.modulePriceRow}>
                <Text style={s.modulePrice}>${fmt(m.price)}</Text>
                {invIsPaid ? (
                  <Text style={[s.moduleEarn, { color: '#22c55e', fontWeight: '700' }]}>
                    ✓ Paid {inv?.paid_at ? `· ${new Date(inv.paid_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : ''}
                  </Text>
                ) : invIsPending ? (
                  <Text style={[s.moduleEarn, { color: '#f59e0b', fontWeight: '700' }]}>Invoice: pending</Text>
                ) : (
                  <Text style={s.moduleEarn}>earned ${fmt(m.earned)}</Text>
                )}
              </View>

              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(100, m.progress_pct)}%`, backgroundColor: invIsPaid ? '#22c55e' : tone }]} />
              </View>

              {/* State-specific footer: review without invoice / pending invoice (Pay now) / paid (Done) */}
              {showApprove && (
                <View style={s.moduleHint}>
                  <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                  <Text style={s.moduleHintText}>Awaiting review — see Action required above</Text>
                </View>
              )}

              {invIsPending && (
                <TouchableOpacity
                  testID={`pay-${inv!.invoice_id}`}
                  style={[s.payBtn, paying === inv!.invoice_id && { opacity: 0.6 }]}
                  onPress={() => payInvoice(inv!)}
                  disabled={paying === inv!.invoice_id}
                  activeOpacity={0.85}
                >
                  <Ionicons name="card" size={16} color={T.bg} />
                  <Text style={s.payBtnText}>
                    {paying === inv!.invoice_id ? 'Processing…' : `Pay now · $${fmt(inv!.amount)}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ─── 5. INLINE ACTIVITY ─── */}
        <Text style={[s.sectionLabel, { marginTop: T.lg }]}>LIVE ACTIVITY</Text>
        {events.length === 0 ? (
          <Text style={s.empty}>Nothing happening yet — events will surface here in real time.</Text>
        ) : (
          events.map((e, i) => (
            <View key={`${e.at}-${i}`} style={s.evRow}>
              <View style={[s.evDot, { backgroundColor: DOT_COLOR[e.dot] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.evLine} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{e.module_title}</Text>
                  <Text style={{ color: T.textMuted }}> {e.verb}</Text>
                </Text>
                <Text style={s.evMeta}>{relTime(e.at)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Counter({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <View style={s.counterCell}>
      <View style={[s.cDot, { backgroundColor: dot }]} />
      <Text style={s.cVal}>{n}</Text>
      <Text style={s.cLab}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  empty: { color: T.textMuted, fontSize: T.small, textAlign: 'center', marginVertical: T.md },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: T.md, paddingVertical: T.sm,
    borderBottomWidth: 1, borderBottomColor: T.border,
    backgroundColor: T.surface1,
  },
  backIcon: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 60 },
  backLabel: { color: T.text, fontSize: T.small, fontWeight: '600' },
  topTitle: { color: T.text, fontSize: T.body, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  backBtn: { backgroundColor: T.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: T.radiusSm, marginTop: 12 },
  backBtnText: { color: T.bg, fontWeight: '700' },

  container: { padding: T.lg, paddingBottom: 100 },

  /* HERO */
  hero: {
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.md,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.surface2,
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: T.text, fontSize: T.h2, fontWeight: '800', marginTop: 12 },
  heroSub: { color: T.textMuted, fontSize: T.small, marginTop: 6 },
  heroRow: { flexDirection: 'row', gap: T.md, marginTop: T.lg },
  heroCell: { flex: 1 },
  heroVal: { color: T.text, fontSize: T.h3, fontWeight: '800' },
  heroLab: { color: T.textMuted, fontSize: T.tiny, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  /* PROGRESS */
  progress: {
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
  },
  sectionLabel: { color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  counterRow: { flexDirection: 'row', gap: T.md, marginTop: 4 },
  counterCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cDot: { width: 8, height: 8, borderRadius: 4 },
  cVal: { color: T.text, fontSize: T.h3, fontWeight: '800' },
  cLab: { color: T.textMuted, fontSize: T.tiny },

  /* DECISION ENGINE */
  decision: {
    backgroundColor: '#f59e0b14',
    borderWidth: 1, borderColor: '#f59e0b66',
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
  },
  decisionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: T.sm },
  decisionTitle: { color: T.text, fontSize: T.body, fontWeight: '800', flex: 1 },
  decisionPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, backgroundColor: '#f59e0b',
  },
  decisionPillText: { color: '#000', fontSize: 11, fontWeight: '800' },
  decisionCard: {
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginTop: 6,
  },
  decisionCardTitle: { color: T.text, fontSize: T.body, fontWeight: '700' },
  decisionCardSummary: { color: T.textMuted, fontSize: T.small, marginTop: 4 },
  decisionCardPrice: { color: T.primary, fontSize: T.body, fontWeight: '800', marginTop: 8 },
  decisionActions: { flexDirection: 'row', gap: T.sm, marginTop: T.md },
  btn: { flex: 1, paddingVertical: 10, borderRadius: T.radiusSm, alignItems: 'center' },
  btnPrimary: { backgroundColor: T.primary },
  btnPrimaryText: { color: T.bg, fontSize: T.body, fontWeight: '800' },
  btnGhost: { borderWidth: 1, borderColor: T.border, backgroundColor: T.surface2 },
  btnGhostText: { color: T.text, fontSize: T.body, fontWeight: '700' },

  /* MODULES */
  moduleCard: {
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
  },
  moduleHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  moduleTitle: { color: T.text, fontSize: T.body, fontWeight: '700' },
  moduleMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 4 },
  modulePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  modulePillText: { fontSize: T.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  modulePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: T.sm },
  modulePrice: { color: T.text, fontSize: T.h3, fontWeight: '800' },
  moduleEarn: { color: T.textMuted, fontSize: T.tiny },
  progressBg: { height: 4, backgroundColor: T.surface2, borderRadius: 2, overflow: 'hidden', marginTop: T.sm },
  progressFill: { height: 4 },
  moduleHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: T.sm },
  moduleHintText: { color: '#f59e0b', fontSize: T.tiny, fontWeight: '700' },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.primary,
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: T.radiusSm,
    marginTop: T.sm,
  },
  payBtnText: { color: T.bg, fontSize: T.body, fontWeight: '800' },

  /* ACTIVITY (inline) */
  evRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: T.surface1, borderWidth: 1, borderColor: T.border,
    borderRadius: T.radiusSm, padding: T.sm, marginBottom: 6,
  },
  evDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  evLine: { color: T.text, fontSize: T.small },
  evMeta: { color: T.textMuted, fontSize: 10, marginTop: 2 },
});
