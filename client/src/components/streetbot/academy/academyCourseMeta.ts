import {
  academyLearningPaths,
  getAcademyProgramCourseDisplayTitle,
  getAcademyProgramCourseSchedule,
} from './academyLearningPaths';

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

export type AcademyCourseWorkshopSession = {
  title: string;
  date: string;
  time: string;
  focus: string;
  activities: string[];
  takeaways: string[];
  prep: string;
};

type WorkshopTemplate = Omit<AcademyCourseWorkshopSession, 'date' | 'time'>;

const PROGRAM_WORKSHOP_TEMPLATES: Record<string, WorkshopTemplate[]> = {
  journalism: [
    {
      title: 'Finding the Story',
      focus:
        'Learn how to spot strong community stories, shape a clear angle, and ask better reporting questions.',
      activities: [
        'Break down examples of community journalism',
        'Choose one local issue, person, or event to report on',
        'Draft a story angle and interview question list',
      ],
      takeaways: ['Story angle', 'Interview question bank', 'Reporting plan'],
      prep: 'Bring one community issue, person, or event you might want to cover.',
    },
    {
      title: 'Interviewing with Care',
      focus:
        'Practice interviews that are prepared, respectful, clear, and useful for a real story.',
      activities: [
        'Practice warm-up, follow-up, and clarification questions',
        'Role-play interviewer and interviewee scenarios',
        'Review consent, accuracy, and note-taking habits',
      ],
      takeaways: [
        'Interview checklist',
        'Consent and note-taking habits',
        'Stronger follow-up questions',
      ],
      prep: 'Bring your draft interview questions from Session 1.',
    },
    {
      title: 'Writing and Editing the Piece',
      focus: 'Turn reporting notes into a clear article, caption package, or short script.',
      activities: [
        'Outline a beginning, middle, and ending',
        'Write a working lead and supporting paragraphs',
        'Peer edit for clarity, accuracy, and voice',
      ],
      takeaways: ['Draft story structure', 'Edited lead', 'Revision checklist'],
      prep: 'Bring notes, quotes, or observations from your reporting practice.',
    },
    {
      title: 'Publishing and Sharing Responsibly',
      focus:
        'Prepare a journalism piece for publication with attention to audience, accuracy, and impact.',
      activities: [
        'Finalize headline, caption, and summary options',
        'Review fact-checking and attribution steps',
        'Plan how the story should be shared with the community',
      ],
      takeaways: ['Publication-ready draft', 'Fact-check pass', 'Sharing plan'],
      prep: 'Bring your edited story draft or outline.',
    },
  ],
  videography: [
    {
      title: 'Visual Story Foundations',
      focus:
        'Understand shot types, visual sequences, and how video changes the way a story is told.',
      activities: [
        'Review examples of strong short-form video storytelling',
        'Build a simple shot list for a community story',
        'Practice framing, stability, and intentional movement',
      ],
      takeaways: ['Shot list', 'Framing basics', 'Visual story plan'],
      prep: 'Bring a phone or camera if available.',
    },
    {
      title: 'Camera, Light, and Sound',
      focus:
        'Practice capturing watchable footage with clean framing, usable audio, and thoughtful lighting.',
      activities: [
        'Set up interviews in different lighting conditions',
        'Compare built-in and external audio options',
        'Capture b-roll that supports the main story',
      ],
      takeaways: ['Interview setup checklist', 'Audio basics', 'B-roll plan'],
      prep: 'Bring headphones if you have them.',
    },
    {
      title: 'Interviewing on Camera',
      focus:
        'Lead comfortable on-camera interviews and capture answers that can shape a short story.',
      activities: [
        'Practice setting context before recording',
        'Record short interview clips in pairs',
        'Review clips for framing, audio, and answer quality',
      ],
      takeaways: ['Recorded practice interview', 'On-camera question flow', 'Review notes'],
      prep: 'Bring three interview questions tied to your story idea.',
    },
    {
      title: 'Editing Your Story',
      focus: 'Organize footage, choose the strongest moments, and assemble a clean first edit.',
      activities: [
        'Sort footage into selects, b-roll, and audio moments',
        'Build a short timeline or paper edit',
        'Add simple titles, captions, or transitions where useful',
      ],
      takeaways: ['Edit structure', 'Selected clips', 'First-cut checklist'],
      prep: 'Bring any footage you captured during the previous sessions.',
    },
    {
      title: 'Screening and Feedback',
      focus: 'Share a short video draft, receive feedback, and plan final revisions.',
      activities: [
        'Screen rough cuts or storyboards',
        'Give feedback using clarity, sound, story, and impact prompts',
        'Create a final revision plan',
      ],
      takeaways: ['Feedback notes', 'Revision priorities', 'Next publishing step'],
      prep: 'Bring a rough cut, storyboard, or shot list to share.',
    },
  ],
  broadcasting: [
    {
      title: 'Broadcast Voice and Format',
      focus:
        'Understand how broadcasting packages information for audio, video, live, and social channels.',
      activities: [
        'Compare broadcast formats and segment structures',
        'Practice intros, outros, and short presenter reads',
        'Choose a format for a community segment',
      ],
      takeaways: ['Segment format', 'Presenter intro', 'Broadcast vocabulary'],
      prep: 'Bring one topic you could explain or host in under two minutes.',
    },
    {
      title: 'Run of Show and Roles',
      focus: 'Plan a broadcast segment with clear timing, roles, transitions, and backup plans.',
      activities: [
        'Build a run of show',
        'Assign host, producer, guest, and technical roles',
        'Practice transitions between segments',
      ],
      takeaways: ['Run of show', 'Role map', 'Timing plan'],
      prep: 'Bring your segment idea from Session 1.',
    },
    {
      title: 'Recording, Live Flow, and Troubleshooting',
      focus:
        'Practice a broadcast flow while handling timing, mistakes, and technical hiccups calmly.',
      activities: [
        'Rehearse a short live or recorded segment',
        'Practice recovery lines and time checks',
        'Review basic audio/video quality controls',
      ],
      takeaways: ['Practice segment', 'Troubleshooting checklist', 'Confidence on mic/camera'],
      prep: 'Bring your run of show and any script notes.',
    },
    {
      title: 'Publishing the Segment',
      focus:
        'Package a broadcast segment for sharing with the right title, description, and audience context.',
      activities: [
        'Review final segment structure',
        'Write titles, descriptions, and pull quotes',
        'Plan distribution and community follow-up',
      ],
      takeaways: ['Publish-ready package', 'Distribution plan', 'Post-show reflection'],
      prep: 'Bring a segment draft, script, or recording.',
    },
  ],
  'networking with kadiatu': [
    {
      title: 'Relationship Map and Goals',
      focus:
        'Define what networking means, identify the relationships you already have, and set practical goals.',
      activities: [
        'Map current contacts, communities, and opportunity spaces',
        'Name short-term and long-term connection goals',
        'Practice introducing yourself with clarity and confidence',
      ],
      takeaways: ['Personal network map', 'Connection goals', 'Working introduction'],
      prep: 'Bring one opportunity, project, or career goal you want support with.',
    },
    {
      title: 'Starting Real Conversations',
      focus:
        'Practice approachable ways to begin conversations, ask useful questions, and follow your curiosity.',
      activities: [
        'Build conversation starters for different settings',
        'Practice active listening and follow-up questions',
        'Draft a message for someone you want to connect with',
      ],
      takeaways: ['Conversation starter bank', 'Outreach message draft', 'Listening prompts'],
      prep: 'Bring the name or role of one person you would like to reach out to.',
    },
    {
      title: 'Follow-Up and Opportunity Tracking',
      focus:
        'Learn how to keep relationships alive after the first conversation without making it awkward.',
      activities: [
        'Practice respectful follow-up messages',
        'Create a simple opportunity tracker',
        'Plan how to ask for advice, referrals, or collaboration',
      ],
      takeaways: ['Follow-up templates', 'Opportunity tracker', 'Ask strategy'],
      prep: 'Bring notes from a recent conversation or a connection you want to maintain.',
    },
    {
      title: 'Personal Pitch and Next Steps',
      focus:
        'Pull the workshop together into a confident pitch, action plan, and next connection steps.',
      activities: [
        'Refine a short personal pitch',
        'Practice sharing your goals out loud',
        'Build a 30-day networking action plan',
      ],
      takeaways: ['Personal pitch', '30-day action plan', 'Next three outreach steps'],
      prep: 'Bring your intro, outreach draft, and one goal you are ready to act on.',
    },
  ],
};

