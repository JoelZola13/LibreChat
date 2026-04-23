import type { Job } from "./types";

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function ensurePeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanSentence(value: string): string {
  const trimmed = normalizeSpacing(value.replace(/\s*,\s*/g, ", "));
  if (!trimmed) return "";
  const cased = sentenceCase(trimmed);
  return ensurePeriod(cased);
}

function humanizeList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function splitTags(job: Job): string[] {
  return (job.tags || "")
    .split(",")
    .map((tag) => sentenceCase(tag.replace(/[-_]/g, " ")))
    .filter(Boolean);
}

function getRoleContext(job: Job) {
  const role = job.title || "this role";
  const organization = job.organization || "the team";
  const workMode = job.work_mode || "a flexible setup";
  const opportunityType = job.opportunity_type || "an open role";
  const location = job.location || "your area";
  const hours = job.hours_per_week || "a dependable weekly schedule";
  const tags = splitTags(job).slice(0, 4);

  return {
    role,
    organization,
    workMode,
    opportunityType,
    location,
    hours,
    tags,
    tagText: humanizeList(tags.map((tag) => tag.toLowerCase())),
  };
}

function normalizeParagraphText(value?: string): string {
  if (!value || !value.trim()) return "";

  const normalized = value
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => cleanSentence(line))
    .filter(Boolean)
    .join(" ");

  return normalizeSpacing(normalized);
}

export function getAboutThisJob(job: Job): string {
  const baseDescription = normalizeParagraphText(job.description);
  const { role, organization, workMode, opportunityType, location, hours, tagText } = getRoleContext(job);

  if (baseDescription.length >= 320) {
    return baseDescription;
  }

  const parts = [
    baseDescription || `${role} is an opportunity to contribute meaningful work with ${organization} while building practical experience in a supportive environment.`,
    `${organization} is hiring for a ${opportunityType.toLowerCase()} ${role.toLowerCase()} role based in ${location}, with a ${workMode.toLowerCase()} setup and ${hours.toLowerCase()}.`,
    `This job is a strong fit for someone who communicates clearly, follows through on details, and wants a role with real ownership, steady support, and room to grow over time.`,
  ];

  if (tagText) {
    parts.push(`You will spend time working across areas such as ${tagText}, while helping the team deliver consistent, high-quality results for the people and communities it serves.`);
  }

  parts.push(`Success in this position comes from showing up reliably, learning quickly, and bringing a thoughtful, professional approach to day-to-day work.`);

  return parts.map(cleanSentence).join(" ");
}

function buildFallbackResponsibilities(job: Job): string[] {
  const { role, organization, location, tagText } = getRoleContext(job);

  return [
    `Support the day-to-day priorities of the ${role} position and help keep work moving smoothly across the team.`,
    tagText
      ? `Carry out hands-on work related to ${tagText} while maintaining accuracy, consistency, and strong attention to detail.`
      : `Collaborate with teammates, clients, or community members while delivering a positive and professional experience.`,
    `Communicate updates clearly, stay organized, and flag issues early so the team can respond quickly and keep projects on track.`,
    `Follow through on timelines, documentation, and service standards so tasks are completed well and people feel supported throughout the process.`,
    `Represent ${organization} professionally in ${location} and contribute to a workplace culture that is respectful, dependable, and solutions-focused.`,
  ].map(cleanSentence);
}

function buildFallbackRequirements(job: Job): string[] {
  const { opportunityType, workMode, tagText, role } = getRoleContext(job);

  return [
    `Interest in ${job.category ? job.category.toLowerCase() : "the work"} and readiness to grow into the responsibilities of a ${opportunityType.toLowerCase()} ${role.toLowerCase()} role.`,
    tagText
      ? `Comfort working with tools, tasks, or topics related to ${tagText}.`
      : `Strong communication, reliability, and the ability to learn new processes quickly.`,
    `Ability to stay organized, manage time well, and work effectively in ${workMode.toLowerCase()} settings with changing priorities.`,
    `A professional, respectful approach, strong follow-through, and willingness to take feedback and improve over time.`,
    `Confidence working independently when needed while also collaborating well with others and asking thoughtful questions when support is needed.`,
  ].map(cleanSentence);
}

export function parseJobBullets(value?: string, fallback?: string[]): string[] {
  if (!value || !value.trim()) {
    return fallback || [];
  }

  const normalized = value
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .replace(/;\s*/g, "\n")
    .replace(/\.\s+(?=[A-Z])/g, ".\n");

  const hasStructuredBreaks = normalized.includes("\n");
  const source = hasStructuredBreaks ? normalized.split("\n") : normalized.split(",");

  const items = source
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .map(cleanSentence);

  return items.length > 0 ? items : fallback || [];
}

export function getResponsibilitiesList(job: Job): string[] {
  return parseJobBullets(job.responsibilities, buildFallbackResponsibilities(job));
}

export function getRequirementsList(job: Job): string[] {
  return parseJobBullets(job.requirements, buildFallbackRequirements(job));
}
