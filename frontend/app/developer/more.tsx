import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { Ionicons } from '@expo/vector-icons';
import T from '../../src/theme';

export default function DevMore() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <View style={s.container}>
      <Text style={s.title}>More</Text>
      <View style={s.profile}>
        <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0] || 'D'}</Text></View>
        <View><Text style={s.name}>{user?.name}</Text><Text style={s.role}>{user?.tier} tier — {user?.email}</Text></View>
      </View>
      {[{ label: 'QA Feedback', icon: 'chatbubbles' }, { label: 'Leaderboard', icon: 'trophy' }, { label: 'Growth', icon: 'trending-up' }, { label: 'Time Logs', icon: 'time' }].map(i => (
        <TouchableOpacity key={i.label} style={s.item}><Ionicons name={i.icon as any} size={20} color={T.textMuted} /><Text style={s.itemLabel}>{i.label}</Text><Ionicons name="chevron-forward" size={16} color={T.textMuted} /></TouchableOpacity>
      ))}
      {user && user.roles.length > 1 && (
        <TouchableOpacity testID="dev-switch-role" style={s.item} onPress={() => router.replace('/gateway')}><Ionicons name="swap-horizontal" size={20} color={T.primary} /><Text style={[s.itemLabel, { color: T.primary }]}>Switch Role</Text><Ionicons name="chevron-forward" size={16} color={T.primary} /></TouchableOpacity>
      )}
      <TouchableOpacity testID="dev-logout" style={s.item} onPress={() => { logout(); router.replace('/auth'); }}><Ionicons name="log-out" size={20} color={T.danger} /><Text style={[s.itemLabel, { color: T.danger }]}>Sign Out</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.lg, borderWidth: 1, borderColor: T.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.primary + '33', alignItems: 'center', justifyContent: 'center', marginRight: T.md },
  avatarText: { color: T.primary, fontSize: T.h2, fontWeight: '700' },
  name: { color: T.text, fontSize: T.h3, fontWeight: '600' },
  role: { color: T.textMuted, fontSize: T.small },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, gap: T.md, borderWidth: 1, borderColor: T.border },
  itemLabel: { color: T.text, fontSize: T.body, flex: 1 },
});
