import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { track } from '../../src/metrics';
import T from '../../src/theme';

type ProjectType = 'landing' | 'web_app' | 'mobile_app' | 'custom';
type Level = 'mvp' | 'production';
type Budget = 'small' | 'medium' | 'large';
type Urgency = 'asap' | 'standard' | 'flexible';

const TYPES: { id: ProjectType; title: string; sub: string; icon: string }[] = [
  { id: 'landing',    title: 'Landing Page', sub: 'One-page site · 3–6 days',  icon: '🚀' },
  { id: 'web_app',    title: 'Web App',      sub: 'Dashboard · Users · Payments', icon: '💻' },
  { id: 'mobile_app', title: 'Mobile App',   sub: 'iOS + Android · Native',    icon: '📱' },
  { id: 'custom',     title: 'Custom',       sub: 'Tailored scope',            icon: '⚙️' },
];

const BUDGETS: { id: Budget; title: string; sub: string }[] = [
  { id: 'small',  title: '$500 – $1k',  sub: 'MVP · essentials' },
  { id: 'medium', title: '$1k – $5k',   sub: 'Standard build' },
  { id: 'large',  title: '$5k+',        sub: 'Premium · priority' },
];

const URGENCIES: { id: Urgency; title: string; sub: string }[] = [
  { id: 'asap',     title: 'ASAP',        sub: '~7 days · +30% rush' },
  { id: 'standard', title: '1–3 weeks',   sub: 'Standard pace' },
  { id: 'flexible', title: 'Flexible',    sub: '–10% · up to 45 days' },
];

const LEVELS: { id: Level; title: string; sub: string }[] = [
  { id: 'mvp',        title: 'MVP',        sub: 'Prove the idea fast' },
  { id: 'production', title: 'Production', sub: 'Scale-ready quality' },
];

