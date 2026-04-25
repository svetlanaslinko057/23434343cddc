import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';

export default function AdminFinance() {
  const [earnings, setEarnings] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [profit, setProfit] = useState<any>(null);
  const [tab, setTab] = useState<'profit' | 'earnings' | 'market'>('profit');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [eRes, mRes, pRes] = await Promise.all([api.get('/admin/earnings/overview'), api.get('/admin/market-health'), api.get('/admin/finance/control')]);
      setEarnings(eRes.data);
      setMarket(mRes.data);
      setProfit(pRes.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const marginColor = (pct: number) => pct >= 40 ? T.success : pct >= 20 ? T.risk : T.danger;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={T.primary} />}>
      <View testID="admin-finance" style={s.content}>
        <Text style={s.title}>Finance</Text>

        <View style={s.tabRow}>
          {(['profit', 'earnings', 'market'] as const).map(t => (
            <TouchableOpacity key={t} testID={`tab-${t}`} style={[s.tabBtn, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'profit' ? 'Profit' : t === 'earnings' ? 'Earnings' : 'Market'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PROFIT CONTROL */}
        {tab === 'profit' && profit && (
          <View>
            <View testID="profit-overview" style={[s.profitBanner, { borderColor: marginColor(profit.profit_pct) + '44' }]}>
              <Text style={s.profitLabel}>PLATFORM PROFIT</Text>
              <View style={s.profitRow}>
                <View style={s.profitItem}><Text style={[s.profitBig, { color: T.text }]}>${profit.total_revenue.toLocaleString()}</Text><Text style={s.profitSub}>Revenue</Text></View>
                <View style={s.profitItem}><Text style={[s.profitBig, { color: T.textMuted }]}>${profit.total_cost.toLocaleString()}</Text><Text style={s.profitSub}>Cost</Text></View>
                <View style={s.profitItem}><Text style={[s.profitBig, { color: marginColor(profit.profit_pct) }]}>${profit.total_profit.toLocaleString()}</Text><Text style={s.profitSub}>Profit ({profit.profit_pct}%)</Text></View>
              </View>
              <View style={s.cashRow}>
                <View style={s.cashItem}><Text style={[s.cashVal, { color: T.success }]}>${profit.total_paid}</Text><Text style={s.cashLabel}>Paid</Text></View>
                <View style={s.cashItem}><Text style={[s.cashVal, { color: T.risk }]}>${profit.total_pending}</Text><Text style={s.cashLabel}>Pending</Text></View>
                <View style={s.cashItem}><Text style={[s.cashVal, { color: T.danger }]}>${profit.total_overdue}</Text><Text style={s.cashLabel}>Overdue</Text></View>
              </View>
            </View>

            {/* Top Profit Modules */}
            <Text style={s.sLabel}>TOP PROFIT MODULES</Text>
            {profit.top_profit_modules.map((m: any, i: number) => (
              <View key={i} style={[s.profitModCard, { borderLeftColor: marginColor(m.margin_pct) }]}>
                <Text style={s.profitModTitle}>{m.title}</Text>
                <View style={s.profitModRow}>
                  <Text style={[s.profitModMargin, { color: marginColor(m.margin_pct) }]}>+${m.margin}</Text>
                  <Text style={[s.profitModPct, { color: marginColor(m.margin_pct) }]}>{m.margin_pct}%</Text>
                </View>
              </View>
            ))}

            {/* Leaks */}
            {profit.leaks.length > 0 && (
              <View style={s.leakSection}>
                <Text style={s.sLabel}>PROFIT LEAKS</Text>
                <View style={s.leakBanner}>
                  <Ionicons name="warning" size={18} color={T.danger} />
                  <Text style={s.leakTotal}>~${profit.total_leak} estimated loss</Text>
                </View>
                {profit.leaks.map((l: any, i: number) => (
                  <View key={i} style={s.leakCard}>
                    <Ionicons name={l.type === 'payment_delays' ? 'time' : l.type === 'underpriced_modules' ? 'trending-down' : 'alert-circle'} size={16} color={T.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.leakMsg}>{l.message}</Text>
                      <Text style={s.leakLoss}>~${l.estimated_loss} loss</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Low Margin Projects */}
            {profit.low_margin_projects.length > 0 && (
              <View>
                <Text style={s.sLabel}>LOW MARGIN PROJECTS</Text>
                {profit.low_margin_projects.map((p: any) => (
                  <View key={p.project_id} style={[s.lowMarginCard, { borderLeftColor: T.danger }]}>
                    <Text style={s.lowMarginTitle}>{p.title}</Text>
                    <Text style={s.lowMarginPct}>{p.margin_pct}% margin</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* EARNINGS */}
        {tab === 'earnings' && earnings && (
          <View style={s.grid}>
            {[{ label: 'Approved', key: 'approved', color: T.success }, { label: 'Held', key: 'held', color: T.risk }, { label: 'Flagged', key: 'flagged', color: T.danger }, { label: 'Batched', key: 'batched', color: T.info }, { label: 'Paid', key: 'paid', color: T.primary }].map(b => (
              <View key={b.key} style={[s.block, { borderLeftColor: b.color }]}>
                <Text style={s.blockTotal}>${earnings[b.key].total.toLocaleString()}</Text>
                <Text style={s.blockLabel}>{b.label} ({earnings[b.key].count})</Text>
              </View>
            ))}
          </View>
        )}

        {/* MARKET HEALTH */}
        {tab === 'market' && market && (
          <View>
            <View testID="market-health-summary" style={[s.healthBanner, { borderColor: (market.health === 'healthy' ? T.success : T.risk) + '44' }]}>
              <View style={s.healthHeader}>
                <Ionicons name="pulse" size={18} color={market.health === 'healthy' ? T.success : T.risk} />
                <Text style={[s.healthLabel, { color: market.health === 'healthy' ? T.success : T.risk }]}>MARKET {market.health.toUpperCase().replace('_', ' ')}</Text>
              </View>
              <View style={s.healthMetrics}>
                <View style={s.hMetric}><Text style={s.hVal}>{market.open_modules}</Text><Text style={s.hLabel}>Open</Text></View>
                <View style={s.hMetric}><Text style={s.hVal}>{market.bidding_modules}</Text><Text style={s.hLabel}>Bidding</Text></View>
                <View style={s.hMetric}><Text style={s.hVal}>{market.avg_bids_per_module}</Text><Text style={s.hLabel}>Avg Bids</Text></View>
                <View style={s.hMetric}><Text style={s.hVal}>{market.available_developers}</Text><Text style={s.hLabel}>Avail</Text></View>
              </View>
            </View>
            {market.modules.map((m: any) => (
              <View key={m.module_id} style={s.marketCard}>
                <View style={s.mHeader}><Text style={s.mTitle}>{m.title}</Text><Text style={s.mBids}>{m.bid_count} bids</Text></View>
                <Text style={s.mProject}>{m.project_title}</Text>
                <View style={s.mMeta}>
                  <Text style={s.mMetaItem}>Base: ${m.base_price}</Text>
                  {m.bid_count > 0 && <Text style={s.mMetaItem}>Avg: ${m.avg_bid_price}</Text>}
                </View>
                <View style={s.mActions}>
                  <TouchableOpacity testID={`boost-${m.module_id}`} style={s.boostBtn} onPress={async () => { try { await api.post(`/admin/modules/${m.module_id}/boost`); load(); } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); } }}>
                    <Ionicons name="rocket" size={14} color={T.primary} /><Text style={s.boostText}>Boost +20%</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {market.modules.some((m: any) => m.bid_count === 0) && (
              <TouchableOpacity testID="auto-adjust-btn" style={s.autoAdjustBtn} onPress={async () => { try { const r = await api.post('/admin/market/auto-adjust'); Alert.alert('Done', `${r.data.count} adjusted`); load(); } catch {} }}>
                <Ionicons name="flash" size={18} color={T.bg} /><Text style={s.autoAdjustText}>Auto-Adjust Prices</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.md },
  tabRow: { flexDirection: 'row', gap: T.xs, marginBottom: T.lg },
  tabBtn: { flex: 1, padding: 10, borderRadius: T.radiusSm, alignItems: 'center', backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border },
  tabActive: { backgroundColor: T.primary + '22', borderColor: T.primary + '44' },
  tabText: { color: T.textMuted, fontWeight: '600', fontSize: T.small },
  tabTextActive: { color: T.primary },
  profitBanner: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.lg, borderWidth: 1 },
  profitLabel: { color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: T.sm },
  profitRow: { flexDirection: 'row', gap: T.sm, marginBottom: T.md },
  profitItem: { flex: 1, alignItems: 'center' },
  profitBig: { fontSize: T.h2, fontWeight: '800' },
  profitSub: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  cashRow: { flexDirection: 'row', gap: T.sm },
  cashItem: { flex: 1, alignItems: 'center', backgroundColor: T.surface2, borderRadius: T.radiusSm, padding: 8 },
  cashVal: { fontSize: T.body, fontWeight: '700' },
  cashLabel: { color: T.textMuted, fontSize: T.tiny },
  sLabel: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: T.sm, marginTop: T.md },
  profitModCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: 6, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border },
  profitModTitle: { color: T.text, fontSize: T.body, fontWeight: '600', flex: 1 },
  profitModRow: { flexDirection: 'row', alignItems: 'center', gap: T.sm },
  profitModMargin: { fontSize: T.body, fontWeight: '700' },
  profitModPct: { fontSize: T.small, fontWeight: '600' },
  leakSection: { marginTop: T.sm },
  leakBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.danger + '11', borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm },
  leakTotal: { color: T.danger, fontSize: T.body, fontWeight: '700' },
  leakCard: { flexDirection: 'row', alignItems: 'center', gap: T.sm, backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.sm, marginBottom: 4, borderWidth: 1, borderColor: T.border },
  leakMsg: { color: T.text, fontSize: T.small },
  leakLoss: { color: T.danger, fontSize: T.tiny, fontWeight: '600' },
  lowMarginCard: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: 6, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border, flexDirection: 'row', justifyContent: 'space-between' },
  lowMarginTitle: { color: T.text, fontSize: T.body, fontWeight: '600' },
  lowMarginPct: { color: T.danger, fontSize: T.body, fontWeight: '700' },
  grid: { gap: T.sm },
  block: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, borderLeftWidth: 3, borderWidth: 1, borderColor: T.border },
  blockTotal: { color: T.text, fontSize: T.h2, fontWeight: '700' },
  blockLabel: { color: T.textMuted, fontSize: T.small, marginTop: 2 },
  healthBanner: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.lg, borderWidth: 1 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: T.sm },
  healthLabel: { fontSize: T.small, fontWeight: '800', letterSpacing: 2 },
  healthMetrics: { flexDirection: 'row', gap: T.sm },
  hMetric: { flex: 1, alignItems: 'center' },
  hVal: { color: T.text, fontSize: T.h2, fontWeight: '800' },
  hLabel: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  marketCard: { backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, borderWidth: 1, borderColor: T.border },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: T.text, fontSize: T.body, fontWeight: '700', flex: 1 },
  mBids: { color: T.info, fontSize: T.small, fontWeight: '600' },
  mProject: { color: T.textMuted, fontSize: T.small, marginTop: 2 },
  mMeta: { flexDirection: 'row', gap: T.md, marginTop: T.sm },
  mMetaItem: { color: T.textMuted, fontSize: T.tiny },
  mActions: { flexDirection: 'row', gap: T.sm, marginTop: T.sm },
  boostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.primary + '15', borderRadius: T.radiusSm, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.primary + '33' },
  boostText: { color: T.primary, fontSize: T.small, fontWeight: '600' },
  autoAdjustBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.risk, borderRadius: T.radiusSm, padding: 14, marginTop: T.md },
  autoAdjustText: { color: T.bg, fontWeight: '700', fontSize: T.body },
});
