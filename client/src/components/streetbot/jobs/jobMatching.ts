import type { Job, Resume } from "./types";
import { getRequirementsList, getResponsibilitiesList } from "./jobContent";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "you", "our", "are", "will",
  "into", "able", "about", "have", "has", "had", "but", "not", "job", "role", "work", "team",
  "their", "they", "them", "who", "how", "why", "can", "all", "any", "out", "day", "per",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function gatherJobText(job: Job): string {
  return [
    job.title,
    job.organization,
    job.category,
    job.location,
    job.work_mode,
    job.opportunity_type,
    job.tags,
    job.description,
    ...getResponsibilitiesList(job),
    ...getRequirementsList(job),
  ]
    .filter(Boolean)
    .join(" ");
}

function getProfileKeywords(resume: Resume): string[] {
  const experienceText = resume.experience
    .flatMap((exp) => [exp.title, exp.company, exp.location, exp.description])
    .filter(Boolean)
    .join(" ");

  const educationText = resume.education
    .flatMap((edu) => [edu.institution, edu.degree, edu.field])
    .filter(Boolean)
    .join(" ");

  const certificationText = resume.certifications
    .flatMap((cert) => [cert.name, cert.issuer])
    .filter(Boolean)
    .join(" ");

  return unique([
    ...resume.skills.map((skill) => skill.toLowerCase()),
    ...resume.interests.map((interest) => interest.toLowerCase()),
    ...tokenize(resume.summary),
    ...tokenize(experienceText),
    ...tokenize(educationText),
    ...tokenize(certificationText),
  ]);
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, numerator / denominator);
}

export function calculateJobMatch(job: Job, resume: Resume) {
  const jobText = gatherJobText(job).toLowerCase();

  const skillMatches = resume.skills.filter((skill) => jobText.includes(skill.toLowerCase()));
  const interestMatches = resume.interests.filter((interest) => jobText.includes(interest.toLowerCase()));

  const profileKeywords = getProfileKeywords(resume);
  const keywordMatches = profileKeywords.filter((keyword) => jobText.includes(keyword));

  const locationFit =
    !resume.location ||
    !job.location ||
    job.location.toLowerCase().includes("remote") ||
    job.work_mode?.toLowerCase() === "remote" ||
    job.location.toLowerCase().includes(resume.location.toLowerCase());

  const skillScore = percentage(skillMatches.length, Math.max(3, resume.skills.length || 0));
  const interestScore = percentage(interestMatches.length, Math.max(2, resume.interests.length || 0));
  const keywordScore = percentage(keywordMatches.length, Math.max(6, profileKeywords.length || 0));
  const locationScore = locationFit ? 1 : 0.35;

  const completionSignals = [
    resume.fullName,
    resume.email,
    resume.summary,
    resume.skills.length > 0 ? "skills" : "",
    resume.interests.length > 0 ? "interests" : "",
    resume.experience.length > 0 ? "experience" : "",
  ].filter(Boolean).length;

  const completionBoost = percentage(completionSignals, 6);
  const rawScore =
    skillScore * 0.35 +
    interestScore * 0.2 +
    keywordScore * 0.25 +
    locationScore * 0.1 +
    completionBoost * 0.1;

  const score = Math.max(28, Math.min(98, Math.round(rawScore * 100)));

  const reasons = unique([
    ...skillMatches.slice(0, 2).map((skill) => `Matches your skill in ${skill}`),
    ...interestMatches.slice(0, 2).map((interest) => `Lines up with your interest in ${interest}`),
    locationFit && (job.work_mode?.toLowerCase() === "remote"
      ? "Remote-friendly setup fits your search flexibility"
      : `Location fit looks good for ${job.location || "this opportunity"}`),
  ].filter(Boolean) as string[]).slice(0, 3);

  let label = "Growing fit";
  if (score >= 85) label = "Excellent fit";
  else if (score >= 72) label = "Strong fit";
  else if (score >= 58) label = "Good fit";

  return {
    score,
    label,
    reasons,
  };
}
