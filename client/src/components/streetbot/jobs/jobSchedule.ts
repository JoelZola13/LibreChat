import type { Job } from "./types";

const SAMPLE_SCHEDULE_DETAILS: Record<string, { work_mode: string; hours_per_week: string }> = {
  "sample-1": { work_mode: "Hybrid", hours_per_week: "37.5-40 hrs/week" },
  "sample-2": { work_mode: "Hybrid", hours_per_week: "35-40 hrs/week" },
  "sample-3": { work_mode: "In Person", hours_per_week: "20-28 hrs/week" },
  "sample-4": { work_mode: "Hybrid", hours_per_week: "20-30 hrs/week" },
  "sample-5": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-6": { work_mode: "Remote", hours_per_week: "15-25 hrs/week" },
  "sample-7": { work_mode: "In Person", hours_per_week: "37.5-40 hrs/week" },
  "sample-8": { work_mode: "In Person", hours_per_week: "18-24 hrs/week" },
  "sample-9": { work_mode: "In Person", hours_per_week: "20-25 hrs/week" },
  "sample-10": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-11": { work_mode: "In Person", hours_per_week: "40 hrs/week" },
  "sample-12": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-13": { work_mode: "Hybrid", hours_per_week: "35-40 hrs/week" },
  "sample-14": { work_mode: "In Person", hours_per_week: "12-20 hrs/week" },
  "sample-15": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-16": { work_mode: "In Person", hours_per_week: "16-24 hrs/week" },
  "sample-17": { work_mode: "In Person", hours_per_week: "40 hrs/week" },
  "sample-18": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-19": { work_mode: "Hybrid", hours_per_week: "16-24 hrs/week" },
  "sample-20": { work_mode: "In Person", hours_per_week: "32-40 hrs/week" },
  "sample-21": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-22": { work_mode: "Hybrid", hours_per_week: "32-40 hrs/week" },
  "sample-23": { work_mode: "In Person", hours_per_week: "35-40 hrs/week" },
  "sample-24": { work_mode: "In Person", hours_per_week: "32-40 hrs/week" },
};

function deriveWorkMode(job: Job): string {
  const text = [
    job.work_mode,
    job.location,
    job.description,
    job.requirements,
    job.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("remote")) return "Remote";
  if (text.includes("work from home")) return "Remote";
  return "In Person";
}

function deriveHoursPerWeek(job: Job): string {
  const type = (job.opportunity_type || "").toLowerCase();
  const description = (job.description || "").toLowerCase();

  if (job.hours_per_week) return job.hours_per_week;
  if (type.includes("part-time")) return "15-25 hrs/week";
  if (type.includes("full-time")) return "35-40 hrs/week";
  if (type.includes("contract")) return "20-35 hrs/week";
  if (type.includes("freelance")) return "10-20 hrs/week";
  if (description.includes("weekend")) return "12-20 hrs/week";
  return "20-30 hrs/week";
}

// Curated list of community orgs that have been onboarded to the platform.
// Mirrors the ORGANIZATION_LOGOS keys in JobsPage / JobDetailPage. Listings
// from these orgs render a "Verified Nonprofit" badge so applicants can
// distinguish them from unsolicited postings.
const KNOWN_NONPROFIT_ORGS = new Set<string>([
  "Access Alliance Multicultural Health",
  "Beats & Rhymes Youth Program",
  "Big Brothers Big Sisters Toronto",
  "Black Voices Media Collective",
  "CAMH Community Programs",
  "Community Care Network",
  "Community Connect Network",
  "Housing First Program",
  "Housing Justice Coalition",
  "North York Community Pantry",
  "Parks & Recreation Community Programs",
  "Regent Park Arts Collective",
  "Safe Haven Community Center",
  "Social Planning Council",
  "Street Voices",
  "Street Voices Community Services",
  "TechForGood Initiative",
  "The Stop Community Food Centre",
  "Youth Achievement Center",
  "Youth Services Bureau",
  "Youth Wellness Hub",
]);

function deriveVerification(
  job: Job,
): { employer_verified?: boolean; employer_verification_type?: string } {
  // Don't override an already-set verification (e.g., from SAMPLE_JOBS or backend).
  if (typeof job.employer_verified === "boolean") {
    return {
      employer_verified: job.employer_verified,
      employer_verification_type: job.employer_verification_type,
    };
  }
  if (job.organization && KNOWN_NONPROFIT_ORGS.has(job.organization)) {
    return { employer_verified: true, employer_verification_type: "nonprofit" };
  }
  return {};
}

function deriveDeadline(job: Job): string | undefined {
  if (job.deadline) return job.deadline;
  // Only synthesize for Street Voices roles (others either have a real deadline
  // or intentionally don't have one).
  if (job.organization !== "Street Voices") return job.deadline;
  const base = job.posting_date || job.created_at;
  if (!base) return job.deadline;
  const baseDate = new Date(base);
  if (isNaN(baseDate.getTime())) return job.deadline;
  // Podcast Producer is bi-weekly and time-sensitive — shorter window.
  const days = job.title?.includes("Podcast Producer") ? 30 : 60;
  return new Date(baseDate.getTime() + days * 86400000).toISOString();
}

export function enrichJobSchedule(job: Job): Job {
  const sampleOverride = SAMPLE_SCHEDULE_DETAILS[job.id];
  const verification = deriveVerification(job);

  return {
    ...job,
    work_mode: job.work_mode || sampleOverride?.work_mode || deriveWorkMode(job),
    hours_per_week: job.hours_per_week || sampleOverride?.hours_per_week || deriveHoursPerWeek(job),
    deadline: deriveDeadline(job),
    ...verification,
  };
}

export function enrichJobsSchedule(jobs: Job[]): Job[] {
  return jobs.map(enrichJobSchedule);
}
