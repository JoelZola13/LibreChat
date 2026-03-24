/**
 * Academy Gamification API Integration
 */

const API_BASE = '/sbapi';
const GAMIFICATION_API = `${API_BASE}/academy/gamification`;

// =============================================================================
// Types
// =============================================================================

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  badge_type: "achievement" | "milestone" | "skill" | "special";
  category: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
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
  achievement_type: "progress" | "milestone" | "challenge" | "daily" | "weekly";
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
  leaderboard_type: "global" | "course" | "weekly" | "monthly" | "all_time";
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
  streak_type: "daily_login" | "daily_lesson" | "daily_quiz";
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
// API Functions
// =============================================================================

/**
 * Get user's full gamification dashboard
 */
export async function getGamificationDashboard(userId: string): Promise<GamificationDashboard> {
  try {
    const response = await fetch(`${GAMIFICATION_API}/dashboard/${userId}`);
    if (!response.ok) {
      console.warn("Gamification API returned error, using mock data");
      return getMockDashboard(userId);
    }
    return response.json();
  } catch (error) {
    console.warn("Gamification API unavailable, using mock data:", error);
    return getMockDashboard(userId);
  }
}

/**
 * Get mock dashboard data for development/fallback
 */
function getMockDashboard(userId: string): GamificationDashboard {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    points_summary: {
      id: "mock-1",
      user_id: userId,
      total_points: 1250,
      total_xp: 875,
      level: 5,
      current_level_xp: 375,
      xp_to_next_level: 625,
      lifetime_points: 1250,
      weekly_points: 150,
      monthly_points: 450,
      current_streak: 7,
      longest_streak: 14,
      last_activity_date: new Date().toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    },
    level_info: {
      level: 5,
      title: "Apprentice",
      current_level_xp: 375,
      xp_to_next_level: 625,
      progress_percent: 37.5,
    },
    badges_earned: 8,
    badges_total: 25,
    recent_badges: [
      {
        id: "ub-1",
        user_id: userId,
        badge_id: "b-1",
        earned_at: now,
        course_id: null,
        metadata: {},
        badge: {
          id: "b-1",
          name: "First Steps",
          description: "Complete your first lesson",
          icon_url: null,
          badge_type: "milestone",
          category: "completion",
          rarity: "common",
          points_value: 50,
          xp_value: 25,
          is_active: true,
          is_secret: false,
          course_id: null,
          created_at: now,
          updated_at: now,
        },
      },
      {
        id: "ub-2",
        user_id: userId,
        badge_id: "b-2",
        earned_at: now,
        course_id: null,
        metadata: {},
        badge: {
          id: "b-2",
          name: "Quiz Master",
          description: "Score 100% on any quiz",
          icon_url: null,
          badge_type: "achievement",
          category: "quiz",
          rarity: "rare",
          points_value: 100,
          xp_value: 75,
          is_active: true,
          is_secret: false,
          course_id: null,
          created_at: now,
          updated_at: now,
        },
      },
    ],
    achievements_completed: 5,
    achievements_total: 20,
    active_achievements: [
      {
        id: "ua-1",
        user_id: userId,
        achievement_id: "a-1",
        current_value: 7,
        target_value: 10,
        completed_at: null,
        completion_count: 0,
        last_progress_at: now,
        created_at: now,
        updated_at: now,
        achievement: {
          id: "a-1",
          name: "Course Explorer",
          description: "Complete 10 lessons",
          icon_url: null,
          achievement_type: "progress",
          category: "learning",
          target_value: 10,
          points_reward: 100,
          xp_reward: 50,
          badge_reward_id: null,
          is_active: true,
          is_repeatable: false,
          reset_period: null,
          course_id: null,
          created_at: now,
          updated_at: now,
        },
        progress_percent: 70,
      },
      {
        id: "ua-2",
        user_id: userId,
        achievement_id: "a-2",
        current_value: 3,
        target_value: 5,
        completed_at: null,
        completion_count: 0,
        last_progress_at: now,
        created_at: now,
        updated_at: now,
        achievement: {
          id: "a-2",
          name: "Perfect Week",
          description: "Complete 5 quizzes with 90%+ score",
          icon_url: null,
          achievement_type: "challenge",
          category: "mastery",
          target_value: 5,
          points_reward: 200,
          xp_reward: 150,
          badge_reward_id: null,
          is_active: true,
          is_repeatable: true,
          reset_period: "weekly",
          course_id: null,
          created_at: now,
          updated_at: now,
        },
        progress_percent: 60,
      },
    ],
    current_streak: {
      id: "s-1",
      user_id: userId,
      streak_type: "daily_login",
      current_streak: 7,
      longest_streak: 14,
      last_activity_date: new Date().toISOString().split('T')[0],
      streak_start_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      course_id: null,
      created_at: now,
      updated_at: now,
    },
    global_rank: 42,
    recent_activity: [
      {
        id: "pl-1",
        user_id: userId,
        points: 25,
        xp: 30,
        action_type: "quiz_pass",
        action_id: null,
        description: "Passed Quiz: Introduction to Web Development",
        course_id: null,
        metadata: {},
        created_at: now,
      },
      {
        id: "pl-2",
        user_id: userId,
        points: 10,
        xp: 15,
        action_type: "lesson_complete",
        action_id: null,
        description: "Completed Lesson: HTML Basics",
        course_id: null,
        metadata: {},
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "pl-3",
        user_id: userId,
        points: 5,
        xp: 10,
        action_type: "first_login",
        action_id: null,
        description: "Daily first login",
        course_id: null,
        metadata: {},
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

/**
 * Get user's points summary
 */
export async function getUserPoints(userId: string): Promise<UserPointsSummary> {
  const response = await fetch(`${GAMIFICATION_API}/users/${userId}/points`);
  if (!response.ok) {
    throw new Error("Failed to fetch user points");
  }
  return response.json();
}

/**
 * Get user's earned badges
 */
export async function getUserBadges(userId: string, courseId?: string): Promise<UserBadge[]> {
  try {
    const url = new URL(`${GAMIFICATION_API}/users/${userId}/badges`);
    if (courseId) url.searchParams.set("course_id", courseId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockUserBadges(userId);
    }
    return response.json();
  } catch {
    return getMockUserBadges(userId);
  }
}

function getMockUserBadges(userId: string): UserBadge[] {
  const now = new Date().toISOString();
  return [
    { id: "ub-1", user_id: userId, badge_id: "b-1", earned_at: now, course_id: null, metadata: {}, badge: { id: "b-1", name: "First Steps", description: "Complete your first lesson", icon_url: null, badge_type: "milestone", category: "completion", rarity: "common", points_value: 50, xp_value: 25, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
    { id: "ub-2", user_id: userId, badge_id: "b-2", earned_at: now, course_id: null, metadata: {}, badge: { id: "b-2", name: "Quiz Master", description: "Score 100% on any quiz", icon_url: null, badge_type: "achievement", category: "quiz", rarity: "rare", points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
    { id: "ub-3", user_id: userId, badge_id: "b-3", earned_at: now, course_id: null, metadata: {}, badge: { id: "b-3", name: "Week Warrior", description: "7-day login streak", icon_url: null, badge_type: "milestone", category: "streak", rarity: "uncommon", points_value: 75, xp_value: 50, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now } },
  ];
}

/**
 * Get all available badges
 */
export async function getAllBadges(courseId?: string, category?: string): Promise<Badge[]> {
  try {
    const url = new URL(`${GAMIFICATION_API}/badges`);
    if (courseId) url.searchParams.set("course_id", courseId);
    if (category) url.searchParams.set("category", category);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockAllBadges();
    }
    return response.json();
  } catch {
    return getMockAllBadges();
  }
}

function getMockAllBadges(): Badge[] {
  const now = new Date().toISOString();
  return [
    { id: "b-1", name: "First Steps", description: "Complete your first lesson", icon_url: null, badge_type: "milestone", category: "completion", rarity: "common", points_value: 50, xp_value: 25, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-2", name: "Quiz Master", description: "Score 100% on any quiz", icon_url: null, badge_type: "achievement", category: "quiz", rarity: "rare", points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-3", name: "Week Warrior", description: "7-day login streak", icon_url: null, badge_type: "milestone", category: "streak", rarity: "uncommon", points_value: 75, xp_value: 50, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-4", name: "Course Champion", description: "Complete your first course", icon_url: null, badge_type: "achievement", category: "completion", rarity: "epic", points_value: 200, xp_value: 150, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-5", name: "Social Butterfly", description: "Post 10 discussion comments", icon_url: null, badge_type: "achievement", category: "social", rarity: "uncommon", points_value: 50, xp_value: 30, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-6", name: "Perfect Month", description: "30-day login streak", icon_url: null, badge_type: "milestone", category: "streak", rarity: "epic", points_value: 300, xp_value: 200, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-7", name: "Helping Hand", description: "Help 5 peers", icon_url: null, badge_type: "achievement", category: "social", rarity: "rare", points_value: 100, xp_value: 75, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
    { id: "b-8", name: "Legendary Learner", description: "Complete 10 courses", icon_url: null, badge_type: "milestone", category: "completion", rarity: "legendary", points_value: 500, xp_value: 400, is_active: true, is_secret: false, course_id: null, created_at: now, updated_at: now },
  ];
}

/**
 * Get user's achievements with progress
 */
export async function getUserAchievements(
  userId: string,
  courseId?: string,
  includeIncomplete: boolean = true
): Promise<UserAchievement[]> {
  try {
    const url = new URL(`${GAMIFICATION_API}/users/${userId}/achievements`);
    if (courseId) url.searchParams.set("course_id", courseId);
    url.searchParams.set("include_incomplete", includeIncomplete.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockUserAchievements(userId);
    }
    return response.json();
  } catch {
    return getMockUserAchievements(userId);
  }
}

function getMockUserAchievements(userId: string): UserAchievement[] {
  const now = new Date().toISOString();
  return [
    { id: "ua-1", user_id: userId, achievement_id: "a-1", current_value: 7, target_value: 10, completed_at: null, completion_count: 0, last_progress_at: now, created_at: now, updated_at: now, achievement: { id: "a-1", name: "Course Explorer", description: "Complete 10 lessons", icon_url: null, achievement_type: "progress", category: "learning", target_value: 10, points_reward: 100, xp_reward: 50, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now }, progress_percent: 70 },
    { id: "ua-2", user_id: userId, achievement_id: "a-2", current_value: 3, target_value: 5, completed_at: null, completion_count: 0, last_progress_at: now, created_at: now, updated_at: now, achievement: { id: "a-2", name: "Perfect Week", description: "Complete 5 quizzes with 90%+ score", icon_url: null, achievement_type: "challenge", category: "mastery", target_value: 5, points_reward: 200, xp_reward: 150, badge_reward_id: null, is_active: true, is_repeatable: true, reset_period: "weekly", course_id: null, created_at: now, updated_at: now }, progress_percent: 60 },
    { id: "ua-3", user_id: userId, achievement_id: "a-3", current_value: 5, target_value: 5, completed_at: now, completion_count: 1, last_progress_at: now, created_at: now, updated_at: now, achievement: { id: "a-3", name: "Discussion Starter", description: "Post 5 discussion comments", icon_url: null, achievement_type: "progress", category: "social", target_value: 5, points_reward: 50, xp_reward: 30, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now }, progress_percent: 100 },
  ];
}

/**
 * Get all achievements
 */
export async function getAllAchievements(courseId?: string, category?: string): Promise<Achievement[]> {
  try {
    const url = new URL(`${GAMIFICATION_API}/achievements`);
    if (courseId) url.searchParams.set("course_id", courseId);
    if (category) url.searchParams.set("category", category);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockAllAchievements();
    }
    return response.json();
  } catch {
    return getMockAllAchievements();
  }
}

function getMockAllAchievements(): Achievement[] {
  const now = new Date().toISOString();
  return [
    { id: "a-1", name: "Course Explorer", description: "Complete 10 lessons", icon_url: null, achievement_type: "progress", category: "learning", target_value: 10, points_reward: 100, xp_reward: 50, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
    { id: "a-2", name: "Perfect Week", description: "Complete 5 quizzes with 90%+ score", icon_url: null, achievement_type: "challenge", category: "mastery", target_value: 5, points_reward: 200, xp_reward: 150, badge_reward_id: null, is_active: true, is_repeatable: true, reset_period: "weekly", course_id: null, created_at: now, updated_at: now },
    { id: "a-3", name: "Discussion Starter", description: "Post 5 discussion comments", icon_url: null, achievement_type: "progress", category: "social", target_value: 5, points_reward: 50, xp_reward: 30, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
    { id: "a-4", name: "Streak Master", description: "Maintain a 30-day streak", icon_url: null, achievement_type: "milestone", category: "streak", target_value: 30, points_reward: 300, xp_reward: 200, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
    { id: "a-5", name: "Course Completionist", description: "Complete 3 courses", icon_url: null, achievement_type: "progress", category: "learning", target_value: 3, points_reward: 500, xp_reward: 300, badge_reward_id: null, is_active: true, is_repeatable: false, reset_period: null, course_id: null, created_at: now, updated_at: now },
  ];
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  type: "global" | "course" | "weekly" | "monthly" = "global",
  courseId?: string,
  limit: number = 100
): Promise<Leaderboard> {
  try {
    const url = new URL(`${GAMIFICATION_API}/leaderboards`);
    url.searchParams.set("leaderboard_type", type);
    if (courseId) url.searchParams.set("course_id", courseId);
    url.searchParams.set("limit", limit.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockLeaderboard(type);
    }
    return response.json();
  } catch {
    return getMockLeaderboard(type);
  }
}

function getMockLeaderboard(type: string): Leaderboard {
  const now = new Date().toISOString();
  return {
    id: "lb-1",
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`,
    leaderboard_type: type as "global" | "course" | "weekly" | "monthly" | "all_time",
    course_id: null,
    period_start: null,
    period_end: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    entries: [
      { id: "le-1", leaderboard_id: "lb-1", user_id: "user-1", rank: 1, score: 5420, previous_rank: 1, metadata: {}, updated_at: now, username: "alex_learns", display_name: "Alex Johnson", avatar_url: undefined, level: 12, rank_change: 0 },
      { id: "le-2", leaderboard_id: "lb-1", user_id: "user-2", rank: 2, score: 4890, previous_rank: 3, metadata: {}, updated_at: now, username: "sarah_tech", display_name: "Sarah Chen", avatar_url: undefined, level: 11, rank_change: 1 },
      { id: "le-3", leaderboard_id: "lb-1", user_id: "user-3", rank: 3, score: 4520, previous_rank: 2, metadata: {}, updated_at: now, username: "mike_code", display_name: "Mike Williams", avatar_url: undefined, level: 10, rank_change: -1 },
      { id: "le-4", leaderboard_id: "lb-1", user_id: "user-4", rank: 4, score: 3980, previous_rank: 4, metadata: {}, updated_at: now, username: "emily_dev", display_name: "Emily Davis", avatar_url: undefined, level: 9, rank_change: 0 },
      { id: "le-5", leaderboard_id: "lb-1", user_id: "user-5", rank: 5, score: 3650, previous_rank: 6, metadata: {}, updated_at: now, username: "james_learn", display_name: "James Brown", avatar_url: undefined, level: 8, rank_change: 1 },
      { id: "le-6", leaderboard_id: "lb-1", user_id: "user-6", rank: 6, score: 3200, previous_rank: 5, metadata: {}, updated_at: now, username: "lisa_student", display_name: "Lisa Miller", avatar_url: undefined, level: 8, rank_change: -1 },
      { id: "le-7", leaderboard_id: "lb-1", user_id: "user-7", rank: 7, score: 2890, previous_rank: 8, metadata: {}, updated_at: now, username: "david_pro", display_name: "David Garcia", avatar_url: undefined, level: 7, rank_change: 1 },
      { id: "le-8", leaderboard_id: "lb-1", user_id: "user-8", rank: 8, score: 2450, previous_rank: 7, metadata: {}, updated_at: now, username: "anna_ace", display_name: "Anna Martinez", avatar_url: undefined, level: 6, rank_change: -1 },
    ],
    total_participants: 156,
  };
}

/**
 * Get user's rank on leaderboard
 */
export async function getUserRank(
  userId: string,
  type: "global" | "course" | "weekly" | "monthly" = "global",
  courseId?: string
): Promise<LeaderboardEntry> {
  try {
    const url = new URL(`${GAMIFICATION_API}/users/${userId}/rank`);
    url.searchParams.set("leaderboard_type", type);
    if (courseId) url.searchParams.set("course_id", courseId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockUserRank(userId);
    }
    return response.json();
  } catch {
    return getMockUserRank(userId);
  }
}

function getMockUserRank(userId: string): LeaderboardEntry {
  const now = new Date().toISOString();
  return {
    id: "le-user",
    leaderboard_id: "lb-1",
    user_id: userId,
    rank: 42,
    score: 1250,
    previous_rank: 45,
    metadata: {},
    updated_at: now,
    username: "current_user",
    display_name: "You",
    avatar_url: undefined,
    level: 5,
    rank_change: 3,
  };
}

/**
 * Get user's streaks
 */
export async function getUserStreaks(userId: string): Promise<Streak[]> {
  try {
    const response = await fetch(`${GAMIFICATION_API}/users/${userId}/streaks`);
    if (!response.ok) {
      console.warn("Streaks API returned error, using mock data");
      return getMockStreaks(userId);
    }
    return response.json();
  } catch {
    console.warn("Streaks API unavailable, using mock data");
    return getMockStreaks(userId);
  }
}

function getMockStreaks(userId: string): Streak[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return [
    {
      id: "streak-1",
      user_id: userId,
      streak_type: "daily_login" as const,
      current_streak: 7,
      longest_streak: 14,
      last_activity_date: now.toISOString().split("T")[0],
      streak_start_date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      course_id: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: "streak-2",
      user_id: userId,
      streak_type: "daily_lesson" as const,
      current_streak: 3,
      longest_streak: 10,
      last_activity_date: yesterday.toISOString().split("T")[0],
      streak_start_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      course_id: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
}

/**
 * Update streak (e.g., on login)
 */
export async function updateStreak(
  userId: string,
  streakType: "daily_login" | "daily_lesson" | "daily_quiz" = "daily_login",
  courseId?: string
): Promise<Streak> {
  try {
    const response = await fetch(`${GAMIFICATION_API}/users/${userId}/streaks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streak_type: streakType, course_id: courseId }),
    });
    if (!response.ok) {
      console.warn("Update streak API returned error, using mock data");
      return getMockUpdatedStreak(userId, streakType, courseId);
    }
    return response.json();
  } catch {
    console.warn("Update streak API unavailable, using mock data");
    return getMockUpdatedStreak(userId, streakType, courseId);
  }
}

function getMockUpdatedStreak(
  userId: string,
  streakType: "daily_login" | "daily_lesson" | "daily_quiz",
  courseId?: string
): Streak {
  const now = new Date();
  return {
    id: `streak-${streakType}`,
    user_id: userId,
    course_id: courseId ?? null,
    streak_type: streakType,
    current_streak: 8, // Simulates increment
    longest_streak: 14,
    last_activity_date: now.toISOString().split("T")[0],
    streak_start_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Get points history
 */
export async function getPointsHistory(
  userId: string,
  courseId?: string,
  limit: number = 50
): Promise<PointsLedgerEntry[]> {
  try {
    const url = new URL(`${GAMIFICATION_API}/users/${userId}/points/history`);
    if (courseId) url.searchParams.set("course_id", courseId);
    url.searchParams.set("limit", limit.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn("Points history API returned error, using mock data");
      return getMockPointsHistory(userId, limit);
    }
    return response.json();
  } catch {
    console.warn("Points history API unavailable, using mock data");
    return getMockPointsHistory(userId, limit);
  }
}

function getMockPointsHistory(userId: string, limit: number): PointsLedgerEntry[] {
  const now = new Date();
  const actions = [
    { type: "lesson_complete", points: 10, desc: "Completed Introduction to Housing Rights" },
    { type: "quiz_pass", points: 25, desc: "Passed Housing Rights Quiz" },
    { type: "first_login", points: 5, desc: "Daily login bonus" },
    { type: "discussion_post", points: 5, desc: "Posted in Discussion Forum" },
    { type: "streak_7_days", points: 50, desc: "7-day streak achieved!" },
    { type: "assignment_submit", points: 15, desc: "Submitted Assignment 1" },
  ];

  return actions.slice(0, Math.min(limit, actions.length)).map((action, index) => {
    const date = new Date(now);
    date.setHours(date.getHours() - index * 6);
    return {
      id: `pl-${index}`,
      user_id: userId,
      action_type: action.type,
      action_id: null,
      points: action.points,
      xp: action.points * 2, // XP is typically double points
      description: action.desc,
      course_id: null,
      metadata: {},
      created_at: date.toISOString(),
    };
  });
}

/**
 * Get XP level configuration
 */
export async function getXPLevels(): Promise<XPLevel[]> {
  try {
    const response = await fetch(`${GAMIFICATION_API}/xp-levels`);
    if (!response.ok) {
      console.warn("XP levels API returned error, using mock data");
      return getMockXPLevels();
    }
    return response.json();
  } catch {
    console.warn("XP levels API unavailable, using mock data");
    return getMockXPLevels();
  }
}

function getMockXPLevels(): XPLevel[] {
  return [
    { level: 1, xp_required: 0, title: "Newcomer", perks: [], badge_id: "seedling" },
    { level: 2, xp_required: 100, title: "Explorer", perks: [], badge_id: "compass" },
    { level: 3, xp_required: 250, title: "Learner", perks: [], badge_id: "book" },
    { level: 4, xp_required: 500, title: "Achiever", perks: [], badge_id: "star" },
    { level: 5, xp_required: 1000, title: "Scholar", perks: [], badge_id: "graduation-cap" },
    { level: 6, xp_required: 2000, title: "Expert", perks: [], badge_id: "award" },
    { level: 7, xp_required: 3500, title: "Master", perks: [], badge_id: "trophy" },
    { level: 8, xp_required: 5500, title: "Champion", perks: [], badge_id: "crown" },
    { level: 9, xp_required: 8000, title: "Legend", perks: [], badge_id: "gem" },
    { level: 10, xp_required: 12000, title: "Grandmaster", perks: [], badge_id: "sun" },
  ];
}

/**
 * Calculate level from XP
 */
export async function calculateLevel(totalXp: number): Promise<{
  level: number;
  title: string;
  current_level_xp: number;
  xp_to_next: number;
  progress_percent: number;
}> {
  try {
    const response = await fetch(`${GAMIFICATION_API}/xp-levels/calculate?total_xp=${totalXp}`);
    if (!response.ok) {
      console.warn("Calculate level API returned error, using mock calculation");
      return calculateLevelFromMock(totalXp);
    }
    return response.json();
  } catch {
    console.warn("Calculate level API unavailable, using mock calculation");
    return calculateLevelFromMock(totalXp);
  }
}

function calculateLevelFromMock(totalXp: number): {
  level: number;
  title: string;
  current_level_xp: number;
  xp_to_next: number;
  progress_percent: number;
} {
  const levels = getMockXPLevels();
  let currentLevel = levels[0];
  let nextLevelXp = levels[1]?.xp_required ?? 100;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const nextLevel = levels[i + 1];
    const maxXpForLevel = nextLevel ? nextLevel.xp_required - 1 : 999999;

    if (totalXp >= level.xp_required && totalXp <= maxXpForLevel) {
      currentLevel = level;
      nextLevelXp = nextLevel?.xp_required ?? maxXpForLevel + 1;
      break;
    }
  }

  const xpInLevel = totalXp - currentLevel.xp_required;
  const levelRange = nextLevelXp - currentLevel.xp_required;
  const xpToNext = nextLevelXp - totalXp;
  const progressPercent = Math.min(100, (xpInLevel / levelRange) * 100);

  return {
    level: currentLevel.level,
    title: currentLevel.title ?? "Unknown",
    current_level_xp: xpInLevel,
    xp_to_next: xpToNext,
    progress_percent: progressPercent,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get rarity color for badges
 */
export function getRarityColor(rarity: Badge["rarity"]): string {
  const colors = {
    common: "#9CA3AF",     // Gray
    uncommon: "#10B981",   // Green
    rare: "#3B82F6",       // Blue
    epic: "#8B5CF6",       // Purple
    legendary: "#F59E0B",  // Amber/Gold
  };
  return colors[rarity] || colors.common;
}

/**
 * Get rarity background color (with opacity)
 */
export function getRarityBgColor(rarity: Badge["rarity"]): string {
  const colors = {
    common: "rgba(156, 163, 175, 0.1)",
    uncommon: "rgba(16, 185, 129, 0.1)",
    rare: "rgba(59, 130, 246, 0.1)",
    epic: "rgba(139, 92, 246, 0.1)",
    legendary: "rgba(245, 158, 11, 0.1)",
  };
  return colors[rarity] || colors.common;
}

/**
 * Get action type label
 */
export function getActionTypeLabel(actionType: string): string {
  const labels: Record<string, string> = {
    lesson_complete: "Completed Lesson",
    quiz_pass: "Passed Quiz",
    quiz_perfect: "Perfect Quiz Score",
    assignment_submit: "Submitted Assignment",
    assignment_pass: "Passed Assignment",
    course_complete: "Completed Course",
    certificate_earn: "Earned Certificate",
    streak_7_days: "7-Day Streak",
    streak_30_days: "30-Day Streak",
    first_login: "Daily Login",
    discussion_post: "Discussion Post",
    peer_review: "Peer Review",
    help_peer: "Helped Peer",
    badge_earn: "Earned Badge",
    achievement_complete: "Achievement Completed",
    live_session_attend: "Attended Live Session",
  };
  return labels[actionType] || actionType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format points with sign
 */
export function formatPoints(points: number): string {
  return points >= 0 ? `+${points}` : `${points}`;
}

/**
 * Get streak type label
 */
export function getStreakTypeLabel(streakType: string): string {
  const labels: Record<string, string> = {
    daily_login: "Login Streak",
    daily_lesson: "Lesson Streak",
    daily_quiz: "Quiz Streak",
  };
  return labels[streakType] || streakType;
}
