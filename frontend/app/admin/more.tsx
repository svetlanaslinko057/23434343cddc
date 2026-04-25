import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { Ionicons } from '@expo/vector-icons';
import T from '../../src/theme';

export default function AdminMore() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const items = [
    { label: 'Funnel Metrics', icon: 'bar-chart', route: '/admin/metrics' },
    { label: 'Team Layer', icon: 'people', route: '/admin/teams' },
    { label: 'Intelligence', icon: 'analytics', route: '/admin/intelligence' },
    { label: 'Team Intelligence', icon: 'git-network', route: '/admin/teams-intel' },
    { label: 'System Actions', icon: 'flash', route: '/admin/autonomy' },
    { label: 'Platform Tier', icon: 'layers', route: '/admin/platform' },
    { label: 'Revenue Brain', icon: 'trending-up', route: '/admin/segments' },
    { label: 'Flow Alerts', icon: 'pulse', route: '/admin/market' },
    { label: 'Integrations', icon: 'git-network', route: '/admin/integrations' },
    { label: 'AI Operator', icon: 'flash', route: '/operator' },
    { label: 'Execution History', icon: 'time', route: '/operator/history' },
    { label: 'New Project Wizard', icon: 'sparkles', route: '/project/wizard' },
    { label: 'Team Panel', icon: 'people', route: null },
    { label: 'Client Operations', icon: 'business', route: null },
    { label: 'Templates', icon: 'document-text', route: null },
  ];

  return (
    <View style={s.container}>
      <Text style={s.title}>More</Text>
      <View style={s.profile}>
        <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0] || 'A'}</Text></View>
        <View>
          <Text style={s.profileName}>{user?.name}</Text>
          <Text style={s.profileRole}>{user?.active_role} — {user?.email}</Text>
        </View>
      </View>
      {items.map(item => (
        <TouchableOpacity
          key={item.label}
          testID={`more-${item.label.toLowerCase().replace(/\s/g,'-')}`}
          style={s.menuItem}
          onPress={() => item.route && router.push(item.route as any)}
          disabled={!item.route}
        >
          <Ionicons name={item.icon as any} size={20} color={item.route ? T.primary : T.textMuted} />
          <Text style={s.menuLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
        </TouchableOpacity>
      ))}
      {user && user.roles.length > 1 && (
        <TouchableOpacity testID="switch-role-btn" style={s.menuItem} onPress={() => router.replace('/gateway')}>
          <Ionicons name="swap-horizontal" size={20} color={T.primary} />
          <Text style={[s.menuLabel, { color: T.primary }]}>Switch Role</Text>
          <Ionicons name="chevron-forward" size={16} color={T.primary} />
        </TouchableOpacity>
      )}
      <TouchableOpacity testID="logout-btn" style={[s.menuItem, { borderColor: T.danger + '33' }]} onPress={() => { logout(); router.replace('/auth'); }}>
        <Ionicons name="log-out" size={20} color={T.danger} />
        <Text style={[s.menuLabel, { color: T.danger }]}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, padding: T.md },
  title: { color: T.text, fontSize: T.h1, fontWeight: '800', marginBottom: T.lg },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radius, padding: T.md, marginBottom: T.lg, borderWidth: 1, borderColor: T.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.primary + '33', alignItems: 'center', justifyContent: 'center', marginRight: T.md },
  avatarText: { color: T.primary, fontSize: T.h2, fontWeight: '700' },
  profileName: { color: T.text, fontSize: T.h3, fontWeight: '600' },
  profileRole: { color: T.textMuted, fontSize: T.small },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface1, borderRadius: T.radiusSm, padding: T.md, marginBottom: T.sm, gap: T.md, borderWidth: 1, borderColor: T.border },
  menuLabel: { color: T.text, fontSize: T.body, flex: 1 },
});
