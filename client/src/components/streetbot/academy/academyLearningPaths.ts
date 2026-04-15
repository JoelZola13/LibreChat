import { Briefcase, Compass, Home, Laptop, type LucideIcon, Mic, PenTool, ShieldCheck } from "lucide-react";

export type AcademyLearningPath = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  courses: number;
  hours: number;
  level: string;
  deliveryMode: string;
  color: string;
  icon: LucideIcon;
  requirements: string[];
  whatYoullLearn: string[];
  milestones: string[];
  outcomes: string[];
  preferredCategories: string[];
  courseIds?: string[];
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: "built-in" | "generated";
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
    slug: "job-ready",
    title: "Job Ready",
    description: "Complete path to employment readiness and interview confidence.",
    courses: 4,
    hours: 40,
    level: "Beginner to Intermediate",
    deliveryMode: "In person and live stream",
    color: "#10B981",
    icon: Briefcase,
    requirements: [
      "No previous experience required",
      "Ready to practice resumes, interviews, and communication",
      "Able to join live or in-person support sessions",
    ],
    whatYoullLearn: [
      "How to tell your story with confidence",
      "How to build job-ready application materials",
      "How to prepare for interviews and workplace communication",
    ],
    milestones: [
      "Build a clear professional story",
      "Create your resume and application materials",
      "Practice interviews and workplace communication",
      "Complete a portfolio-ready capstone",
    ],
    outcomes: [
      "Job search confidence",
      "Application readiness",
      "Interview preparation",
    ],
    preferredCategories: ["business", "marketing", "development"],
  },
  {
    slug: "digital-basics",
    title: "Digital Basics",
    description: "Essential computer and internet skills for everyday work and life.",
    courses: 4,
    hours: 24,
    level: "Beginner",
    deliveryMode: "In person and live stream",
    color: "#3B82F6",
    icon: Laptop,
    requirements: [
      "No previous digital training required",
      "Phone, tablet, or computer access helps",
      "Willingness to practice simple weekly tasks",
    ],
    whatYoullLearn: [
      "How to use devices, browsers, and online tools",
      "How to work with files, forms, email, and collaboration tools",
      "How to use digital skills safely in everyday life",
    ],
    milestones: [
      "Master device and browser basics",
      "Learn files, forms, and online tools",
      "Practice email, collaboration, and research",
      "Apply digital skills in daily workflows",
    ],
    outcomes: [
      "Digital confidence",
      "Safer online habits",
      "Better everyday workflow skills",
    ],
    preferredCategories: ["technology", "development", "design"],
  },
  {
    slug: "housing-stability",
    title: "Housing Stability",
    description: "Practical learning track for housing search, support, and retention.",
    courses: 4,
    hours: 32,
    level: "Beginner",
    deliveryMode: "In person and live stream",
    color: "#8B5CF6",
    icon: Home,
    requirements: [
      "Open to learners at any stage of their housing journey",
      "Bring your current questions or documents if you have them",
      "Able to join live or in-person support sessions",
    ],
    whatYoullLearn: [
      "How to organize a housing search step by step",
      "How to prepare applications and communicate clearly",
      "How to build long-term routines for housing stability",
    ],
    milestones: [
      "Understand the housing search process",
      "Organize documents and application steps",
      "Learn landlord and tenant communication",
      "Build long-term stability habits",
    ],
    outcomes: [
      "Housing navigation confidence",
      "Prepared application materials",
      "Long-term stability planning",
    ],
    preferredCategories: ["business", "marketing", "technology"],
  },
];

