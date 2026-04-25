import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../src/api';
import T from '../../src/theme';

export default function AdminIntegrations() {
  const router = useRouter();
  const [sources, setSources] = useState<any[]>([]);
  const [adapters, setAdapters] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);   // selected source details
  const [detail, setDetail] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('mock');

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.get('/integrations/sources'),
        api.get('/integrations/adapters'),
      ]);
      setSources(s.data.sources || []);
      setAdapters(a.data.adapters || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (src: any) => {
    setSelected(src);
    try {
      const r = await api.get(`/integrations/sources/${src.source_id}`);
      setDetail(r.data);
    } catch {}
  };

  const doSync = async (src: any) => {
    setSyncing(prev => ({ ...prev, [src.source_id]: true }));
    try {
      const r = await api.post(`/integrations/sources/${src.source_id}/sync`);
      Alert.alert('Sync complete', `Imported: ${r.data.imported} · Updated: ${r.data.updated} · Skipped: ${r.data.skipped}`);
      await load();
      if (selected?.source_id === src.source_id) openDetail(src);
    } catch (e: any) {
      Alert.alert('Sync failed', e.response?.data?.detail || 'Try again');
    } finally {
      setSyncing(prev => ({ ...prev, [src.source_id]: false }));
    }
  };

  const createSource = async () => {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    try {
      await api.post('/integrations/sources', { name: newName.trim(), type: newType, config: {} });
      setShowCreate(false); setNewName(''); setNewType('mock');
      await load();
    } catch (e: any) {
      Alert.alert('Create failed', e.response?.data?.detail || 'Try again');
    }
  };

  const deleteSource = async (src: any) => {
    Alert.alert('Delete source?', `${src.name} — imported modules will be unlinked, not deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/integrations/sources/${src.source_id}`);
          setSelected(null); setDetail(null);
          await load();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
      }},
    ]);
  };

  const statusColor = (s: string) => s === 'idle' ? T.success : s === 'syncing' ? T.info : s === 'error' ? T.danger : T.textMuted;
  const evTypeColor = (t: string) => t.startsWith('sync:success') ? T.success : t.startsWith('sync:error') ? T.danger : t.startsWith('sync:') ? T.info : t.startsWith('task:imported') ? T.primary : t.startsWith('task:updated') ? T.info : T.textMuted;
  const fmtTime = (iso?: string) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); if (selected) await openDetail(selected); setRefreshing(false); }} tintColor={T.primary} />}
      >
        <View style={s.header}>
          <TouchableOpacity testID="integrations-back" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={T.textMuted} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Integrations</Text>
            <Text style={s.subtitle}>{sources.length} source(s) · ATLAS orchestrates, legacy owns the data</Text>
          </View>
          <TouchableOpacity testID="integrations-add" style={s.addBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={20} color={T.bg} />
          </TouchableOpacity>
        </View>

        <View style={s.principleBox}>
          <Ionicons name="information-circle" size={14} color={T.info} />
          <Text style={s.principleText}>
            <Text style={s.principleBold}>READ-only MVP.</Text> External tasks become ATLAS modules for orchestration. Source of truth stays in the legacy system — no writes back.
          </Text>
        </View>

        {sources.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="link" size={48} color={T.textMuted} />
            <Text style={s.emptyTitle}>No integrations yet</Text>
            <Text style={s.emptyDesc}>Add a source to pull external tasks into ATLAS marketplace.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnText}>Add Mock Source</Text>
            </TouchableOpacity>
          </View>
        )}

        {sources.map((src) => (
          <View key={src.source_id} testID={`source-${src.source_id}`} style={s.sourceCard}>
            <TouchableOpacity style={s.sourceHead} onPress={() => openDetail(src)}>
              <View style={s.sourceIcon}>
                <Ionicons name="git-network" size={18} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceName}>{src.name}</Text>
                <Text style={s.sourceMeta}>{src.type} · {src.imported_count} imported · Last sync: {fmtTime(src.last_synced_at)}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: statusColor(src.status) + '22' }]}>
                <View style={[s.statusDot, { backgroundColor: statusColor(src.status) }]} />
                <Text style={[s.statusText, { color: statusColor(src.status) }]}>{src.status}</Text>
              </View>
            </TouchableOpacity>

            {src.last_error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color={T.danger} />
                <Text style={s.errorText} numberOfLines={2}>{src.last_error}</Text>
              </View>
            )}

            <View style={s.sourceActions}>
              <TouchableOpacity
                testID={`sync-${src.source_id}`}
                style={s.syncBtn}
                onPress={() => doSync(src)}
                disabled={!!syncing[src.source_id]}
              >
                {syncing[src.source_id]
                  ? <ActivityIndicator color={T.bg} size="small" />
                  : (<><Ionicons name="sync" size={14} color={T.bg} /><Text style={s.syncBtnText}>Sync now</Text></>)}
              </TouchableOpacity>
              <TouchableOpacity style={s.detailBtn} onPress={() => openDetail(src)}>
                <Text style={s.detailBtnText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => deleteSource(src)}>
                <Ionicons name="trash" size={14} color={T.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* CREATE SOURCE MODAL */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Add Integration Source</Text>
            <Text style={s.modalLabel}>Name</Text>
            <TextInput
              testID="new-source-name"
              style={s.modalInput}
              placeholder="E.g. Main CRM"
              placeholderTextColor={T.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={s.modalLabel}>Adapter type</Text>
            <View style={s.adapterRow}>
              {adapters.map(a => (
                <TouchableOpacity
                  key={a.type}
                  testID={`adapter-${a.type}`}
                  style={[s.adapterPill, newType === a.type && s.adapterPillOn]}
                  onPress={() => setNewType(a.type)}
                >
                  <Text style={[s.adapterPillText, newType === a.type && s.adapterPillTextOn]}>{a.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowCreate(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="create-source-submit" style={s.modalSubmit} onPress={createSource}>
                <Text style={s.modalSubmitText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DETAIL DRAWER */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => { setSelected(null); setDetail(null); }}>
        <SafeAreaView style={s.detailSafe} edges={['top']}>
          <View style={s.detailHeader}>
            <TouchableOpacity onPress={() => { setSelected(null); setDetail(null); }} style={s.backBtn}>
              <Ionicons name="close" size={22} color={T.textMuted} />
            </TouchableOpacity>
            <Text style={s.detailTitle} numberOfLines={1}>{selected?.name}</Text>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {detail && (
              <>
                <View style={s.detailSection}>
                  <Text style={s.sLabel}>RUNS</Text>
                  {(detail.runs || []).slice(0, 8).map((r: any) => (
                    <View key={r.run_id} style={s.runRow}>
                      <View style={[s.runDot, { backgroundColor: r.status === 'success' ? T.success : r.status === 'partial' ? T.risk : r.status === 'running' ? T.info : T.danger }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.runStatus}>{r.status.toUpperCase()}</Text>
                        <Text style={s.runStats}>+{r.items_imported} new · ~{r.items_updated} updated · {r.items_skipped} skipped</Text>
                        <Text style={s.runTime}>{fmtTime(r.started_at)}</Text>
                      </View>
                    </View>
                  ))}
                  {(detail.runs || []).length === 0 && <Text style={s.muted}>No runs yet — tap Sync now</Text>}
                </View>

                <View style={s.detailSection}>
                  <Text style={s.sLabel}>IMPORTED MODULES ({(detail.modules || []).length})</Text>
                  {(detail.modules || []).slice(0, 20).map((m: any) => (
                    <View key={m.module_id} style={s.modRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.modTitle}>{m.title}</Text>
                        <Text style={s.modMeta}>{m.type} · ${m.price} · ext: {m.external_id} · {m.status}</Text>
                      </View>
                      <View style={[s.syncTag, { backgroundColor: (m.sync_status === 'synced' ? T.success : T.risk) + '22' }]}>
                        <Text style={[s.syncTagText, { color: m.sync_status === 'synced' ? T.success : T.risk }]}>{m.sync_status}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={s.detailSection}>
                  <Text style={s.sLabel}>EVENTS</Text>
                  {(detail.events || []).slice(0, 20).map((e: any) => (
                    <View key={e.event_id} style={s.evRow}>
                      <View style={[s.evDot, { backgroundColor: evTypeColor(e.type) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.evType, { color: evTypeColor(e.type) }]}>{e.type}</Text>
                        {e.data?.title && <Text style={s.evData} numberOfLines={1}>{e.data.title}</Text>}
                        {e.data?.errors?.length > 0 && <Text style={s.evError}>{e.data.errors[0]}</Text>}
                        <Text style={s.runTime}>{fmtTime(e.created_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={{ height: 60 }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: T.md, gap: T.sm },
  backBtn: { padding: 4 },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800' },
  subtitle: { color: T.textMuted, fontSize: T.tiny },
  addBtn: { backgroundColor: T.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  principleBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: T.info + '11', borderRadius: T.radiusSm, padding: 10, marginHorizontal: T.md, marginBottom: T.md, borderWidth: 1, borderColor: T.info + '33' },
  principleText: { color: T.text, fontSize: T.tiny, flex: 1, lineHeight: 16 },
  principleBold: { fontWeight: '800', color: T.info },

  empty: { alignItems: 'center', paddingVertical: T.xl * 2, gap: 8 },
  emptyTitle: { color: T.text, fontSize: T.h2, fontWeight: '700' },
  emptyDesc: { color: T.textMuted, fontSize: T.body, textAlign: 'center', paddingHorizontal: T.lg },
  emptyBtn: { backgroundColor: T.primary, borderRadius: T.radiusSm, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: T.bg, fontWeight: '700' },

  sourceCard: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginHorizontal: T.md, marginBottom: T.sm, borderWidth: 1, borderColor: T.border },
  sourceHead: { flexDirection: 'row', alignItems: 'center', gap: T.sm },
  sourceIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.primary + '22', alignItems: 'center', justifyContent: 'center' },
  sourceName: { color: T.text, fontSize: T.body, fontWeight: '700' },
  sourceMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: T.tiny, fontWeight: '800', textTransform: 'uppercase' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.danger + '11', borderRadius: T.radiusSm, padding: 8, marginTop: 8 },
  errorText: { color: T.danger, fontSize: T.tiny, flex: 1 },

  sourceActions: { flexDirection: 'row', gap: T.sm, marginTop: T.sm },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.primary, borderRadius: T.radiusSm, paddingHorizontal: 14, paddingVertical: 8, minWidth: 100, justifyContent: 'center' },
  syncBtnText: { color: T.bg, fontWeight: '700', fontSize: T.small },
  detailBtn: { backgroundColor: T.surface2, borderRadius: T.radiusSm, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: T.border },
  detailBtnText: { color: T.text, fontWeight: '600', fontSize: T.small },
  delBtn: { backgroundColor: T.danger + '11', borderRadius: T.radiusSm, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: T.md },
  modal: { backgroundColor: T.surface1, borderRadius: T.radius, padding: T.lg, borderWidth: 1, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: T.h2, fontWeight: '800', marginBottom: T.md },
  modalLabel: { color: T.textMuted, fontSize: T.tiny, fontWeight: '700', letterSpacing: 2, marginTop: T.sm, marginBottom: 6 },
  modalInput: { backgroundColor: T.surface2, color: T.text, borderRadius: T.radiusSm, padding: 12, borderWidth: 1, borderColor: T.border, fontSize: T.body },
  adapterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  adapterPill: { backgroundColor: T.surface2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.border },
  adapterPillOn: { backgroundColor: T.primary, borderColor: T.primary },
  adapterPillText: { color: T.textMuted, fontSize: T.small, fontWeight: '600' },
  adapterPillTextOn: { color: T.bg, fontWeight: '800' },
  modalBtns: { flexDirection: 'row', gap: T.sm, marginTop: T.lg },
  modalCancel: { flex: 1, backgroundColor: T.surface2, borderRadius: T.radiusSm, padding: 12, alignItems: 'center' },
  modalCancelText: { color: T.text, fontWeight: '700' },
  modalSubmit: { flex: 1, backgroundColor: T.primary, borderRadius: T.radiusSm, padding: 12, alignItems: 'center' },
  modalSubmitText: { color: T.bg, fontWeight: '800' },

  detailSafe: { flex: 1, backgroundColor: T.bg },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: T.md, gap: T.sm, borderBottomWidth: 1, borderBottomColor: T.border },
  detailTitle: { color: T.text, fontSize: T.h2, fontWeight: '800', flex: 1 },
  detailSection: { padding: T.md },
  sLabel: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: T.sm },
  muted: { color: T.textMuted, fontSize: T.small },

  runRow: { flexDirection: 'row', alignItems: 'center', gap: T.sm, backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: T.border },
  runDot: { width: 8, height: 8, borderRadius: 4 },
  runStatus: { color: T.text, fontSize: T.small, fontWeight: '800', letterSpacing: 1 },
  runStats: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  runTime: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },

  modRow: { flexDirection: 'row', alignItems: 'center', gap: T.sm, backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: T.border },
  modTitle: { color: T.text, fontSize: T.small, fontWeight: '700' },
  modMeta: { color: T.textMuted, fontSize: T.tiny, marginTop: 2 },
  syncTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  syncTagText: { fontSize: T.tiny, fontWeight: '800', textTransform: 'uppercase' },

  evRow: { flexDirection: 'row', gap: T.sm, backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: T.border },
  evDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  evType: { fontSize: T.tiny, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  evData: { color: T.text, fontSize: T.small, marginTop: 2 },
  evError: { color: T.danger, fontSize: T.tiny, marginTop: 2 },
});
