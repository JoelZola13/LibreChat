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

export function enrichJobSchedule(job: Job): Job {
  const sampleOverride = SAMPLE_SCHEDULE_DETAILS[job.id];

  return {
    ...job,
    work_mode: job.work_mode || sampleOverride?.work_mode || deriveWorkMode(job),
    hours_per_week: job.hours_per_week || sampleOverride?.hours_per_week || deriveHoursPerWeek(job),
  };
}

export function enrichJobsSchedule(jobs: Job[]): Job[] {
  return jobs.map(enrichJobSchedule);
}