export const academyGoalOptions: AcademyGoalOption[] = [
  {
    id: "job-search",
    title: "Get Job Ready",
    description: "Build confidence for resumes, interviews, and workplace communication.",
    icon: Briefcase,
    color: "#10B981",
    recommendedPathSlugs: ["job-ready"],
    preferredCourseKeywords: ["job", "career", "interview", "resume", "employment", "workplace"],
  },
  {
    id: "digital-confidence",
    title: "Build Digital Skills",
    description: "Learn the online tools and computer basics you need every day.",
    icon: Laptop,
    color: "#3B82F6",
    recommendedPathSlugs: ["digital-basics"],
    preferredCourseKeywords: ["digital", "technology", "computer", "internet", "email", "online"],
  },
  {
    id: "housing-support",
    title: "Support Housing Goals",
    description: "Get practical help with housing search, documents, and stability.",
    icon: Home,
    color: "#8B5CF6",
    recommendedPathSlugs: ["housing-stability"],
    preferredCourseKeywords: ["housing", "tenant", "stability", "support", "documents", "application"],
  },
  {
    id: "communication",
    title: "Improve Communication",
    description: "Practice speaking up, presenting yourself, and communicating clearly.",
    icon: Mic,
    color: "#F97316",
    recommendedPathSlugs: ["job-ready", "digital-basics"],
    preferredCourseKeywords: ["communication", "speaking", "confidence", "presentation", "interview"],
  },
  {
    id: "creative-growth",
    title: "Grow Creative Skills",
    description: "Build skills for creative work, portfolios, and self-expression.",
    icon: PenTool,
    color: "#EC4899",
    recommendedPathSlugs: ["job-ready", "digital-basics"],
    preferredCourseKeywords: ["creative", "design", "portfolio", "content", "marketing", "media"],
  },
  {
    id: "life-stability",
    title: "Build Everyday Confidence",
    description: "Start with the skills that make daily life and next steps feel easier.",
    icon: ShieldCheck,
    color: "#14B8A6",
    recommendedPathSlugs: ["digital-basics", "housing-stability"],
    preferredCourseKeywords: ["forms", "documents", "support", "digital", "housing", "community"],
  },
  {
    id: "explore-options",
    title: "Explore My Options",
    description: "See a balanced recommendation if you are still deciding where to begin.",
    icon: Compass,
    color: "#FACC15",
    recommendedPathSlugs: ["digital-basics", "job-ready", "housing-stability"],
    preferredCourseKeywords: ["beginner", "digital", "confidence", "support", "job"],
  },
];

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

  const normalized = duration.toLowerCase().replace(/[–—-]/g, " ").trim();
  if (!normalized || normalized.includes("self paced")) {
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

  if (normalized.includes("week")) {
    return Math.max(1, Math.round(amount));
  }

  if (normalized.includes("month")) {
    return Math.max(1, Math.round(amount * 4));
  }

  if (normalized.includes("day")) {
    return Math.max(1, Math.ceil(amount / 7));
  }

  if (normalized.includes("hour")) {
    return Math.max(1, Math.ceil(amount / 40));
  }

  return Math.max(1, Math.round(amount));
}

export function formatLearningPathWeeks(weeks: number) {
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export function getAcademyLearningPath(slug?: string) {
  return getAcademyLearningPathFromCollection(slug, academyLearningPaths);
}

export function getAcademyLearningPathFromCollection(slug: string | undefined, paths: AcademyLearningPath[]) {
  return paths.find((path) => path.slug === slug) ?? null;
}

export function getAcademyGoalOption(id?: string) {
  return academyGoalOptions.find((goal) => goal.id === id) ?? null;
}

export function resolveLearningPathCourses<
  T extends { id: string; title: string; category?: string | null; description?: string | null }
>(path: AcademyLearningPath, courses: T[]): T[] {
  if (Array.isArray(path.courseIds) && path.courseIds.length > 0) {
    const courseById = new Map(courses.map((course) => [course.id, course]));
    return path.courseIds
      .map((courseId) => courseById.get(courseId))
      .filter((course): course is T => Boolean(course));
  }

  const preferredMatches = courses.filter((course) => {
    const haystack = `${course.title} ${course.category ?? ""} ${course.description ?? ""}`.toLowerCase();
    return path.preferredCategories.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });

  const uniqueMatches = Array.from(
    new Map([...preferredMatches, ...courses].map((course) => [course.id, course])).values(),
  );

  return uniqueMatches.slice(0, path.courses);
}

export function getLearningPathCourseMap<
  T extends { id: string; title: string; category?: string | null; description?: string | null }
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
  T extends { id: string; title: string; category?: string | null; description?: string | null }
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
  return formatLearningPathWeeks(getLearningPathDurationWeeks(path, courses));
}
