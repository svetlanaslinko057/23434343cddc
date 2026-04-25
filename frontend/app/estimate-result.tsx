import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../src/api';
import { useAuth } from '../src/auth';
import {
  FadeSlideIn,
  PressScale,
  PulseDot,
  PrimaryButton,
} from '../src/ui';
import { motion } from '../src/motion';
import T from '../src/theme';

/**
 * Estimate Result — post-estimate, pre-commit screen.
 *
 * NEW FLOW (visitor → lead):
 *   Visitor describes product → estimate computed → lands here.
 *   1. Sees the plan (price + modules + confidence).
 *   2. Clicks "Save my plan" → one-field email capture.
 *   3. POST /api/leads/intake → lead saved → stored in AsyncStorage.
 *   4. Redirected to /lead/workspace?id=<lead_id>.
 *
 * NO account is created here. NO password asked. NO cabinet dropped on the user.
 * Account creation is a later, conscious step from the lead workspace.
 *
 * Authed user flow (isRealUser === true): we still skip the lead bridge and
 * go straight to project creation — they already have a cabinet.
 */

type EstimateData = {
  clarity: 'good' | 'low';
  estimate: {
    base: number;
    multiplier: number;
    final_price: number;
    timeline: string;
    complexity: 'simple' | 'medium' | 'complex';
    quality_band: string;
    estimated_hours?: number | null;
  };
  modules_preview: string[];
  modules_detailed?: { title: string; description?: string; hours?: number }[];
  tech_stack?: string[];
  mode: 'ai' | 'hybrid' | 'dev';
  confidence: number;
  ai_generated?: boolean;
  matched_template?: { name: string; similarity: number } | null;
  generated_at: string;
};

