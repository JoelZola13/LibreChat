import { Compass, type LucideIcon, Mic } from 'lucide-react';

export type AcademyLearningPath = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  courses: number;
  hours: number;
  level: string;
  deliveryMode: string;
  durationLabel?: string;
  color: string;
  icon: LucideIcon;
  requirements: string[];
  whatYoullLearn: string[];
  milestones: string[];
  outcomes: string[];
  preferredCategories: string[];
  courseIds?: string[];
  courseTitles?: string[];
  schedule?: AcademyProgramScheduleBlock[];
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: 'built-in' | 'generated';
};

export type AcademyProgramScheduleBlock = {
  title: string;
  month: string;
  dates: string[];
};

export type AcademyGoalOption = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  recommendedPathSlugs: string[];
  preferredCourseKeywords: string[];
};

export const academyLearningPaths: AcademyLearningPath[] = [
  {
    slug: 'street-voices-media-training',
    title: 'Street Voices Media Training',
    description:
      'A focused August-November media program moving through journalism, videography, broadcasting, and Networking with Kadiatu on Wednesday evenings.',
    courses: 4,
    hours: 34,
    level: 'Beginner to Intermediate',
    deliveryMode: 'In person and live stream',
    durationLabel: 'August-November 2026',
    color: '#A855F7',
    icon: Mic,
    requirements: [
      'No previous media experience required',
      'Ready to practice storytelling, collaboration, and hands-on workshop work',
      'Able to join in-person or live support sessions',
    ],
    whatYoullLearn: [
      'How to report and shape community stories through journalism',
      'How to capture strong visuals through videography and broadcasting',
      'How to build relationships and present yourself through Networking with Kadiatu',
    ],
    milestones: [
      'August Wednesdays: Journalism',
      'September Wednesdays: Videography',
      'October Wednesdays: Broadcasting',
      'November Wednesdays: Networking with Kadiatu',
    ],
    outcomes: [
      'Media storytelling confidence',
      'Hands-on creative communication skills',
      'Better networking and presentation skills',
    ],
    preferredCategories: [
      'media',
      'storytelling',
      'creative',
      'journalism',
      'video',
      'videography',
      'broadcasting',
      'networking',
    ],
    courseTitles: ['Journalism', 'Videography', 'Broadcasting', 'Networking with Kadiatu'],
    schedule: [
      {
        title: 'Journalism',
        month: 'August 2026',
        dates: ['Aug 5', 'Aug 12', 'Aug 19', 'Aug 26'],
      },
      {
        title: 'Videography',
        month: 'September 2026',
        dates: ['Sep 2', 'Sep 9', 'Sep 16', 'Sep 23', 'Sep 30'],
      },
      {
        title: 'Broadcasting',
        month: 'October 2026',
        dates: ['Oct 7', 'Oct 14', 'Oct 21', 'Oct 28'],
      },
      {
        title: 'Networking with Kadiatu',
        month: 'November 2026',
        dates: ['Nov 4', 'Nov 11', 'Nov 18', 'Nov 25'],
      },
    ],
  },
];

export const academyGoalOptions: AcademyGoalOption[] = [
  {
    id: 'media-training',
    title: 'Media Training',
    description:
      'Explore journalism, videography, broadcasting, and Networking with Kadiatu in one guided program.',
    icon: Mic,
    color: '#A855F7',
    recommendedPathSlugs: ['street-voices-media-training'],
    preferredCourseKeywords: [
      'media',
      'journalism',
      'video',
      'videography',
      'broadcasting',
      'storytelling',
      'networking',
    ],
  },
];

const HIDDEN_SAMPLE_PROGRAM_SLUGS = new Set([
  'job-ready',
  'digital-basics',
  'housing-stability',
  'gardening',
  'advocacy-confidence-path',
  'job-ready-communication-path',
  'digital-restart-path',
  'community-support-facilitation-path',
]);

const HIDDEN_SAMPLE_PROGRAM_TITLES = new Set([
  'job ready',
  'digital basics',
  'housing stability',
  'gardening',
  'advocacy confidence path',
  'job ready communication path',
  'digital restart path',
  'community support facilitation path',
]);

