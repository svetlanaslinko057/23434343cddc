// Client → Billing tab
//
// Money. Two reads:
//   • GET /api/client/costs    — top summary (revenue/paid/remaining/profit)
//   • GET /api/client/invoices — list of every invoice attached to the client
//
// Everything mapped 1:1 to backend Invoice schema:
//   { invoice_id, project_id, title, amount, currency, status,
//     payment_provider, created_at, paid_at }

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import T from '../../src/theme';

type Invoice = {
  invoice_id: string;
  project_id: string;
  title: string;
  amount: number;
  currency?: string;
  status: 'paid' | 'pending_payment' | 'draft' | 'failed' | 'cancelled' | string;
  payment_provider?: string;
  created_at?: string;
  paid_at?: string;
};

type CostSummary = {
  revenue?: number;
  committed_cost?: number;
  earned?: number;
  paid_out?: number;
  remaining_cost?: number;
  profit?: number;
};

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  paid:            { label: 'Paid',     color: '#22c55e' },
  pending_payment: { label: 'Pending',  color: '#f59e0b' },
  draft:           { label: 'Draft',    color: '#60a5fa' },
  failed:          { label: 'Failed',   color: '#ef4444' },
  cancelled:       { label: 'Cancelled',color: '#6b7280' },
};

function fmt(n: number | undefined): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ClientBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costs, setCosts] = useState<CostSummary>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [invR, costR, projR] = await Promise.all([
        api.get('/client/invoices'),
        api.get('/client/costs'),
        api.get('/projects/mine'),
      ]);
      const invList: Invoice[] = Array.isArray(invR.data)
        ? invR.data
        : Array.isArray(invR.data?.invoices) ? invR.data.invoices : [];
      // Group-friendly sort: by project_id (consistent grouping), then newest first inside each project.
      invList.sort((a, b) => {
        const p = (a.project_id || '').localeCompare(b.project_id || '');
        if (p !== 0) return p;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
      setInvoices(invList);
      setCosts(costR.data?.summary || {});
      const nameMap: Record<string, string> = {};
      for (const p of (Array.isArray(projR.data) ? projR.data : [])) {
        nameMap[p.project_id] = p.name || p.title || '';
      }
      setProjectNames(nameMap);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const pending = invoices.filter(i => i.status === 'pending_payment').reduce((s, i) => s + i.amount, 0);
    return { paid, pending };
  }, [invoices]);

  const pay = async (inv: Invoice) => {
    Alert.alert(
      'Pay invoice',
      `${inv.title}\n$${fmt(inv.amount)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark as paid', onPress: async () => {
          try {
            await api.post(`/client/invoices/${inv.invoice_id}/pay`);
            load();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail || 'Payment failed');
          }
        }},
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.flex, s.center]} edges={['top']}>
        <ActivityIndicator color={T.primary} />
      </SafeAreaView>
    );
  }

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
        testID="client-billing"
      >
        <Text style={s.title}>Billing</Text>
        <Text style={s.subtitle}>Where every dollar goes</Text>

        {/* Summary band */}
        <View style={s.summaryRow}>
          <SummaryCard label="Paid"      value={`$${fmt(totals.paid)}`}            color={T.success} />
          <SummaryCard label="Pending"   value={`$${fmt(totals.pending)}`}         color="#f59e0b" />
          <SummaryCard label="Earned"    value={`$${fmt(costs.earned)}`}           color={T.text} />
          <SummaryCard label="Profit"    value={`$${fmt(costs.profit)}`}           color={(costs.profit ?? 0) >= 0 ? T.success : T.danger} />
        </View>

        {/* Invoice list — grouped by project */}
        <Text style={s.sectionTitle}>Invoices</Text>

        {invoices.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No invoices yet</Text>
            <Text style={s.emptySub}>Once a milestone is approved, an invoice will appear here.</Text>
          </View>
        )}

        {(() => {
          // Group invoices by project_id, preserving sort order
          const groups: { project_id: string; project_name: string; items: Invoice[] }[] = [];
          for (const inv of invoices) {
            const pid = inv.project_id || '_';
            const name = projectNames[pid] || 'Untitled';
            const last = groups[groups.length - 1];
            if (last && last.project_id === pid) {
              last.items.push(inv);
            } else {
              groups.push({ project_id: pid, project_name: name, items: [inv] });
            }
          }
          return groups.map((g) => (
            <View key={g.project_id} style={{ marginBottom: T.md }}>
              <Text style={s.projectGroup}>{g.project_name}</Text>
              {g.items.map((inv) => {
                const meta = STATUS_COPY[inv.status] || STATUS_COPY.draft;
                const dateLabel = inv.status === 'paid'
                  ? `Paid ${shortDate(inv.paid_at)}`
                  : `Created ${shortDate(inv.created_at)}`;
                return (
                  <View key={inv.invoice_id} style={s.invoice} testID={`invoice-${inv.invoice_id}`}>
                    <View style={s.invoiceHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={s.invoiceTitle} numberOfLines={2}>{inv.title}</Text>
                      </View>
                      <View style={[s.statusPill, { borderColor: meta.color + '66', backgroundColor: meta.color + '14' }]}>
                        <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>

                    <View style={s.invoiceFooter}>
                      <View>
                        <Text style={s.amount}>${fmt(inv.amount)}</Text>
                        <Text style={s.invoiceDate}>{dateLabel}{inv.payment_provider ? ` · ${inv.payment_provider}` : ''}</Text>
                      </View>

                      {inv.status === 'pending_payment' && (
                        <TouchableOpacity
                          testID={`invoice-pay-${inv.invoice_id}`}
                          style={s.payBtn}
                          onPress={() => pay(inv)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="card" size={16} color={T.bg} />
                          <Text style={s.payBtnText}>Pay now</Text>
                        </TouchableOpacity>
                      )}
                      {inv.status === 'draft' && (
                        <View style={s.draftHint}>
                          <Text style={s.draftHintText}>Estimate · awaiting issue</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ));
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.sumCard}>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: T.lg, paddingBottom: 100 },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.small, marginTop: 4, marginBottom: T.lg },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.sm, marginBottom: T.lg },
  sumCard: {
    flex: 1, minWidth: 80,
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: 10,
    padding: T.md,
  },
  sumValue: { fontSize: 17, fontWeight: '800' },
  sumLabel: { color: T.textMuted, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

  sectionTitle: { color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  projectGroup: {
    color: T.text,
    fontSize: T.body,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: T.sm,
    marginBottom: 6,
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  emptySub: { color: T.textMuted, fontSize: T.small, marginTop: 8, textAlign: 'center', maxWidth: 280 },

  invoice: {
    backgroundColor: T.surface1,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
  },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceTitle: { color: T.text, fontSize: T.body, fontWeight: '700' },
  invoiceMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 4, letterSpacing: 0.3 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: T.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  invoiceFooter: {
    marginTop: T.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amount: { color: T.text, fontSize: T.h2, fontWeight: '800' },
  invoiceDate: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },

  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.primary,
    borderRadius: T.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payBtnText: { color: T.bg, fontWeight: '800', fontSize: T.small },
  draftHint: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: T.radiusSm, backgroundColor: T.surface2 },
  draftHintText: { color: T.textMuted, fontSize: T.tiny, fontWeight: '700' },
});
