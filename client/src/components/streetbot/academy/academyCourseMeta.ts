export type AcademyCourseMetaInput = {
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  tags?: string[] | null;
};

export type AcademyCourseModuleMeta = {
  title?: string | null;
  name?: string | null;
};

export type AcademyCourseCohortMeta = {
  name: string;
  startLabel: string;
  enrollmentDeadlineLabel: string;
  weeks: number;
  durationLabel: string;
  summary: string;
};

function getTaggedLines(tags: string[] | null | undefined, prefix: string) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const normalizedPrefix = prefix.toLowerCase();
  return tags
    .filter((tag) => tag.toLowerCase().startsWith(normalizedPrefix))
    .map((tag) => tag.slice(prefix.length).trim())
    .filter(Boolean);
}

export function formatCourseLevel(level?: string | null) {
  if (!level) {
    return 'Beginner';
  }

  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getCourseDeliveryModeFromTags(tags?: string[] | null) {
  return getTaggedLines(tags, 'delivery:')[0] ?? null;
}

export function getCourseDeliveryMode(options: { sessionCount?: number; cohortCount?: number }) {
  if ((options.sessionCount ?? 0) > 0 && (options.cohortCount ?? 0) > 0) {
    return 'In person and live stream';
  }

  if ((options.sessionCount ?? 0) > 0) {
    return 'Live stream';
  }

  if ((options.cohortCount ?? 0) > 0) {
    return 'In person';
  }

  return 'Self-paced with live support';
}

export function getCourseRequirements(course: AcademyCourseMetaInput) {
  const taggedRequirements = getTaggedLines(course.tags, 'requirement:');
  if (taggedRequirements.length > 0) {
    return taggedRequirements;
  }

  const level = formatCourseLevel(course.level).toLowerCase();
  const levelRequirement =
    level === 'advanced'
      ? 'Previous experience with this topic is recommended'
      : level === 'intermediate'
        ? 'Some basic familiarity is helpful'
        : 'No previous experience required';

  return [
    levelRequirement,
    'A phone, tablet, or computer for course activities',
    'Time to complete weekly lessons and live support sessions',
  ];
}

export function getCourseLearningPoints(
  course: AcademyCourseMetaInput,
  modules: AcademyCourseModuleMeta[] = [],
) {
  const taggedOutcomes = getTaggedLines(course.tags, 'outcome:');
  if (taggedOutcomes.length > 0) {
    return taggedOutcomes;
  }

  const moduleHighlights = modules
    .map((module) => module.title || module.name)
    .filter((value): value is string => Boolean(value))
    .slice(0, 2)
    .map((value) => `Practice ${value}`);

  const fallback = [
    `Build practical ${course.category?.toLowerCase() || 'career'} skills you can use right away`,
    'Follow a clear step-by-step course plan from start to finish',
    'Prepare for the next course, live session, or program milestone',
  ];

  return [...moduleHighlights, ...fallback].slice(0, 3);
}

export function getCourseDetailedOverview(
  course: AcademyCourseMetaInput,
  options: { moduleCount?: number; lessonCount?: number; deliveryMode?: string; duration?: string } = {},
) {
  const level = formatCourseLevel(course.level).toLowerCase();
  const category = course.category?.toLowerCase() || 'career';
  const moduleCount = options.moduleCount ?? 0;
  const lessonCount = options.lessonCount ?? 0;
  const deliveryMode = options.deliveryMode ?? 'in person and live stream';
  const duration = options.duration ?? course.duration ?? 'a flexible schedule';
  const introParagraph =
    course.description?.trim() ||
    `${course.title} is a ${level} ${category} course built for learners who want a clear starting point and practical support. The class focuses on applying skills step by step instead of overwhelming learners with too much at once.`;

  return [
    introParagraph,
    `Learners move through ${moduleCount || 'multiple'} modules and ${lessonCount || 'guided'} lessons over ${duration}. This course is offered ${deliveryMode.toLowerCase()} so learners can stay connected while they build momentum.`,
  ];
}

export function getCourseCohortMeta(courseId?: string | null): AcademyCourseCohortMeta {
  const weekOptions = [5, 6, 7, 8];
  const seed = (courseId || 'academy-course')
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const weeks = weekOptions[seed % weekOptions.length];

  return {
    name: 'Fall Cohort',
    startLabel: 'September 14th, 2026',
    enrollmentDeadlineLabel: 'Aug 30th, 2026',
    weeks,
    durationLabel: `${weeks} Weeks`,
    summary:
      'Join a small group of learners moving through the program together with guided lessons and live support. Limited spots available.',
  };
}
