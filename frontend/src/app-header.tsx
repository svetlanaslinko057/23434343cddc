import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { useMe } from './use-me';
import { resolveUserEntry } from './resolve-entry';
import T from './theme';

/**
 * AppHeader — context-aware top bar.
 *
 * Visitor & lead screens (index, auth, estimate-*, lead/*):
 *   • brand only (EVA-X wordmark)
 *   • NO screen title (doesn't call itself "Home")
 *   • NO login button (each visitor screen has its own small inline login link)
 *
 * Authed role cabinets (client/*, developer/*, admin/*):
 *   • brand + avatar (account menu entry point)
 *   • screen title in the middle
 *
 * Authed L0 surfaces (hub/workspace/etc):
 *   • brand + avatar + title
 */
const TITLES: Record<string, string> = {
  hub: 'Home',
  work: 'Work',
  activity: 'Activity',
  inbox: 'Inbox',
  profile: 'Profile',
  auth: '',              // intentionally empty — auth is a visitor surface
  gateway: 'Welcome',
  operator: 'Operator',
  workspace: 'Workspace',
  project: 'Project',
  // Role cabinets are shells, not pages. The active tab is the title — header
  // must stay clean (EVA-X · avatar). Do NOT add client/developer/admin here.
  client: '',
  developer: '',
  admin: '',
  lead: '',              // lead workspace has its own big heading
};

// Role cabinets where we also suppress the context badge (CLIENT / DEV / ADMIN).
// The avatar carries the account context — a second badge is duplicate noise.
const ROLE_CABINETS = new Set(['client', 'developer', 'admin']);

// Segments that belong to the unauthed "visitor / lead" surfaces.
// On these we show a bare header: brand only, no title, no Login button.
// The visitor screens each have their own inline login link.
const VISITOR_SEGMENTS = new Set([
  '',          // `/` — index.tsx
  'index',
  'auth',
  'estimate-result',
  'estimate-improve',
  'lead',
]);

function titleFor(seg: string): string {
  if (!seg) return '';
  if (seg in TITLES) return TITLES[seg];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

function contextBadge(me: any): string | null {
  const active = me?.active_context;
  if (!active) return null;
  return String(active).toUpperCase();
}

export default function AppHeader() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { me } = useMe();

  const firstSeg = (segments[0] || '') as string;
  const isVisitorSurface = !user && VISITOR_SEGMENTS.has(firstSeg);
  const isRoleCabinet = ROLE_CABINETS.has(firstSeg);
  const title = useMemo(() => (isVisitorSurface ? '' : titleFor(firstSeg)), [firstSeg, isVisitorSurface]);
  // Hide the context badge (CLIENT / DEV / ADMIN) on role cabinets — the active
  // tab + avatar already carry that context. Keep it on L0 surfaces (hub, work,
  // activity, inbox) where the user has multiple roles and might forget which
  // hat they're wearing.
  const badge = !isRoleCabinet ? contextBadge(me) : null;

  const onBrand = () => {
    if (user && me) router.push(resolveUserEntry(me) as any);
    else router.push('/' as any);
  };
  const onAvatar = () => router.push('/profile' as any);

  return (
    <View
      testID="app-header"
      style={[s.container, { paddingTop: Math.max(insets.top, 8) }]}
    >
      <View style={s.row}>
        <TouchableOpacity
          testID="app-header-brand"
          style={s.brandWrap}
          onPress={onBrand}
          activeOpacity={0.7}
        >
          <Text style={s.brand} accessibilityLabel="EVA-X">EVA-X</Text>
        </TouchableOpacity>

        <View style={s.titleWrap}>
          {title ? <Text style={s.title} numberOfLines={1}>{title}</Text> : null}
          {badge && !isVisitorSurface ? (
            <View testID="app-header-context-badge" style={s.badge}>
              <Text style={s.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>

        {/* Right side: avatar for authed users, empty spacer for visitors.
            Visitor surfaces carry their own inline "Log in" link inside the
            page body, so we don't duplicate it here. */}
        <View style={s.rightBtn}>
          {user ? (
            <TouchableOpacity
              testID="app-header-avatar"
              onPress={onAvatar}
              activeOpacity={0.7}
              style={s.avatar}
            >
              <Text style={s.avatarText}>
                {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(11,15,20,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    height: 48,
    paddingHorizontal: T.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: { minWidth: 72 },
  brand: { color: T.primary, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: T.text, fontSize: T.body, fontWeight: '700' },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: T.primary + '22',
    borderWidth: 1, borderColor: T.primary + '55',
  },
  badgeText: { color: T.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  rightBtn: { minWidth: 72, alignItems: 'flex-end', justifyContent: 'center' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: T.text, fontSize: 13, fontWeight: '800' },
});