function formatMonthDayWithYear(dateLabel: string, year: string) {
  const day = Number(dateLabel.match(/\d+/)?.[0] ?? 0);
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${dateLabel}${suffix}, ${year}`;
}

export function getCourseWorkshopSessions(courseTitle?: string | null) {
  const mediaTrainingPath = academyLearningPaths.find(
    (path) => path.slug === 'street-voices-media-training',
  );
  const displayTitle = getAcademyProgramCourseDisplayTitle(courseTitle);
  const schedule = getAcademyProgramCourseSchedule(mediaTrainingPath, displayTitle);
  const templates = PROGRAM_WORKSHOP_TEMPLATES[displayTitle.toLowerCase()] ?? [];

  if (!schedule || templates.length === 0) {
    return [];
  }

  return schedule.dates.map((date, index) => {
    const template = templates[index] ?? templates[templates.length - 1];
    return {
      ...template,
      date,
      time: 'Wednesday, 6 - 8 pm',
    };
  });
}

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

export function getCourseStartDateFromTags(tags?: string[] | null) {
  return getTaggedLines(tags, 'start_date:')[0] ?? null;
}

export function getCourseStartMonthFromTags(tags?: string[] | null) {
  return getTaggedLines(tags, 'start_month:')[0] ?? null;
}

export function getCourseMeetingDaysFromTags(tags?: string[] | null) {
  return getTaggedLines(tags, 'meeting_day:');
}

export function getCourseScheduleNotesFromTags(tags?: string[] | null) {
  return getTaggedLines(tags, 'schedule_notes:')[0] ?? null;
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
  options: {
    moduleCount?: number;
    lessonCount?: number;
    deliveryMode?: string;
    duration?: string;
  } = {},
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

export function getCourseCohortMeta(
  courseId?: string | null,
  courseTitle?: string | null,
): AcademyCourseCohortMeta {
  const mediaTrainingPath = academyLearningPaths.find(
    (path) => path.slug === 'street-voices-media-training',
  );
  const displayTitle = getAcademyProgramCourseDisplayTitle(courseTitle);
  const schedule = getAcademyProgramCourseSchedule(mediaTrainingPath, displayTitle);

  if (schedule) {
    const firstDate = schedule.dates[0] ?? schedule.month;
    const year = schedule.month.match(/\d{4}/)?.[0] ?? '2026';

    return {
      name: '2026 Cohort',
      startLabel: formatMonthDayWithYear(firstDate, year),
      enrollmentDeadlineLabel: 'July 31st, 2026',
      weeks: schedule.dates.length,
      durationLabel: `${schedule.dates.length} Wednesdays`,
      summary: `${displayTitle} runs on Wednesdays in ${schedule.month}: ${schedule.dates.join(', ')}.`,
    };
  }

  const weekOptions = [5, 6, 7, 8];
  const seed = (courseId || 'academy-course')
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const weeks = weekOptions[seed % weekOptions.length];

  return {
    name: '2026 Cohort',
    startLabel: 'September 14th, 2026',
    enrollmentDeadlineLabel: 'Aug 30th, 2026',
    weeks,
    durationLabel: `${weeks} Weeks`,
    summary:
      'Join a small group of learners moving through the program together with guided lessons and live support. Limited spots available.',
  };
}