export default function WizardScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [ptype, setPtype] = useState<ProjectType | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<any>(null);

  const pickType = (id: ProjectType) => {
    setPtype(id);
    void track('wizard_started', { type: id });
    setStep(2);
  };

  const canContinue2 = budget && urgency && level;

  const generate = async () => {
    if (!ptype || !budget || !urgency || !level) return;
    setError(''); setBusy(true); setStep(3);
    try {
      // preview first (so we can show summary + price)
      const prev = await api.post('/projects/wizard/preview', {
        project_type: ptype, level, budget, urgency,
      });
      setSummary(prev.data);
      // tiny delay for "magic" feel
      await new Promise((r) => setTimeout(r, 900));
      // actually create
      const res = await api.post('/projects/wizard', {
        project_type: ptype, level, budget, urgency,
      });
      setSummary({ ...prev.data, ...res.data });
      void track('wizard_completed', {
        type: ptype, level, budget, urgency,
        total: res.data.estimated_total, modules_count: res.data.modules_count,
      });
      setStep(4);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to generate project');
      setStep(2);
    } finally { setBusy(false); }
  };

  const openWorkspace = () => {
    if (summary?.project?.project_id) {
      router.replace(`/workspace/${summary.project.project_id}`);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} testID="wizard-back-btn">
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.stepIndicator}>Step {step}/4</Text>
        </View>

        {/* STEP 1 — pick type */}
        {step === 1 && (
          <View>
            <Text style={s.h1}>What are you building?</Text>
            <Text style={s.sub}>Pick one. We'll do the rest.</Text>
            <View style={s.grid}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  testID={`wizard-type-${t.id}`}
                  style={s.typeCard}
                  onPress={() => pickType(t.id)}
                >
                  <Text style={s.typeIcon}>{t.icon}</Text>
                  <Text style={s.typeTitle}>{t.title}</Text>
                  <Text style={s.typeSub}>{t.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 2 — 3 quick questions */}
        {step === 2 && (
          <View>
            <Text style={s.h1}>Tell us the basics</Text>
            <Text style={s.sub}>5 seconds. No forms.</Text>

            <Text style={s.sectionLabel}>Budget</Text>
            <View style={s.pillRow}>
              {BUDGETS.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  testID={`wizard-budget-${b.id}`}
                  style={[s.pill, budget === b.id && s.pillActive]}
                  onPress={() => setBudget(b.id)}
                >
                  <Text style={[s.pillTitle, budget === b.id && s.pillTitleActive]}>{b.title}</Text>
                  <Text style={[s.pillSub, budget === b.id && s.pillSubActive]}>{b.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>Urgency</Text>
            <View style={s.pillRow}>
              {URGENCIES.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  testID={`wizard-urgency-${u.id}`}
                  style={[s.pill, urgency === u.id && s.pillActive]}
                  onPress={() => setUrgency(u.id)}
                >
                  <Text style={[s.pillTitle, urgency === u.id && s.pillTitleActive]}>{u.title}</Text>
                  <Text style={[s.pillSub, urgency === u.id && s.pillSubActive]}>{u.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>Level</Text>
            <View style={s.pillRow}>
              {LEVELS.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  testID={`wizard-level-${l.id}`}
                  style={[s.pill, level === l.id && s.pillActive]}
                  onPress={() => setLevel(l.id)}
                >
                  <Text style={[s.pillTitle, level === l.id && s.pillTitleActive]}>{l.title}</Text>
                  <Text style={[s.pillSub, level === l.id && s.pillSubActive]}>{l.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              testID="wizard-generate-btn"
              style={[s.ctaBtn, !canContinue2 && s.ctaBtnDisabled]}
              onPress={generate}
              disabled={!canContinue2 || busy}
            >
              <Text style={s.ctaBtnText}>⚡ Generate my project</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3 — magic (loading) */}
        {step === 3 && (
          <View style={s.magicWrap}>
            <ActivityIndicator size="large" color={T.primary} />
            <Text style={s.magicText}>⚡ Generating your project…</Text>
            <Text style={s.magicSub}>Building modules · Setting up contract · Calculating price</Text>
          </View>
        )}

        {/* STEP 4 — result */}
        {step === 4 && summary && (
          <View>
            <Text style={s.successIcon}>✓</Text>
            <Text style={s.h1}>{summary.title || summary.project?.title}</Text>
            <Text style={s.sub}>
              {summary.modules_count} modules · {summary.estimated_days} days · ready to start
            </Text>

            <View style={s.resultCard}>
              <Text style={s.resultLabel}>Estimated total</Text>
              <Text style={s.resultTotal}>${Number(summary.estimated_total).toLocaleString()}</Text>
            </View>

            <View style={s.modulesList}>
              <Text style={s.sectionLabel}>What you'll get</Text>
              {(summary.modules || []).map((m: any, i: number) => (
                <View key={i} style={s.modRow} testID={`wizard-result-module-${i}`}>
                  <View style={s.modDot} />
                  <View style={s.modContent}>
                    <Text style={s.modTitle}>{m.title}</Text>
                    <Text style={s.modDesc}>{m.description}</Text>
                  </View>
                  <Text style={s.modPrice}>${m.price}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              testID="wizard-open-workspace-btn"
              style={s.ctaBtn}
              onPress={openWorkspace}
            >
              <Text style={s.ctaBtnText}>
                🔥 Start development — ${Number(summary.estimated_total).toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: { padding: T.lg, paddingTop: T.xl + T.md, paddingBottom: T.xl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.xl },
  back: { color: T.primary, fontSize: T.body, fontWeight: '600' },
  stepIndicator: { color: T.textMuted, fontSize: T.small },

  h1: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.xs },
  sub: { color: T.textMuted, fontSize: T.body, marginBottom: T.xl },
  sectionLabel: { color: T.textMuted, fontSize: T.small, fontWeight: '600', marginBottom: T.sm, marginTop: T.lg, textTransform: 'uppercase', letterSpacing: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: T.md },
  typeCard: { width: '48%', backgroundColor: T.surface1, borderRadius: T.radiusLg, padding: T.lg, borderWidth: 1, borderColor: T.border, minHeight: 140, justifyContent: 'center' },
  typeIcon: { fontSize: 32, marginBottom: T.sm },
  typeTitle: { color: T.text, fontSize: T.h3, fontWeight: '700', marginBottom: T.xs },
  typeSub: { color: T.textMuted, fontSize: T.small },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.sm },
  pill: { flex: 1, minWidth: '30%', backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, borderWidth: 1, borderColor: T.border },
  pillActive: { backgroundColor: T.primary, borderColor: T.primary },
  pillTitle: { color: T.text, fontWeight: '700', fontSize: T.body, marginBottom: 2 },
  pillTitleActive: { color: T.bg },
  pillSub: { color: T.textMuted, fontSize: T.tiny },
  pillSubActive: { color: T.bg, opacity: 0.7 },

  ctaBtn: { backgroundColor: T.primary, borderRadius: T.radius, padding: 18, alignItems: 'center', marginTop: T.xl },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText: { color: T.bg, fontSize: T.body + 1, fontWeight: '800' },

  error: { color: T.danger, fontSize: T.small, textAlign: 'center', marginTop: T.md },

  magicWrap: { alignItems: 'center', paddingVertical: T.xl * 3 },
  magicText: { color: T.text, fontSize: T.h2, fontWeight: '700', marginTop: T.lg },
  magicSub: { color: T.textMuted, fontSize: T.small, marginTop: T.sm, textAlign: 'center' },

  successIcon: { fontSize: 48, color: T.primary, textAlign: 'center', marginBottom: T.md },
  resultCard: { backgroundColor: T.surface1, borderRadius: T.radiusLg, padding: T.lg, marginTop: T.lg, borderWidth: 1, borderColor: T.primary, alignItems: 'center' },
  resultLabel: { color: T.textMuted, fontSize: T.small, marginBottom: T.xs, textTransform: 'uppercase', letterSpacing: 1 },
  resultTotal: { color: T.primary, fontSize: 36, fontWeight: '800' },

  modulesList: { marginTop: T.lg },
  modRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderWidth: 1, borderColor: T.border },
  modDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.primary, marginRight: T.md },
  modContent: { flex: 1 },
  modTitle: { color: T.text, fontSize: T.body, fontWeight: '600' },
  modDesc: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  modPrice: { color: T.primary, fontSize: T.body, fontWeight: '700' },
});
