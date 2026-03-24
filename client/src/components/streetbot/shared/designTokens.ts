/**
 * SBP Glassmorphism design tokens — shared across all Street Voices pages.
 *
 * Usage:
 *   import { T, glass, glassHover, aurora } from '../shared/designTokens';
 *   <div style={{ background: T.bgDeep, color: T.textPrimary, ...glass }}>
 */

/** Core color tokens */
export const T = {
  bgDeep: '#1f2027',
  bgSurface: '#343640',
  accent: '#FFD600',
  accentHover: '#E6C200',
  accentMuted: 'rgba(255, 214, 0, 0.15)',
  textPrimary: '#DDDDE2',
  textSecondary: '#AFAFAF',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  border: 'rgba(255, 255, 255, 0.15)',
  borderHover: 'rgba(255, 255, 255, 0.25)',
  borderAccent: 'rgba(255, 214, 0, 0.4)',
  glassSubtle: 'rgba(255, 255, 255, 0.06)',
  glassMedium: 'rgba(255, 255, 255, 0.08)',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

/** Glassmorphic panel style */
export const glass: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: `1px solid ${T.border}`,
  borderRadius: 16,
};

/** Glassmorphic panel with hover glow */
export const glassHover: React.CSSProperties = {
  ...glass,
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

/** Aurora background orb positions (3 orbs) — matches SBP glassmorphism */
export const auroraOrbs = [
  { color: 'rgba(255, 214, 0, 0.12)', top: '-10%', left: '-5%', size: 500 },
  { color: 'rgba(139, 92, 246, 0.10)', top: '30%', right: '-10%', size: 450 },
  { color: 'rgba(6, 182, 212, 0.08)', bottom: '-15%', left: '20%', size: 400 },
];

/** Full-page wrapper style (fixes scroll issue) */
export const pageWrapper: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  background: T.bgDeep,
  color: T.textPrimary,
  fontFamily: 'Rubik, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

/** Section heading style */
export const headingStyle: React.CSSProperties = {
  fontFamily: 'Rubik, -apple-system, BlinkMacSystemFont, sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

/** Priority colors for tasks */
export const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#FFD600',
  low: '#3B82F6',
  none: '#6B7280',
};

/** Status colors */
export const statusColors: Record<string, string> = {
  todo: '#6B7280',
  in_progress: '#3B82F6',
  in_review: '#A855F7',
  done: '#22C55E',
  cancelled: '#EF4444',
  backlog: '#78716C',
};
