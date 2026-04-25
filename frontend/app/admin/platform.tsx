import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import T from '../../src/theme';

type TierInfo = { name: string; price_usd_month: number | null; tagline: string; users_limit: number | null };

const FEATURE_HIGHLIGHTS: Record<string, string[]> = {
  core: [
    'Workspace · Contracts · Invoices',
    'Deliverables & Approvals',
    'Change Requests & Support',
    'Email notifications',
    'Up to 10 users',
  ],
  pro: [
    'Everything in Core',
    'Marketplace (bidding + invitations)',
    'Revenue Brain (opportunities + retainers)',
    'Operator Assist (suggestions + WHY)',
    'Integrations (up to 5 sources)',
    'Developer motivation layer',
    'Up to 50 users',
  ],
  enterprise: [
    'Everything in Pro',
    'Operator Auto (scheduler)',
    'Autonomous Scaling (4 engines)',
    'Client Segments (5-bucket)',
    'Multi-tenant · SSO · White-label',
    'Unlimited audit · External API',
    'Dedicated support + SLA',
  ],
  internal: [
    'All power, no restrictions',
    'Hidden ranking layer',
    'Raw finance controls',
    'Not available for purchase',
  ],
};

export default function AdminPlatformScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<string>('core');
  const [meta, setMeta] = useState<Record<string, TierInfo>>({});
  const [available, setAvailable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/platform/tier');
      setCurrent(res.data.current);
      setMeta(res.data.meta || {});
      setAvailable(res.data.available || []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const switchTier = async (tier: string) => {
    if (tier === current) return;
    setBusy(true);
    try {
      await api.post('/platform/tier', { tier });
      await load();
    } catch (e: any) {
      Alert.alert('Cannot switch', e.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <View style={[s.flex, { justifyContent: 'center' }]}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  // Visible cards (hide internal unless currently internal)
  const visibleTiers = available.filter(t => t !== 'internal' || current === 'internal');

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} testID="platform-back-btn">
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.h1}>Platform Tier</Text>
      <Text style={s.sub}>
        Current plan: <Text style={{ color: T.primary, fontWeight: '700' }}>{meta[current]?.name || current}</Text>
      </Text>

      {visibleTiers.map((tierKey) => {
        const m = meta[tierKey];
        if (!m) return null;
        const isCurrent = tierKey === current;
        const features = FEATURE_HIGHLIGHTS[tierKey] || [];
        return (
          <View key={tierKey} style={[s.card, isCurrent && s.cardActive]} testID={`platform-tier-card-${tierKey}`}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{m.name}</Text>
                <Text style={s.cardTagline}>{m.tagline}</Text>
              </View>
              {m.price_usd_month != null ? (
                <View style={s.priceBox}>
                  <Text style={s.priceNum}>${m.price_usd_month}</Text>
                  <Text style={s.priceSub}>/ month</Text>
                </View>
              ) : (
                <View style={s.priceBox}>
                  <Text style={s.priceNumInternal}>Custom</Text>
                </View>
              )}
            </View>

            {m.users_limit != null ? (
              <Text style={s.usersLimit}>Up to {m.users_limit} users</Text>
            ) : (
              <Text style={s.usersLimit}>Unlimited users</Text>
            )}

            <View style={s.features}>
              {features.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {isCurrent ? (
              <View style={s.currentBadge}>
                <Text style={s.currentBadgeText}>Current plan</Text>
              </View>
            ) : (
              <TouchableOpacity
                testID={`platform-switch-${tierKey}`}
                style={s.switchBtn}
                onPress={() => switchTier(tierKey)}
                disabled={busy}
              >
                <Text style={s.switchBtnText}>
                  {tierKey === 'internal' ? 'Switch to Internal' : `Upgrade to ${m.name}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <Text style={s.footer}>
        Downgrade via API is disabled. Contact support to change plans downward.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: { padding: T.lg, paddingTop: T.xl + T.md, paddingBottom: T.xl },
  header: { flexDirection: 'row', marginBottom: T.lg },
  back: { color: T.primary, fontSize: T.body, fontWeight: '600' },
  h1: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.xs },
  sub: { color: T.textMuted, fontSize: T.body, marginBottom: T.xl },

  card: { backgroundColor: T.surface1, borderRadius: T.radiusLg, padding: T.lg, marginBottom: T.md, borderWidth: 1, borderColor: T.border },
  cardActive: { borderColor: T.primary, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: T.sm },
  cardName: { color: T.text, fontSize: T.h2, fontWeight: '800' },
  cardTagline: { color: T.textMuted, fontSize: T.small, marginTop: 2 },

  priceBox: { alignItems: 'flex-end' },
  priceNum: { color: T.primary, fontSize: T.h2, fontWeight: '800' },
  priceSub: { color: T.textMuted, fontSize: T.tiny },
  priceNumInternal: { color: T.risk, fontSize: T.h3, fontWeight: '700' },

  usersLimit: { color: T.textMuted, fontSize: T.small, marginTop: T.sm, marginBottom: T.md },

  features: { marginBottom: T.md },
  featureRow: { flexDirection: 'row', marginBottom: T.xs, alignItems: 'flex-start' },
  featureCheck: { color: T.primary, fontWeight: '800', marginRight: T.sm, fontSize: T.body },
  featureText: { color: T.text, fontSize: T.small, flex: 1 },

  currentBadge: { backgroundColor: T.surface2, padding: T.md, borderRadius: T.radiusSm, alignItems: 'center' },
  currentBadgeText: { color: T.primary, fontWeight: '700', fontSize: T.small, letterSpacing: 1 },

  switchBtn: { backgroundColor: T.primary, padding: T.md, borderRadius: T.radiusSm, alignItems: 'center' },
  switchBtnText: { color: T.bg, fontWeight: '700', fontSize: T.body },

  footer: { color: T.textMuted, fontSize: T.tiny, textAlign: 'center', marginTop: T.lg, fontStyle: 'italic' },
});
