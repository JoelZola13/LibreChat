/**
 * Cover letter generation templates. Parameterized with user data.
 */

import { findOccupation } from "./occupationSkillsMap";
import { spellCheck } from "./resumeEnhancer";
import type { Resume } from "./types";

type CoverLetterParams = {
  resume: Partial<Resume>;
  occupation?: string;
  jobType?: string;
  targetJobTitle?: string;
  targetCompany?: string;
};

const OPENING_TEMPLATES = [
  "I am writing to express my sincere interest in the {jobTitle} position{atCompany}. With my background in {field}, I am confident in my ability to contribute meaningfully to your team.",
  "I am eager to apply for the {jobTitle} role{atCompany}. My experience and dedication to excellence make me a strong candidate for this opportunity.",
  "Please accept this letter as my formal application for the {jobTitle} position{atCompany}. I am enthusiastic about the opportunity to bring my skills and experience to your organization.",
];

const BODY_TEMPLATES = [
  "Throughout my career, I have developed strong competencies in {skills}. In my most recent role as {recentTitle} at {recentCompany}, I successfully {recentAchievement}. These experiences have equipped me with the practical knowledge and professionalism needed to excel in this role.",
  "My professional background includes hands-on experience in {skills}. As a {recentTitle} at {recentCompany}, I demonstrated my ability to {recentAchievement}. I am well-prepared to apply these capabilities to deliver results for your team.",
  "I bring a solid foundation in {skills}, developed through my work as {recentTitle} at {recentCompany}. I take pride in my ability to {recentAchievement}, and I am excited to bring this same dedication to your organization.",
];

const CLOSING_TEMPLATES = [
  "I would welcome the opportunity to discuss how my qualifications align with the needs of your team. I am available for an interview at your earliest convenience and can be reached at {phone} or {email}. Thank you for considering my application.",
  "I am enthusiastic about the possibility of contributing to {company} and would appreciate the chance to discuss this role further. Please feel free to contact me at {phone} or {email}. Thank you for your time and consideration.",
  "I look forward to the opportunity to discuss how I can contribute to the continued success of your organization. I can be reached at {phone} or {email}. Thank you for reviewing my application.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a complete cover letter from templates and user data.
 */
export function generateCoverLetter(params: CoverLetterParams): string {
  const { resume, occupation, jobType, targetJobTitle, targetCompany } = params;
  const profile = occupation ? findOccupation(occupation) : null;

  const name = resume.fullName || "Applicant";
  const email = resume.email || "email@example.com";
  const phone = resume.phone || "(416) 000-0000";
  const location = resume.location || "";
  const jobTitle = targetJobTitle || profile?.occupation || "available position";
  const company = targetCompany || "your organization";
  const atCompany = targetCompany ? ` at ${targetCompany}` : "";

  // Build contact header
  const contactParts = [location, phone, email].filter(Boolean);
  const header = `${name}\n${contactParts.join(" | ")}\n\n${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;

  // Addressee
  const addressee = targetCompany
    ? `${targetCompany}\nRe: ${jobTitle}\n\nDear Hiring Manager,`
    : "Dear Hiring Manager,";

  // Skills list for body
  const skills = resume.skills?.slice(0, 3).join(", ") || profile?.skills.slice(0, 3).join(", ") || "communication and teamwork";

  // Recent experience for body
  const recentExp = resume.experience?.[0];
  const recentTitle = recentExp?.title || profile?.occupation || "a professional";
  const recentCompany = recentExp?.company || "my previous employer";
  const recentAchievement = recentExp?.description
    ? recentExp.description.split(".")[0].toLowerCase().trim()
    : profile?.responsibilities[0]?.toLowerCase() || "deliver consistent results and exceed expectations";

  // Field for opening
  const field = profile?.category || occupation || "my field";

  // Generate paragraphs
  const opening = pickRandom(OPENING_TEMPLATES)
    .replace("{jobTitle}", jobTitle)
    .replace("{atCompany}", atCompany)
    .replace("{field}", field);

  const body = pickRandom(BODY_TEMPLATES)
    .replace("{skills}", skills)
    .replace("{recentTitle}", recentTitle)
    .replace("{recentCompany}", recentCompany)
    .replace("{recentAchievement}", recentAchievement);

  const closing = pickRandom(CLOSING_TEMPLATES)
    .replace("{company}", company)
    .replace("{phone}", phone)
    .replace("{email}", email);

  const letter = `${header}\n\n${addressee}\n\n${opening}\n\n${body}\n\n${closing}\n\nSincerely,\n${name}`;

  return spellCheck(letter);
}

/**
 * Generate suggestions for improving a cover letter.
 */
export function generateCoverLetterSuggestions(
  content: string,
  occupation?: string,
): { id: string; type: "keyword"; text: string; status: "pending" | "accepted" | "rejected" }[] {
  const profile = occupation ? findOccupation(occupation) : null;
  if (!profile) return [];

  const contentLower = content.toLowerCase();
  const suggestions: { id: string; type: "keyword"; text: string; status: "pending" | "accepted" | "rejected" }[] = [];
  let counter = 0;

  // Suggest keywords from occupation that aren't in the letter
  for (const keyword of profile.keywords) {
    if (!contentLower.includes(keyword.toLowerCase())) {
      suggestions.push({
        id: `cl_sug_${counter++}`,
        type: "keyword",
        text: `Consider mentioning "${keyword}" to align with common job posting requirements`,
        status: "pending",
      });
    }
  }

  // Suggest skills not mentioned
  for (const skill of profile.skills.slice(0, 5)) {
    if (!contentLower.includes(skill.toLowerCase())) {
      suggestions.push({
        id: `cl_sug_${counter++}`,
        type: "keyword",
        text: `Highlight your "${skill}" competency to strengthen your candidacy`,
        status: "pending",
      });
    }
  }

  return suggestions.slice(0, 8);
}
