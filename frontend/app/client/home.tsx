import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';
import RevenueTimeline from '../../src/revenue-timeline';
import ClientOpportunityFeed from '../../src/client-opportunity-feed';
import RetainerOffer from '../../src/retainer-offer';
import MagicClientPull from '../../src/magic-client-pull';
import { SystemActionsFeed } from '../../src/system-actions-feed';
import PendingLeadBanner from '../../src/pending-lead-banner';
import DecisionHub from '../../src/decision-hub';

// Pure label maps — no aggregation, no decisions.
// UI is a projection of backend.risk_state / backend.cost_status.
const RISK_TO_HEALTH: Record<string, string> = {
  healthy: 'on_track',
  watch: 'attention',
  at_risk: 'issue',
  blocked: 'issue',
};
const COST_TO_SEVERITY: Record<string, string> = {
  under_control: 'info',
  warning: 'high',
  over_budget: 'critical',
};

export default function ClientHome() {
  const [operator, setOperator] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [attention, setAttention] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // ARCHITECTURE.md: one page → N independent reads, no merging.
  const load = async () => {
    try {
      const [op, co, at] = await Promise.all([
        api.get('/client/operator'),
        api.get('/client/costs'),
        api.get('/client/attention').catch(() => ({ data: null })),
      ]);
      setOperator(op.data);
      setCosts(co.data);
      setAttention(at.data);
    } catch {
      // silent — auth errors bubble via interceptor
    }
  };
  useEffect(() => { load(); }, []);

  const healthIcon = (h: string) => h === 'on_track' ? 'checkmark-circle' : h === 'attention' ? 'alert-circle' : 'close-circle';
  const healthColor = (h: string) => h === 'on_track' ? T.success : h === 'attention' ? T.risk : T.danger;
  const severityColor = (s: string) => s === 'critical' ? T.danger : s === 'high' ? T.risk : T.info;

  // Straight projection — no .reduce / .filter hiding anything.
  // Each slot on the screen maps 1:1 to a backend field.
  const activeProjects = (operator?.projects || []).map((p: any) => ({
    project_id: p.project_id,
    title: p.project_title,
    health: RISK_TO_HEALTH[p.risk_state] || 'issue',
    headline: p.headline,
    modules_total: p.summary?.total_modules ?? 0,
    modules_active: p.summary?.active_count ?? 0,
    lock_approvals: p.lock_approvals,
  }));

  // Pending actions = backend-decided lock_approvals + over-budget modules.
  // No client-side logic: backend already tagged lock_reason / cost_status.
  const pendingActions: any[] = [];
  (operator?.projects || []).forEach((p: any) => {
    if (p.lock_approvals && p.lock_reason) {
      pendingActions.push({
        title: `${p.project_title}: ${p.lock_reason}`,
        type: 'approval_locked',
        severity: 'critical',
      });
    }
    (p.modules || []).forEach((m: any) => {
      if (m.cost_status === 'over_budget') {
        pendingActions.push({
          title: `${m.module_title} — over budget`,
          type: 'module_over_budget',
          severity: COST_TO_SEVERITY[m.cost_status] || 'high',
        });
      }
    });
  });

  // Financials: raw fields from /api/client/costs.summary — no math here.
  const fin = costs?.summary || {};

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={T.primary} />}>
      <View testID="client-dashboard" style={s.content}>
        <Text style={s.title}>Dashboard</Text>

        {/* Retention: "why open the app right now". Silent when total == 0. */}
        {attention && attention.total > 0 && (() => {
          const parts: string[] = [];
          if (attention.pending_approvals > 0) {
            parts.push(`${attention.pending_approvals} approval${attention.pending_approvals > 1 ? 's' : ''}`);
          }
          if (attention.pending_payments > 0) {
            parts.push(`${attention.pending_payments} payment${attention.pending_payments > 1 ? 's' : ''}`);
          }
          if (attention.blocked_modules > 0) {
            parts.push(`${attention.blocked_modules} blocked`);
          }
          const firstProject = (operator?.projects || [])[0];
          const goReview = () => {
            if (firstProject?.project_id) {
              router.push(`/client/projects/${firstProject.project_id}` as any);
            }
          };
          return (
            <TouchableOpacity
              testID="attention-block"
              style={s.attention}
              activeOpacity={0.85}
              onPress={goReview}
            >
              <View style={s.attentionIcon}>
                <Ionicons name="alert-circle" size={20} color={T.risk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.attentionTitle}>Your product needs attention</Text>
                <Text style={s.attentionSub}>{parts.join(' · ')} require your action</Text>
              </View>
              <View style={s.attentionCta}>
                <Text style={s.attentionCtaText}>Review now</Text>
                <Ionicons name="chevron-forward" size={14} color={T.bg} />
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Operator Trust — opposite of attention: "system has it, no action required". */}
        {attention && attention.total === 0 && (operator?.projects || []).length > 0 && (
          <View testID="operator-trust-block" style={s.trust}>
            <View style={s.trustIcon}>
              <Ionicons name="hardware-chip" size={20} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.trustTitle}>Your project is being actively managed</Text>
              <Text style={s.trustSub}>System is on it · no action required right now</Text>
            </View>
          </View>
        )}

        {/* Decision Hub — pending_approval across all projects, silent when empty */}
        <DecisionHub />

        {/* Lead re-capture banner: silent when no pending leads. */}
        <PendingLeadBanner />

        {/* MAGIC — pull client into decisions */}
        <MagicClientPull />
        <SystemActionsFeed />

        <TouchableOpacity testID="client-home-new-project-btn" style={s.newProjectCta} onPress={() => router.push('/project/wizard')}>
          <View style={s.newProjectContent}>
            <Text style={s.newProjectIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.newProjectTitle}>Start new project</Text>
              <Text style={s.newProjectSub}>4 questions · ready workspace in 10 seconds</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.bg} />
          </View>
        </TouchableOpacity>

        <RevenueTimeline />
        <ClientOpportunityFeed compact />
        <RetainerOffer />

        {pendingActions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Action Required ({pendingActions.length})</Text>
            {pendingActions.map((a: any, i: number) => (
              <View key={i} testID={`client-home-action-${i}`} style={[s.actionCard, { borderLeftColor: severityColor(a.severity) }]}>
                <Ionicons name={a.type === 'approval_locked' ? 'lock-closed' : a.type === 'module_over_budget' ? 'warning' : 'document-text'} size={20} color={severityColor(a.severity)} />
                <View style={s.actionInfo}>
                  <Text style={s.actionTitle}>{a.title}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Active Projects</Text>
          {activeProjects.map((p: any) => (
            <TouchableOpacity key={p.project_id} testID={`client-home-project-${p.project_id}`} style={s.projectCard} onPress={() => router.push(`/client/projects/${p.project_id}`)}>
              <View style={s.projectHeader}>
                <Text style={s.projectTitle}>{p.title}</Text>
                <Ionicons name={healthIcon(p.health) as any} size={18} color={healthColor(p.health)} />
              </View>
              <Text style={s.headline}>{p.headline}</Text>
              <Text style={s.progressText}>{p.modules_active} active · {p.modules_total} total</Text>
              <Text style={[s.healthLabel, { color: healthColor(p.health) }]}>{p.health.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
          {activeProjects.length === 0 && <Text style={s.empty}>No active projects</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Financial Snapshot</Text>
          <View style={s.financeRow}>
            <View style={s.financeCard} testID="client-home-paid"><Text style={s.financeVal}>${fin.paid_out ?? 0}</Text><Text style={s.financeLabel}>Paid</Text></View>
            <View style={s.financeCard} testID="client-home-earned"><Text style={s.financeVal}>${fin.earned ?? 0}</Text><Text style={s.financeLabel}>Earned</Text></View>
            <View style={s.financeCard} testID="client-home-profit"><Text style={[s.financeVal, (fin.profit ?? 0) < 0 && { color: T.danger }]}>${fin.profit ?? 0}</Text><Text style={s.financeLabel}>Profit</Text></View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },
  section: { marginBottom: T.lg },
  sectionTitle: { color: T.textMuted, fontSize: T.small, textTransform: 'uppercase', letterSpacing: 2, marginBottom: T.sm },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border, gap: T.md },
  actionInfo: { flex: 1 },
  actionTitle: { color: T.text, fontSize: T.body, fontWeight: '600' },
  projectCard: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.md, borderWidth: 1, borderColor: T.border },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectTitle: { color: T.text, fontSize: T.h3, fontWeight: '700', flex: 1 },
  headline: { color: T.textMuted, fontSize: T.small, marginTop: 4 },
  progressText: { color: T.textMuted, fontSize: T.small, marginTop: 4 },
  healthLabel: { fontSize: T.tiny, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  financeRow: { flexDirection: 'row', gap: T.sm },
  financeCard: { flex: 1, backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  financeVal: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  financeLabel: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  empty: { color: T.textMuted, textAlign: 'center', padding: T.lg },
  newProjectCta: { backgroundColor: T.primary, borderRadius: T.radius, padding: T.md, marginBottom: T.lg },

  /* RETENTION ENGINE — "needs attention" block (top of Home) */
  attention: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.risk + '14',
    borderWidth: 1, borderColor: T.risk + '4D',
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.lg,
  },
  attentionIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: T.risk + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  attentionTitle: { color: T.text, fontSize: T.body, fontWeight: '800' },
  attentionSub: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  attentionCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.risk,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: T.radiusSm,
  },
  attentionCtaText: { color: T.bg, fontSize: T.small, fontWeight: '800' },

  /* OPERATOR LAYER — trust banner (silent unless attention.total === 0) */
  trust: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.primary + '33',
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.lg,
  },
  trustIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: T.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  trustTitle: { color: T.text, fontSize: T.body, fontWeight: '800' },
  trustSub: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  newProjectContent: { flexDirection: 'row', alignItems: 'center', gap: T.md },
  newProjectIcon: { fontSize: 28 },
  newProjectTitle: { color: T.bg, fontSize: T.body + 1, fontWeight: '800' },
  newProjectSub: { color: T.bg, fontSize: T.tiny, opacity: 0.7, marginTop: 2 },
});
