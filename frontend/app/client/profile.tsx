// Client → Profile tab
//
// One account surface. Replaces the old "More" tab and folds Support in
// as a row (so the bottom bar stays at 5 tabs). Everything account-level
// lives here: identity, referrals, documents, support, logout.

import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import api from '../../src/api';
import T from '../../src/theme';

type Ticket = {
  ticket_id: string;
  title: string;
  status: string;
  priority?: string;
  messages?: { text: string }[];
};

export default function ClientProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [supportOpen, setSupportOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // new-ticket form
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const r = await api.get('/client/support-tickets');
      const list: Ticket[] = Array.isArray(r.data) ? r.data : (r.data?.tickets || []);
      setTickets(list);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
      setRefreshing(false);
    }
  };

  const openSupport = () => {
    setSupportOpen(true);
    if (tickets === null) loadTickets();
  };

  const createTicket = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title required'); return; }
    setSubmitting(true);
    try {
      await api.post('/client/support-tickets', { title, description: desc });
      setTitle(''); setDesc(''); setNewOpen(false);
      await loadTickets();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (st: string) =>
    st === 'resolved' ? T.success : st === 'open' ? T.risk : T.info;

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const rows: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    danger?: boolean;
    color?: string;
  }[] = [
    { key: 'account',   icon: 'person-circle-outline', label: 'Account',   onPress: () => Alert.alert('Account', user?.email || 'Your account details') },
    { key: 'referrals', icon: 'people-outline',        label: 'Referrals', onPress: () => Alert.alert('Referrals', 'Coming soon') },
    { key: 'documents', icon: 'document-text-outline', label: 'Documents', onPress: () => Alert.alert('Documents', 'Coming soon') },
    { key: 'support',   icon: 'chatbubble-ellipses-outline', label: 'Support', onPress: openSupport },
  ];
  if (user && (user.roles || []).length > 1) {
    rows.push({
      key: 'switch-role',
      icon: 'swap-horizontal',
      label: 'Switch Role',
      onPress: () => router.replace('/gateway' as any),
      color: T.primary,
    });
  }
  rows.push({
    key: 'logout',
    icon: 'log-out-outline',
    label: 'Sign Out',
    onPress: () => { logout(); router.replace('/auth' as any); },
    danger: true,
    color: T.danger,
  });

  return (
    <SafeAreaView style={s.flex} edges={['top']}>
      <ScrollView contentContainerStyle={s.container} testID="client-profile">
        <Text style={s.title}>Profile</Text>

        {/* Identity card */}
        <View style={s.identity}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{user?.name || user?.email || 'Account'}</Text>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        {/* Menu */}
        {rows.map((r) => (
          <TouchableOpacity
            key={r.key}
            testID={`profile-row-${r.key}`}
            style={s.row}
            onPress={r.onPress}
            activeOpacity={0.7}
          >
            <Ionicons name={r.icon} size={20} color={r.color || T.textMuted} />
            <Text style={[s.rowLabel, r.color ? { color: r.color } : null]}>{r.label}</Text>
            {!r.danger && <Ionicons name="chevron-forward" size={16} color={T.textMuted} />}
          </TouchableOpacity>
        ))}

        <Text style={s.version}>EVA-X · v1.0.0</Text>
      </ScrollView>

      {/* Support sheet (in-profile, no dedicated tab) */}
      <Modal visible={supportOpen} animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <SafeAreaView style={s.flex} edges={['top']}>
          <View style={s.sheetHeader}>
            <TouchableOpacity testID="support-close" onPress={() => setSupportOpen(false)}>
              <Ionicons name="close" size={24} color={T.text} />
            </TouchableOpacity>
            <Text style={s.sheetTitle}>Support</Text>
            <TouchableOpacity testID="new-ticket-open" onPress={() => setNewOpen(true)}>
              <Text style={s.sheetAction}>+ New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.flex}
            contentContainerStyle={{ padding: T.lg, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadTickets(); }}
                tintColor={T.primary}
              />
            }
          >
            {loadingTickets && <ActivityIndicator color={T.primary} style={{ marginTop: 24 }} />}

            {!loadingTickets && (tickets?.length ?? 0) === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>💬</Text>
                <Text style={s.emptyTitle}>No tickets yet</Text>
                <Text style={s.emptySub}>Tap "+ New" if something's off and our team will get back to you.</Text>
              </View>
            )}

            {(tickets || []).map((t) => (
              <View key={t.ticket_id} style={s.ticket} testID={`ticket-${t.ticket_id}`}>
                <View style={s.ticketHeader}>
                  <Text style={s.ticketTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={[s.ticketStatus, { color: statusColor(t.status) }]}>{t.status}</Text>
                </View>
                {t.priority ? <Text style={s.ticketMeta}>Priority: {t.priority}</Text> : null}
                {t.messages && t.messages.length > 0 ? (
                  <Text style={s.ticketMsg} numberOfLines={2}>
                    {t.messages[t.messages.length - 1]?.text}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>

        {/* New ticket modal nested */}
        <Modal visible={newOpen} animationType="slide" transparent onRequestClose={() => setNewOpen(false)}>
          <View style={s.newBackdrop}>
            <View style={s.newCard}>
              <Text style={s.newTitle}>New ticket</Text>
              <TextInput
                testID="new-ticket-title"
                style={s.input}
                placeholder="Title"
                placeholderTextColor={T.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                testID="new-ticket-desc"
                style={[s.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Describe what's happening…"
                placeholderTextColor={T.textMuted}
                value={desc}
                onChangeText={setDesc}
                multiline
              />
              <View style={s.newActions}>
                <TouchableOpacity testID="new-ticket-cancel" style={s.newCancel} onPress={() => setNewOpen(false)}>
                  <Text style={s.newCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="new-ticket-submit"
                  style={[s.newSubmit, submitting && { opacity: 0.6 }]}
                  onPress={createTicket}
                  disabled={submitting}
                >
                  <Text style={s.newSubmitText}>{submitting ? 'Sending…' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: { padding: T.lg, paddingBottom: 100 },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.md,
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.lg,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: T.info + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: T.info, fontSize: 22, fontWeight: '800' },
  name: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  email: { color: T.textMuted, fontSize: T.small, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.md,
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginBottom: T.sm,
  },
  rowLabel: { color: T.text, fontSize: T.body, flex: 1 },

  version: { color: T.textMuted, fontSize: T.tiny, textAlign: 'center', marginTop: T.lg },

  /* Support sheet */
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.lg,
    paddingVertical: T.md,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: T.surface1,
  },
  sheetTitle: { color: T.text, fontSize: T.h3, fontWeight: '800' },
  sheetAction: { color: T.primary, fontSize: T.body, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { color: T.text, fontSize: T.h3, fontWeight: '700' },
  emptySub: { color: T.textMuted, fontSize: T.small, marginTop: 8, textAlign: 'center', maxWidth: 280 },

  ticket: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketTitle: { color: T.text, fontSize: T.body, fontWeight: '700', flex: 1, marginRight: 8 },
  ticketStatus: { fontSize: T.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  ticketMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 4 },
  ticketMsg: { color: T.textMuted, fontSize: T.small, marginTop: 6, fontStyle: 'italic' },

  /* New ticket modal */
  newBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: T.lg },
  newCard: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.lg,
    gap: T.md,
  },
  newTitle: { color: T.text, fontSize: T.h3, fontWeight: '800' },
  input: {
    backgroundColor: T.surface2,
    borderRadius: T.radiusSm,
    padding: 12,
    color: T.text,
    fontSize: T.body,
    borderWidth: 1,
    borderColor: T.border,
  },
  newActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: T.sm },
  newCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: T.radiusSm,
    backgroundColor: T.surface2,
  },
  newCancelText: { color: T.text, fontWeight: '700' },
  newSubmit: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: T.radiusSm,
    backgroundColor: T.primary,
  },
  newSubmitText: { color: T.bg, fontWeight: '800' },
});
