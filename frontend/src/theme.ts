import { View, Text, StyleSheet } from 'react-native';

/**
 * L0 Design Tokens — single source of truth for color, spacing, typography.
 *
 * Field names are stable (bg/surface1/border/text/textMuted/primary/…) because
 * ~40 screens import them. We only adjust values to Linear-canon:
 *   • border opacity 0.10 → 0.06 (softer)
 *   • textMuted split into textSecondary (0.70) + textMuted (0.50)
 *   • spacing gains lg=20 / xl=28 / xxl=36 for real breathing room
 */
export const T = {
  // Surfaces
  bg: '#0B0F14',
  surface1: '#0F141B',
  surface2: '#121A23',
  surface3: '#16202B',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.10)',

  // Text
  text: '#E6EDF3',
  textSecondary: '#9FB0C0',
  textMuted: '#6B7C8F',

  // Accent palette
  primary: '#2FE6A6',   // green — action / brand
  trust: '#2FE6A6',
  success: '#2FE6A6',
  risk: '#F5C451',      // yellow — review / caution
  info: '#4DA3FF',      // blue — started / neutral-live
  danger: '#FF6B6B',    // red — error / logout
  white: '#FFFFFF',
  black: '#000000',

  // Spacing — use these instead of hard-coded pixels.
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,

  // Type scale
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,

  // Radius
  radius: 14,
  radiusSm: 10,
  radiusLg: 18,
};

export default T;

/** Canonical typography helpers — keep inline styles aligned to the scale. */
export const typo = StyleSheet.create({
  title: { color: T.text, fontSize: 22, fontWeight: '700' },
  section: { color: T.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  body: { color: T.text, fontSize: 15 },
  secondary: { color: T.textSecondary, fontSize: 15 },
  caption: { color: T.textSecondary, fontSize: 13 },
  muted: { color: T.textMuted, fontSize: 13 },
});