const HIDDEN_SAMPLE_COURSE_TITLES = new Set([
  'qa edited course',
  'test',
  'speaking up with confidence',
  'navigating systems',
  'know your rights',
  'ethics and boundaries',
  'sharing your story',
  'resource navigation',
  'crisis intervention basics',
  'active listening skills',
  'introduction to peer support',
  'navigating benefits',
  'understanding credit',
  'banking 101',
  'budgeting basics',
  'maintaining your home',
  'budgeting for housing',
  'know your rights as a tenant',
  'finding housing',
  'online job search',
  'smartphone skills',
  'email essentials',
  'getting started with computers',
  'workplace communication',
  'interview skills mastery',
  'resume writing workshop',
  'computer basics for beginners',
  'digital marketing fundamentals',
  'graphic design essentials',
  'entrepreneurship 101',
  'web development bootcamp',
]);

const HIDDEN_SAMPLE_COURSE_PATTERNS = [/\bqa\b/i, /\btest\b/i, /\bdemo\b/i, /\bsample\b/i];

function normalizeCatalogText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const PROGRAM_COURSE_TITLE_ALIASES: Record<string, string[]> = {
  journalism: ['journalism', 'photo journalism', 'photojournalism', 'intro to journalism'],
  videography: ['videography', 'videography basics', 'intro to videography'],
  broadcasting: [
    'broadcasting',
    'introduction to broadcasting',
    'introduction to podcasting',
    'podcasting fundamentals',
    'podcasting',
  ],
  'networking with kadiatu': ['networking with kadiatu', 'networking', 'effective networking'],
};

function getCourseTitleAliases(title: string) {
  const normalizedTitle = normalizeCatalogText(title);
  return PROGRAM_COURSE_TITLE_ALIASES[normalizedTitle] ?? [normalizedTitle];
}