const MODE_LABEL: Record<string, string> = {
  ai: 'AI Build',
  hybrid: 'AI + Engineering',
  dev: 'Full Engineering',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'idle' | 'email' | 'saving';

export default function EstimateResult() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string; goal: string; mode: string }>();
  const { user } = useAuth();

  const data: EstimateData | null = useMemo(() => {
    try {
      return params.data ? JSON.parse(params.data as string) : null;
    } catch {
      return null;
    }
  }, [params.data]);

  const goal = (params.goal as string) || '';
  const mode = (params.mode as string) || 'hybrid';

  const [step, setStep] = useState<Step>('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const isRealUser = !!user?.email && !user.email.startsWith('demo_');

  if (!data || !data.estimate) {
    return (
      <View style={s.errorWrap}>
        <Text style={s.errorText}>Estimate expired.</Text>
        <PressScale style={s.backBtn} onPress={() => router.replace('/' as any)}>
          <Text style={s.backBtnText}>Start a new plan</Text>
        </PressScale>
      </View>
    );
  }

  const confidencePct = Math.round(data.confidence * 100);
  const moduleCount = data.modules_preview.length;

  /**
   * For an authed user we skip the lead bridge completely — they already
   * have a cabinet, so we just create the project right away.
   */
  const createProjectDirect = async () => {
    setStep('saving');
    try {
      const title = goal.trim().slice(0, 80) || 'New product';
      const r = await api.post('/projects', { title, goal: goal.trim() || null, mode });
      router.replace(`/project-booting?id=${r.data.project_id}` as any);
    } catch (e: any) {
      Alert.alert('Could not start', e?.response?.data?.detail || String(e));
      setStep('idle');
    }
  };

  /**
   * Visitor path — save the estimate as a lead and send the user to the
   * lead workspace. NOT a full account. NOT the client cabinet.
   */
  const saveAsLead = async () => {
    const emailClean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(emailClean)) {
      setError('Enter a valid email, e.g. you@company.com');
      return;
    }
    setError('');
    setStep('saving');
    try {
      const r = await api.post('/leads/intake', {
        email: emailClean,
        goal: goal.trim(),
        mode,
        estimate: data,
      });
      // Remember the lead so we can auto-claim after sign-in.
      await AsyncStorage.setItem('atlas_pending_lead_id', r.data.lead_id);
      router.replace({
        pathname: '/lead/workspace',
        params: { id: r.data.lead_id },
      } as any);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save your plan. Try again.');
      setStep('idle');
    }
  };

  const onContinue = () => {
    if (isRealUser) {
      createProjectDirect();
    } else {
      setStep('email');
    }
  };

  // ============ SAVING interstitial ============
  if (step === 'saving') {
    return (
      <View style={s.creatingWrap} testID="estimate-saving">
        <PulseDot size={10} />
        <Text style={s.creatingTitle}>Saving your product plan…</Text>
        <Text style={s.creatingSub}>{moduleCount} parts · plan will be waiting for you</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        testID="estimate-result-screen"
        keyboardShouldPersistTaps="handled"
      >
        {/* READY strip */}
        <FadeSlideIn>
          <View style={s.readyRow}>
            <PulseDot size={7} />
            <Text style={s.readyText}>Ready to build</Text>
          </View>
          <Text style={s.overline}>YOUR PRODUCT ESTIMATE</Text>
        </FadeSlideIn>

        {/* PRICE HERO */}
        <FadeSlideIn delay={motion.staggerStep}>
          <View style={s.priceCard}>
            <Text style={s.priceValue} testID="estimate-price">
              ${data.estimate.final_price.toLocaleString()}
            </Text>
            <Text style={s.priceMeta}>
              {MODE_LABEL[data.mode] || 'AI + Engineering'} · {data.estimate.timeline}
            </Text>
          </View>
        </FadeSlideIn>

        {/* MODULES */}
        <FadeSlideIn delay={motion.staggerStep * 2}>
          <Text style={s.moduleIntro}>
            Your product will be built in {moduleCount} parts
          </Text>
        </FadeSlideIn>
        <View style={{ gap: 6, marginTop: T.sm }}>
          {data.modules_preview.map((m, i) => (
            <FadeSlideIn key={m} delay={motion.staggerStep * (3 + i)}>
              <View style={s.moduleRow} testID={`estimate-module-${i}`}>
                <PulseDot size={6} />
                <Text style={s.moduleText}>{m}</Text>
              </View>
            </FadeSlideIn>
          ))}
        </View>

        {/* CONFIDENCE META */}
        <FadeSlideIn delay={motion.staggerStep * (3 + moduleCount + 1)}>
          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Complexity</Text>
              <Text style={s.metaValue}>{data.estimate.complexity}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Quality</Text>
              <Text style={s.metaValue}>{data.estimate.quality_band}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Confidence</Text>
              <Text style={s.metaValue}>{confidencePct}%</Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* ============ STEP: email-only lead capture ============ */}
        {step === 'email' && (
          <FadeSlideIn>
            <View style={s.captureCard} testID="capture-step-email">
              <Text style={s.captureTitle}>Save this plan to your email</Text>
              <Text style={s.captureSub}>
                We'll send you a link to come back — no account, no password, no payment.
              </Text>
              <TextInput
                testID="capture-email"
                style={[s.input, error ? s.inputErr : null]}
                placeholder="you@company.com"
                placeholderTextColor={T.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
                value={email}
                onChangeText={(v) => { setEmail(v); if (error) setError(''); }}
                onSubmitEditing={saveAsLead}
                returnKeyType="go"
              />
              {error ? <Text style={s.fieldErr}>{error}</Text> : null}
              <PrimaryButton
                testID="capture-email-save"
                title="Save my plan"
                onPress={saveAsLead}
              />
              <Text style={s.noPaymentHint}>No payment · No password · Takes 3 seconds</Text>
              <TouchableOpacity
                testID="capture-email-back"
                style={s.tinyBtn}
                onPress={() => { setStep('idle'); setError(''); }}
              >
                <Text style={s.tinyBtnText}>← Back to plan</Text>
              </TouchableOpacity>
            </View>
          </FadeSlideIn>
        )}

        {/* ============ IDLE — primary CTA ============ */}
        {step === 'idle' && (
          <FadeSlideIn delay={motion.staggerStep * (4 + moduleCount + 1)}>
            <View style={{ marginTop: T.xl }}>
              <PrimaryButton
                testID="estimate-continue-btn"
                title={isRealUser ? 'Start building this product →' : 'Save my plan →'}
                onPress={onContinue}
              />
              <Text style={s.postCtaHint}>
                {isRealUser
                  ? 'We\'ll start building immediately.'
                  : 'Your product plan will be saved — sign in later to unlock the workspace.'}
              </Text>
              <PressScale
                style={s.secondaryBtn}
                onPress={() => router.back()}
                testID="estimate-refine-btn"
              >
                <Text style={s.secondaryText}>← Refine description</Text>
              </PressScale>
            </View>
          </FadeSlideIn>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.lg, paddingTop: T.xl, paddingBottom: T.xl * 2 },

  readyRow: { flexDirection: 'row', alignItems: 'center', gap: T.sm, marginBottom: 6 },
  readyText: { color: T.primary, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  overline: {
    color: T.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.6, marginTop: T.sm, marginBottom: T.md,
  },

  priceCard: {
    backgroundColor: T.surface1,
    borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: T.border,
  },
  priceValue: { color: T.text, fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  priceMeta: { color: T.textSecondary, fontSize: 14, marginTop: 6 },

  moduleIntro: { color: T.textSecondary, fontSize: 13, marginTop: T.xl },
  moduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: T.sm,
    paddingVertical: 10, paddingHorizontal: T.md,
    backgroundColor: T.surface1,
    borderRadius: 10, borderWidth: 1, borderColor: T.border,
  },
  moduleText: { color: T.text, fontSize: 15, flex: 1 },

  metaRow: {
    marginTop: T.xl,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: T.md,
    borderTopWidth: 1, borderTopColor: T.border,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, height: 28, backgroundColor: T.border },
  metaLabel: {
    color: T.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  metaValue: {
    color: T.text, fontSize: 14, fontWeight: '600',
    marginTop: 4, textTransform: 'capitalize',
  },

  captureCard: {
    marginTop: T.xl,
    backgroundColor: T.surface1,
    borderRadius: T.radius, padding: T.lg,
    borderWidth: 1, borderColor: T.border,
  },
  captureTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  captureSub: { color: T.textSecondary, fontSize: 13, marginTop: 4, marginBottom: T.md, lineHeight: 18 },
  input: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 10, padding: 14, color: T.text, fontSize: 15,
    marginBottom: T.sm,
  },
  inputErr: { borderColor: T.danger },
  fieldErr: { color: T.danger, fontSize: T.tiny, marginTop: -T.xs, marginBottom: T.sm, marginLeft: 4 },

  postCtaHint: {
    color: T.textSecondary, fontSize: 13,
    marginTop: T.sm, textAlign: 'center', lineHeight: 18,
  },
  noPaymentHint: { color: T.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  secondaryBtn: { marginTop: T.md, alignItems: 'center', paddingVertical: T.sm },
  secondaryText: { color: T.textSecondary, fontSize: 14 },
  tinyBtn: { marginTop: T.sm, alignItems: 'center', paddingVertical: T.xs },
  tinyBtnText: { color: T.textMuted, fontSize: 13 },

  creatingWrap: {
    flex: 1, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center', gap: T.md,
  },
  creatingTitle: { color: T.text, fontSize: 18, fontWeight: '600' },
  creatingSub: { color: T.textSecondary, fontSize: 13 },

  errorWrap: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: T.lg },
  errorText: { color: T.textMuted, fontSize: 15, marginBottom: T.md },
  backBtn: {
    borderWidth: 1, borderColor: T.primary,
    borderRadius: T.radiusSm,
    paddingHorizontal: T.lg, paddingVertical: T.sm,
  },
  backBtnText: { color: T.primary, fontWeight: '700' },
});
