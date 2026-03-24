/**
 * Academy Gamification API adapter for LibreChat (Vite).
 * Re-exports types and provides sbFetch-based API functions.
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/academy/gamification';

// =============================================================================
// Types
// =============================================================================

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  badge_type: 'achievement' | 'milestone' | 'skill' | 'special';
  category: string | null;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points_value: number;
  xp_value: number;
  is_active: boolean;
  is_secret: boolean;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  course_id: string | null;
  metadata: Record<string, unknown>;
  badge: Badge;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  achievement_type: 'progress' | 'milestone' | 'challenge' | 'daily' | 'weekly';
  category: string | null;
  target_value: number;
  points_reward: number;
  xp_reward: number;
  badge_reward_id: string | null;
  is_active: boolean;
  is_repeatable: boolean;
  reset_period: string | null;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  current_value: number;
  target_value: number;
  completed_at: string | null;
  completion_count: number;
  last_progress_at: string;
  created_at: string;
  updated_at: string;
  achievement: Achievement;
  progress_percent: number;
}

export interface UserPointsSummary {
  id: string;
  user_id: string;
  total_points: number;
  total_xp: number;
  level: number;
  current_level_xp: number;
  xp_to_next_level: number;
  lifetime_points: number;
  weekly_points: number;
  monthly_points: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PointsLedgerEntry {
  id: string;
  user_id: string;
  points: number;
  xp: number;
  action_type: string;
  action_id: string | null;
  description: string | null;
  course_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  leaderboard_id: string;
  user_id: string;
  rank: number;
  score: number;
  previous_rank: number | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  level: number;
  rank_change: number;
}

export interface Leaderboard {
  id: string;
  name: string;
  leaderboard_type: 'global' | 'course' | 'weekly' | 'monthly' | 'all_time';
  course_id: string | null;
  period_start: string | null;
  period_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  entries: LeaderboardEntry[];
  total_participants: number;
}

export interface Streak {
  id: string;
  user_id: string;
  streak_type: 'daily_login' | 'daily_lesson' | 'daily_quiz';
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_start_date: string | null;
  course_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface XPLevel {
  level: number;
  xp_required: number;
  title: string | null;
  perks: Record<string, unknown>[];
  badge_id: string | null;
}

export interface GamificationDashboard {
  user_id: string;
  points_summary: UserPointsSummary;
  level_info: {
    level: number;
    title: string;
    current_level_xp: number;
    xp_to_next_level: number;
    progress_percent: number;
  };
  badges_earned: number;
  badges_total: number;
  recent_badges: UserBadge[];
  achievements_completed: number;
  achievements_total: number;
  active_achievements: UserAchievement[];
  current_streak: Streak;
  global_rank: number | null;
  recent_activity: PointsLedgerEntry[];
}

// =============================================================================
// Mock data (fallback)
// =============================================================================

function getMockDashboard(userId: string): GamificationDashboard {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    points_summary: {
      id: 'mock-1', user_id: userId, total_points: 1250, total_xp: 875,
      level: 5, current_level_xp: 375, xp_to_next_level: 625,
      lifetime_points: 1250, weekly_points: 150, monthly_points: 450,
      current_streak: 7, longest_streak: 14,
      last_activity_date: new Date().toISOString().split('T')[0],
      created_at: now, updated_at: now,
    },
    level_info: { level: 5, title: 'Apprentice', current_level_xp: 375, xp_to_next_level: 625, progress_percent: 37.5 },
    badges_earned: 8, badges_total: 25,
    recent_badges: [
      { id: 'ub-1', user_id: userId, badge_id: 'b-1', earned_at: now, course_id: null, metadata: {},
        badge: { id: 'b-1', name: 'First Steps', description: 'Complete your first lesson', icon_url: null, badge_type: 'milestone', category: 'completion', rarity: 'common', points_value: 50, xp_value: 25, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
      { id: 'ub-2', user_id: userId, badge_id: 'b-2', earned_at: now, course_id: null, metadata: {},
        badge: { id: 'b-2', name: 'Quiz Master', description: 'Score 100% on any quiz', icon_url: null, badge_type: 'achievement', category: 'quiz', rarity: 'rare', points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
    ],
    achievements_completed: 5, achievements_total: 20,
    active_achievements: [
      { id: 'ua-1', user_id: userId, achievement_id: 'a-1', current_value: 7, target_value: 10, completed_at: null, completion_count: 0, last_progress_at: now, created_at: now, updated_at: now,
        achievement: { id: 'a-1', name: 'Course Explorer', description: 'Complete 10 lessons', icon_url: null, achievement_type: 'progress', category: 'learning', target_value: 10, points_reward: 100, xp_reward: 50, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
        progress_percent: 70 },
    ],
    current_streak: { id: 's-1', user_id: userId, streak_type: 'daily_login', current_streak: 7, longest_streak: 14, last_activity_date: new Date().toISOString().split('T')[0], streak_start_date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0], course_id: null, created_at: now, updated_at: now },
    global_rank: 42,
    recent_activity: [
      { id: 'pl-1', user_id: userId, points: 25, xp: 30, action_type: 'quiz_pass', action_id: null, description: 'Passed Quiz: Introduction to Web Development', course_id: null, metadata: {}, created_at: now },
    ],
  };
}

function getMockUserBadges(userId: string): UserBadge[] {
  const now = new Date().toISOString();
  return [
    { id: 'ub-1', user_id: userId, badge_id: 'b-1', earned_at: now, course_id: null, metadata: {},
      badge: { id: 'b-1', name: 'First Steps', description: 'Complete your first lesson', icon_url: null, badge_type: 'milestone', category: 'completion', rarity: 'common', points_value: 50, xp_value: 25, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
    { id: 'ub-2', user_id: userId, badge_id: 'b-2', earned_at: now, course_id: null, metadata: {},
      badge: { id: 'b-2', name: 'Quiz Master', description: 'Score 100% on any quiz', icon_url: null, badge_type: 'achievement', category: 'quiz', rarity: 'rare', points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
  ];
}

function getMockAllBadges(): Badge[] {
  const now = new Date().toISOString();
  return [
    { id: 'b-1', name: 'First Steps', description: 'Complete your first lesson', icon_url: null, badge_type: 'milestone', category: 'completion', rarity: 'common', points_value: 50, xp_value: 25, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: 'b-2', name: 'Quiz Master', description: 'Score 100% on any quiz', icon_url: null, badge_type: 'achievement', category: 'quiz', rarity: 'rare', points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: 'b-3', name: 'Week Warrior', description: '7-day login streak', icon_url: null, badge_type: 'milestone', category: 'streak', rarity: 'uncommon', points_value: 75, xp_value: 50, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: 'b-4', name: 'Course Champion', description: 'Complete your first course', icon_url: null, badge_type: 'achievement', category: 'completion', rarity: 'epic', points_value: 200, xp_value: 150, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
  ];
}

function getMockUserAchievements(userId: string): UserAchievement[] {
  const now = new Date().toISOString();
  return [
    { id: 'ua-1', user_id: userId, achievement_id: 'a-1', current_value: 7, target_value: 10, completed_at: null, completion_count: 0, last_progress_at: now, created_at: now, updated_at: now,
      achievement: { id: 'a-1', name: 'Course Explorer', description: 'Complete 10 lessons', icon_url: null, achievement_type: 'progress', category: 'learning', target_value: 10, points_reward: 100, xp_reward: 50, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
      progress_percent: 70 },
    { id: 'ua-2', user_id: userId, achievement_id: 'a-2', current_value: 3, target_value: 5, completed_at: null, completion_count: 0, last_progress_at: now, created_at: now, updated_at: now,
      achievement: { id: 'a-2', name: 'Perfect Week', description: 'Complete 5 quizzes with 90%+ score', icon_url: null, achievement_type: 'challenge', category: 'mastery', target_value: 5, points_reward: 200, xp_reward: 150, badge_reward_id: null, is_active: true, is_repeatable: true, reset_period: 'weekly', course_id: null, created_at: now, updated_at: now },
      progress_percent: 60 },
  ];
}

function getMockStreaks(userId: string): Streak[] {
  const now = new Date();
  return [
    { id: 'streak-1', user_id: userId, streak_type: 'daily_login', current_streak: 7, longest_streak: 14, last_activity_date: now.toISOString().split('T')[0], streak_start_date: new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0], course_id: null, created_at: now.toISOString(), updated_at: now.toISOString() },
    { id: 'streak-2', user_id: userId, streak_type: 'daily_lesson', current_streak: 3, longest_streak: 10, last_activity_date: new Date(now.getTime() - 86400000).toISOString().split('T')[0], streak_start_date: new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0], course_id: null, created_at: now.toISOString(), updated_at: now.toISOString() },
  ];
}

function getMockLeaderboard(type: string): Leaderboard {
  const now = new Date().toISOString();
  return {
    id: 'lb-1',
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`,
    leaderboard_type: type as Leaderboard['leaderboard_type'],
    course_id: null, period_start: null, period_end: null,
    is_active: true, created_at: now, updated_at: now,
    entries: [
      { id: 'le-1', leaderboard_id: 'lb-1', user_id: 'user-1', rank: 1, score: 5420, previous_rank: 1, metadata: {}, updated_at: now, username: 'alex_learns', display_name: 'Alex Johnson', level: 12, rank_change: 0 },
      { id: 'le-2', leaderboard_id: 'lb-1', user_id: 'user-2', rank: 2, score: 4890, previous_rank: 3, metadata: {}, updated_at: now, username: 'sarah_tech', display_name: 'Sarah Chen', level: 11, rank_change: 1 },
      { id: 'le-3', leaderboard_id: 'lb-1', user_id: 'user-3', rank: 3, score: 4520, previous_rank: 2, metadata: {}, updated_at: now, username: 'mike_code', display_name: 'Mike Williams', level: 10, rank_change: -1 },
      { id: 'le-4', leaderboard_id: 'lb-1', user_id: 'user-4', rank: 4, score: 3980, previous_rank: 4, metadata: {}, updated_at: now, username: 'emily_dev', display_name: 'Emily Davis', level: 9, rank_change: 0 },
      { id: 'le-5', leaderboard_id: 'lb-1', user_id: 'user-5', rank: 5, score: 3650, previous_rank: 6, metadata: {}, updated_at: now, username: 'james_learn', display_name: 'James Brown', level: 8, rank_change: 1 },
    ],
    total_participants: 156,
  };
}

function getMockUserRank(userId: string): LeaderboardEntry {
  const now = new Date().toISOString();
  return { id: 'le-user', leaderboard_id: 'lb-1', user_id: userId, rank: 42, score: 1250, previous_rank: 45, metadata: {}, updated_at: now, username: 'current_user', display_name: 'You', level: 5, rank_change: 3 };
}

// =============================================================================
// API Functions
// =============================================================================

export async function getGamificationDashboard(userId: string): Promise<GamificationDashboard> {
  try {
    const response = await sbFetch(`${BASE}/dashboard/${userId}`);
    if (!response.ok) {
      console.warn('Gamification API returned error, using mock data');
      return getMockDashboard(userId);
    }
    return response.json();
  } catch (error) {
    console.warn('Gamification API unavailable, using mock data:', error);
    return getMockDashboard(userId);
  }
}

export async function getUserPoints(userId: string): Promise<UserPointsSummary> {
  const response = await sbFetch(`${BASE}/users/${userId}/points`);
  if (!response.ok) throw new Error('Failed to fetch user points');
  return response.json();
}

export async function getUserBadges(userId: string, courseId?: string): Promise<UserBadge[]> {
  try {
    let url = `${BASE}/users/${userId}/badges`;
    if (courseId) url += `?course_id=${courseId}`;
    const response = await sbFetch(url);
    if (!response.ok) return getMockUserBadges(userId);
    return response.json();
  } catch {
    return getMockUserBadges(userId);
  }
}

export async function getAllBadges(courseId?: string, category?: string): Promise<Badge[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    if (category) params.set('category', category);
    const qs = params.toString();
    const response = await sbFetch(`${BASE}/badges${qs ? '?' + qs : ''}`);
    if (!response.ok) return getMockAllBadges();
    return response.json();
  } catch {
    return getMockAllBadges();
  }
}

export async function getUserAchievements(
  userId: string,
  courseId?: string,
  includeIncomplete = true,
): Promise<UserAchievement[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    params.set('include_incomplete', includeIncomplete.toString());
    const response = await sbFetch(`${BASE}/users/${userId}/achievements?${params}`);
    if (!response.ok) return getMockUserAchievements(userId);
    return response.json();
  } catch {
    return getMockUserAchievements(userId);
  }
}

export async function getAllAchievements(courseId?: string, category?: string): Promise<Achievement[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    if (category) params.set('category', category);
    const qs = params.toString();
    const response = await sbFetch(`${BASE}/achievements${qs ? '?' + qs : ''}`);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function getLeaderboard(
  type: 'global' | 'course' | 'weekly' | 'monthly' = 'global',
  courseId?: string,
  limit = 100,
): Promise<Leaderboard> {
  try {
    const params = new URLSearchParams();
    params.set('leaderboard_type', type);
    if (courseId) params.set('course_id', courseId);
    params.set('limit', limit.toString());
    const response = await sbFetch(`${BASE}/leaderboards?${params}`);
    if (!response.ok) return getMockLeaderboard(type);
    return response.json();
  } catch {
    return getMockLeaderboard(type);
  }
}

export async function getUserRank(
  userId: string,
  type: 'global' | 'course' | 'weekly' | 'monthly' = 'global',
  courseId?: string,
): Promise<LeaderboardEntry> {
  try {
    const params = new URLSearchParams();
    params.set('leaderboard_type', type);
    if (courseId) params.set('course_id', courseId);
    const response = await sbFetch(`${BASE}/users/${userId}/rank?${params}`);
    if (!response.ok) return getMockUserRank(userId);
    return response.json();
  } catch {
    return getMockUserRank(userId);
  }
}

export async function getUserStreaks(userId: string): Promise<Streak[]> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/streaks`);
    if (!response.ok) return getMockStreaks(userId);
    return response.json();
  } catch {
    return getMockStreaks(userId);
  }
}

export async function updateStreak(
  userId: string,
  streakType: 'daily_login' | 'daily_lesson' | 'daily_quiz' = 'daily_login',
  courseId?: string,
): Promise<Streak> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/streaks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streak_type: streakType, course_id: courseId }),
    });
    if (!response.ok) return getMockStreaks(userId)[0];
    return response.json();
  } catch {
    return getMockStreaks(userId)[0];
  }
}

export async function getPointsHistory(userId: string, courseId?: string, limit = 50): Promise<PointsLedgerEntry[]> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    params.set('limit', limit.toString());
    const response = await sbFetch(`${BASE}/users/${userId}/points/history?${params}`);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function getXPLevels(): Promise<XPLevel[]> {
  try {
    const response = await sbFetch(`${BASE}/xp-levels`);
    if (!response.ok) return getMockXPLevels();
    return response.json();
  } catch {
    return getMockXPLevels();
  }
}

function getMockXPLevels(): XPLevel[] {
  return [
    { level: 1, xp_required: 0, title: 'Newcomer', perks: [], badge_id: 'seedling' },
    { level: 2, xp_required: 100, title: 'Explorer', perks: [], badge_id: 'compass' },
    { level: 3, xp_required: 250, title: 'Learner', perks: [], badge_id: 'book' },
    { level: 4, xp_required: 500, title: 'Achiever', perks: [], badge_id: 'star' },
    { level: 5, xp_required: 1000, title: 'Scholar', perks: [], badge_id: 'graduation-cap' },
    { level: 6, xp_required: 2000, title: 'Expert', perks: [], badge_id: 'award' },
    { level: 7, xp_required: 3500, title: 'Master', perks: [], badge_id: 'trophy' },
    { level: 8, xp_required: 5500, title: 'Champion', perks: [], badge_id: 'crown' },
    { level: 9, xp_required: 8000, title: 'Legend', perks: [], badge_id: 'gem' },
    { level: 10, xp_required: 12000, title: 'Grandmaster', perks: [], badge_id: 'sun' },
  ];
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getRarityColor(rarity: Badge['rarity']): string {
  const colors: Record<string, string> = {
    common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B',
  };
  return colors[rarity] || colors.common;
}

export function getRarityBgColor(rarity: Badge['rarity']): string {
  const colors: Record<string, string> = {
    common: 'rgba(156, 163, 175, 0.1)', uncommon: 'rgba(16, 185, 129, 0.1)',
    rare: 'rgba(59, 130, 246, 0.1)', epic: 'rgba(139, 92, 246, 0.1)',
    legendary: 'rgba(245, 158, 11, 0.1)',
  };
  return colors[rarity] || colors.common;
}

export function getActionTypeLabel(actionType: string): string {
  const labels: Record<string, string> = {
    lesson_complete: 'Completed Lesson', quiz_pass: 'Passed Quiz', quiz_perfect: 'Perfect Quiz Score',
    assignment_submit: 'Submitted Assignment', assignment_pass: 'Passed Assignment',
    course_complete: 'Completed Course', certificate_earn: 'Earned Certificate',
    streak_7_days: '7-Day Streak', streak_30_days: '30-Day Streak', first_login: 'Daily Login',
    discussion_post: 'Discussion Post', peer_review: 'Peer Review', help_peer: 'Helped Peer',
    badge_earn: 'Earned Badge', achievement_complete: 'Achievement Completed',
    live_session_attend: 'Attended Live Session',
  };
  return labels[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPoints(points: number): string {
  return points >= 0 ? `+${points}` : `${points}`;
}

export function getStreakTypeLabel(streakType: string): string {
  const labels: Record<string, string> = {
    daily_login: 'Login Streak', daily_lesson: 'Lesson Streak', daily_quiz: 'Quiz Streak',
  };
  return labels[streakType] || streakType;
}