export function getAcademyProgramCourseDisplayTitle(title?: string | null) {
  const normalizedTitle = normalizeCatalogText(title);
  const match = Object.entries(PROGRAM_COURSE_TITLE_ALIASES).find(([, aliases]) =>
    aliases.includes(normalizedTitle),
  );
  if (!match) {
    return String(title || '').trim();
  }

  if (match[0] === 'networking with kadiatu') {
    return 'Networking with Kadiatu';
  }

  return match[0].replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAcademyProgramCourseSchedule(
  path: AcademyLearningPath | null | undefined,
  title?: string | null,
) {
  const displayTitle = getAcademyProgramCourseDisplayTitle(title);
  return path?.schedule?.find(
    (item) => normalizeCatalogText(item.title) === normalizeCatalogText(displayTitle),
  );
}

export function isVisibleAcademyProgram(path: AcademyLearningPath) {
  const slug = normalizeCatalogText(path.slug);
  const title = normalizeCatalogText(path.title);
  return !HIDDEN_SAMPLE_PROGRAM_SLUGS.has(slug) && !HIDDEN_SAMPLE_PROGRAM_TITLES.has(title);
}

export function filterVisibleAcademyPrograms(paths: AcademyLearningPath[]) {
  return paths.filter(isVisibleAcademyProgram);
}

export function isVisibleAcademyCourse<T extends { id: string; title: string }>(
  course: T,
  paths: AcademyLearningPath[],
) {
  const normalizedTitle = normalizeCatalogText(course.title);
  if (HIDDEN_SAMPLE_COURSE_TITLES.has(normalizedTitle)) {
    return false;
  }
  if (HIDDEN_SAMPLE_COURSE_PATTERNS.some((pattern) => pattern.test(course.title))) {
    return false;
  }

  void paths;
  return true;
}

export function filterVisibleAcademyCourses<T extends { id: string; title: string }>(
  courses: T[],
  paths: AcademyLearningPath[],
) {
  return courses.filter((course) => isVisibleAcademyCourse(course, paths));
}

export function buildAcademyGoalOptions(paths: AcademyLearningPath[]) {
  const visiblePaths = filterVisibleAcademyPrograms(paths);
  if (visiblePaths.length === 0) {
    return academyGoalOptions;
  }

  return visiblePaths.map((path) => {
    const preferredCategories = Array.isArray(path.preferredCategories)
      ? path.preferredCategories
      : [];

    return {
      id: path.slug,
      title: path.title,
      description:
        path.description || `Explore the ${path.title} program and its recommended first courses.`,
      icon: path.icon || Mic,
      color: path.color || '#A855F7',
      recommendedPathSlugs: [path.slug],
      preferredCourseKeywords:
        preferredCategories.length > 0
          ? preferredCategories
          : getLearningPathDisplayCourseTitles(path, []).map((title) => title.toLowerCase()),
    };
  });
}

type PathCourseLike = {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  duration?: string | null;
};

export function getCourseDurationWeeks(duration?: string | null) {
  if (!duration) {
    return 0;
  }

  const normalized = duration.toLowerCase().replace(/[–—-]/g, ' ').trim();
  if (!normalized || normalized.includes('self paced')) {
    return 0;
  }

  const numericMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) {
    return 0;
  }

  const amount = Number(numericMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (normalized.includes('week')) {
    return Math.max(1, Math.round(amount));
  }

  if (normalized.includes('month')) {
    return Math.max(1, Math.round(amount * 4));
  }

  if (normalized.includes('day')) {
    return Math.max(1, Math.ceil(amount / 7));
  }

  if (normalized.includes('hour')) {
    return Math.max(1, Math.ceil(amount / 40));
  }

  return Math.max(1, Math.round(amount));
}

export function formatLearningPathWeeks(weeks: number) {
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}

export function getAcademyLearningPath(slug?: string) {
  return getAcademyLearningPathFromCollection(slug, academyLearningPaths);
}

export function getAcademyLearningPathFromCollection(
  slug: string | undefined,
  paths: AcademyLearningPath[],
) {
  return paths.find((path) => path.slug === slug) ?? null;
}

export function getAcademyGoalOption(id?: string) {
  return academyGoalOptions.find((goal) => goal.id === id) ?? null;
}

export function resolveLearningPathCourses<
  T extends { id: string; title: string; category?: string | null; description?: string | null },
>(path: AcademyLearningPath, courses: T[]): T[] {
  const preferredCategories = Array.isArray(path.preferredCategories)
    ? path.preferredCategories
    : [];

  if (Array.isArray(path.courseIds) && path.courseIds.length > 0) {
    const courseById = new Map(courses.map((course) => [course.id, course]));
    return path.courseIds
      .map((courseId) => courseById.get(courseId))
      .filter((course): course is T => Boolean(course));
  }

  if (Array.isArray(path.courseTitles) && path.courseTitles.length > 0) {
    const courseByTitle = new Map(
      courses.map((course) => [normalizeCatalogText(course.title), course]),
    );
    const matchedByTitle = path.courseTitles
      .map((title) => {
        const aliases = getCourseTitleAliases(title);
        return aliases.map((alias) => courseByTitle.get(alias)).find(Boolean);
      })
      .filter((course): course is T => Boolean(course));
    if (matchedByTitle.length > 0) {
      return matchedByTitle;
    }
  }

  const preferredMatches = courses.filter((course) => {
    const haystack =
      `${course.title} ${course.category ?? ''} ${course.description ?? ''}`.toLowerCase();
    return preferredCategories.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });

  const uniqueMatches = Array.from(
    new Map([...preferredMatches, ...courses].map((course) => [course.id, course])).values(),
  );

  return uniqueMatches.slice(0, path.courses);
}

export type AcademyFallbackCourse = {
  id: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  category: string;
  instructor_name: string;
  instructor: string;
  state: 'published';
  module_count: number;
  lesson_count: number;
  tags: string[];
  image_url: null;
  thumbnail_url: null;
};

function slugifyAcademyCourseTitle(title: string) {
  return normalizeCatalogText(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildAcademyFallbackCourses(
  paths: AcademyLearningPath[] = academyLearningPaths,
): AcademyFallbackCourse[] {
  const courseMap = new Map<string, AcademyFallbackCourse>();

  filterVisibleAcademyPrograms(paths).forEach((path) => {
    const titles = getLearningPathDisplayCourseTitles(path, []);
    titles.forEach((title, index) => {
      const displayTitle = getAcademyProgramCourseDisplayTitle(title) || title;
      const slug = slugifyAcademyCourseTitle(displayTitle);
      if (!slug || courseMap.has(slug)) {
        return;
      }

      const schedule = getAcademyProgramCourseSchedule(path, displayTitle);
      const sessionCount = schedule?.dates.length ?? 4;
      const duration =
        schedule?.dates.length && schedule.month
          ? `${schedule.dates.length} weeks · ${schedule.month}`
          : path.durationLabel || `${Math.max(1, Math.round(path.hours / path.courses))} hours`;
      const description =
        displayTitle === 'Networking with Kadiatu'
          ? 'Build real relationships, practice confident introductions, and learn how to present creative work professionally.'
          : `${displayTitle} is part of the ${path.title} program, with guided practice, live support, and hands-on community media projects.`;

      courseMap.set(slug, {
        id: slug,
        title: displayTitle,
        description,
        level: path.level,
        duration,
        category: 'Media Training',
        instructor_name: displayTitle === 'Networking with Kadiatu' ? 'Kadiatu' : 'Street Voices',
        instructor: displayTitle === 'Networking with Kadiatu' ? 'Kadiatu' : 'Street Voices',
        state: 'published',
        module_count: sessionCount,
        lesson_count: sessionCount,
        tags: [
          'media',
          'storytelling',
          `program:${path.title}`,
          `delivery:${path.deliveryMode}`,
          ...(schedule ? [`start_month:${schedule.month}`] : []),
        ],
        image_url: null,
        thumbnail_url: null,
      });
    });
  });

  return Array.from(courseMap.values());
}

export function getLearningPathDisplayCourseTitles<
  T extends { id: string; title: string; category?: string | null; description?: string | null },
>(path: AcademyLearningPath, courses: T[]) {
  const resolvedTitles = resolveLearningPathCourses(path, courses).map((course) => course.title);
  if (resolvedTitles.length > 0) {
    return resolvedTitles;
  }

  if (Array.isArray(path.courseTitles) && path.courseTitles.length > 0) {
    return path.courseTitles;
  }

  return [];
}

export function getLearningPathDisplayCourseCount<
  T extends { id: string; title: string; category?: string | null; description?: string | null },
>(path: AcademyLearningPath, courses: T[]) {
  const displayTitles = getLearningPathDisplayCourseTitles(path, courses);
  if (displayTitles.length > 0) {
    return displayTitles.length;
  }

  return Math.max(path.courses, 0);
}

export function getLearningPathCourseMap<
  T extends { id: string; title: string; category?: string | null; description?: string | null },
>(courses: T[], paths: AcademyLearningPath[] = academyLearningPaths) {
  const courseMap = new Map<string, AcademyLearningPath[]>();

  paths.forEach((path) => {
    resolveLearningPathCourses(path, courses).forEach((course) => {
      const existing = courseMap.get(course.id) ?? [];
      courseMap.set(course.id, [...existing, path]);
    });
  });

  return courseMap;
}

export function getLearningPathsForCourse<
  T extends { id: string; title: string; category?: string | null; description?: string | null },
>(courseId: string, courses: T[], paths: AcademyLearningPath[] = academyLearningPaths) {
  return getLearningPathCourseMap(courses, paths).get(courseId) ?? [];
}

export function getLearningPathDurationWeeks<T extends PathCourseLike>(
  path: AcademyLearningPath,
  courses: T[],
) {
  const totalCourseWeeks = resolveLearningPathCourses(path, courses).reduce(
    (sum, course) => sum + getCourseDurationWeeks(course.duration),
    0,
  );

  if (totalCourseWeeks > 0) {
    return totalCourseWeeks;
  }

  const hourFallbackWeeks = path.hours > 0 ? Math.max(1, Math.ceil(path.hours / 8)) : 0;
  if (hourFallbackWeeks > 0) {
    return hourFallbackWeeks;
  }

  return Math.max(path.courses, 1);
}

export function getLearningPathDurationLabel<T extends PathCourseLike>(
  path: AcademyLearningPath,
  courses: T[],
) {
  if (path.durationLabel) {
    return path.durationLabel;
  }

  return formatLearningPathWeeks(getLearningPathDurationWeeks(path, courses));
}
