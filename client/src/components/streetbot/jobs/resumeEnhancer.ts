/**
 * Text enhancement utilities for resume and cover letter generation.
 * All client-side — no external API calls.
 */

import { findOccupation, type OccupationProfile } from "./occupationSkillsMap";
import type { Resume } from "./types";

export type Suggestion = {
  id: string;
  type: "skill" | "responsibility" | "description" | "keyword";
  text: string;
  status: "pending" | "accepted" | "rejected";
};

// ── Action Verb Upgrades ──

const CASUAL_TO_PROFESSIONAL: [RegExp, string][] = [
  [/\bhelped\b/gi, "Assisted"],
  [/\bhelp\b/gi, "Assist"],
  [/\bwas in charge of\b/gi, "Managed and oversaw"],
  [/\bin charge of\b/gi, "Responsible for managing"],
  [/\bworked with\b/gi, "Collaborated with"],
  [/\bworked on\b/gi, "Contributed to"],
  [/\bdealt with\b/gi, "Addressed and resolved"],
  [/\btook care of\b/gi, "Maintained and managed"],
  [/\bmade sure\b/gi, "Ensured"],
  [/\bran\b/gi, "Coordinated"],
  [/\bset up\b/gi, "Established"],
  [/\bput together\b/gi, "Compiled and organized"],
  [/\bgot\b/gi, "Obtained"],
  [/\bfixed\b/gi, "Resolved"],
  [/\bhandled\b/gi, "Managed"],
  [/\bkept track of\b/gi, "Monitored and tracked"],
  [/\blooked after\b/gi, "Supervised and maintained"],
  [/\bused\b/gi, "Utilized"],
  [/\bwent to\b/gi, "Attended"],
  [/\btalked to\b/gi, "Communicated with"],
  [/\bshowed\b/gi, "Demonstrated"],
  [/\bmade\b/gi, "Developed"],
  [/\btold\b/gi, "Informed"],
  [/\bgave\b/gi, "Provided"],
  [/\bdo\b/gi, "Perform"],
  [/\bdid\b/gi, "Performed"],
  [/\bteach\b/gi, "Instruct and educate"],
  [/\btaught\b/gi, "Instructed and educated"],
  [/\bboss(ed)?\b/gi, "Directed"],
  [/\bkids\b/gi, "children"],
  [/\bstuff\b/gi, "materials and resources"],
  [/\ba lot of\b/gi, "numerous"],
  [/\bbig\b/gi, "substantial"],
  [/\bgood at\b/gi, "proficient in"],
  [/\bgreat at\b/gi, "highly skilled in"],
  [/\breally good\b/gi, "exceptional"],
  [/\bpeople\b/gi, "individuals"],
  [/\bteamwork\b/gi, "collaborative team engagement"],
];

const ACTION_VERBS = [
  "Spearheaded", "Orchestrated", "Implemented", "Streamlined", "Facilitated",
  "Coordinated", "Administered", "Cultivated", "Executed", "Delivered",
  "Pioneered", "Optimized", "Championed", "Directed", "Supervised",
];

// ── Common Misspellings ──

const COMMON_MISSPELLINGS: Record<string, string> = {
  "recieve": "receive", "acheive": "achieve", "occured": "occurred",
  "seperate": "separate", "definately": "definitely", "accomodate": "accommodate",
  "occassion": "occasion", "neccessary": "necessary", "independant": "independent",
  "managment": "management", "enviroment": "environment", "responsiblity": "responsibility",
  "responsable": "responsible", "experiance": "experience", "proffesional": "professional",
  "comunication": "communication", "maintanance": "maintenance", "custumer": "customer",
  "calender": "calendar", "occuring": "occurring", "sucessful": "successful",
  "restaraunt": "restaurant", "writting": "writing", "begining": "beginning",
  "beleive": "believe", "concious": "conscious", "existance": "existence",
  "foriegn": "foreign", "goverment": "government", "immediatly": "immediately",
  "knowlege": "knowledge", "liason": "liaison", "millenium": "millennium",
  "noticable": "noticeable", "persistant": "persistent", "recomend": "recommend",
  "referance": "reference", "relevent": "relevant", "sieze": "seize",
  "supercede": "supersede", "threshhold": "threshold", "untill": "until",
  "wierd": "weird", "wellfare": "welfare", "wether": "whether",
  "childcare": "childcare", "managable": "manageable", "benifits": "benefits",
  "supervison": "supervision", "curriculm": "curriculum", "certifcate": "certificate",
  "adminstration": "administration", "organiztion": "organization",
};

/**
 * Enhance a description by upgrading casual language to professional phrasing.
 */
export function enhanceDescription(raw: string, _occupation?: string): string {
  if (!raw || !raw.trim()) return raw;

  let enhanced = raw.trim();

  // Spell check first
  enhanced = spellCheck(enhanced);

  // Apply professional language upgrades
  for (const [pattern, replacement] of CASUAL_TO_PROFESSIONAL) {
    enhanced = enhanced.replace(pattern, replacement);
  }

  // Capitalize first letter of sentences
  enhanced = enhanced.replace(/(^|\.\s+)([a-z])/g, (_m, prefix, char) => prefix + char.toUpperCase());

  // Ensure it starts with a capital letter
  if (enhanced.length > 0) {
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
  }

  return enhanced;
}

/**
 * Fix common misspellings in text.
 */
export function spellCheck(text: string): string {
  let result = text;
  for (const [wrong, correct] of Object.entries(COMMON_MISSPELLINGS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    result = result.replace(regex, correct);
  }
  return result;
}

/**
 * Generate an objective statement based on user preferences.
 */
export function generateObjective(params: {
  occupation: string;
  jobType: string;
  industry?: string;
}): string {
  const { occupation, jobType, industry } = params;
  const profile = findOccupation(occupation);

  if (profile) {
    const template = profile.objectiveTemplates[jobType] || profile.objectiveTemplates["full-time"];
    if (template) return template;
  }

  // Fallback generic template
  const typeLabel = jobType || "full-time";
  const roleLabel = occupation || (industry ? `work in the ${industry} industry` : "a professional role");

  if (industry && !occupation) {
    return `Seeking ${typeLabel} employment in the ${industry} industry where I can utilize my education, skills, and experience to help further the success of the organization.`;
  }

  return `Seeking ${typeLabel} employment as a ${roleLabel} where I can utilize my education, skills, and experience to help further the success of the organization.`;
}

/**
 * Generate skill and responsibility suggestions based on occupation.
 * Filters out skills the user already has.
 */
export function generateSuggestions(
  occupation: string,
  existingSkills: string[],
  existingDescriptions: string[],
): Suggestion[] {
  const profile = findOccupation(occupation);
  if (!profile) return [];

  const existingLower = existingSkills.map((s) => s.toLowerCase());
  const existingDescLower = existingDescriptions.map((d) => d.toLowerCase());
  const suggestions: Suggestion[] = [];
  let idCounter = 0;

  // Suggest skills not already present
  for (const skill of profile.skills) {
    if (!existingLower.some((e) => e.includes(skill.toLowerCase()) || skill.toLowerCase().includes(e))) {
      suggestions.push({
        id: `sug_skill_${idCounter++}`,
        type: "skill",
        text: skill,
        status: "pending",
      });
    }
  }

  // Suggest responsibilities not already described
  for (const resp of profile.responsibilities) {
    const respLower = resp.toLowerCase();
    const alreadyHave = existingDescLower.some((d) => {
      const words = respLower.split(/\s+/).filter((w) => w.length > 4);
      const matchCount = words.filter((w) => d.includes(w)).length;
      return matchCount > words.length * 0.4;
    });
    if (!alreadyHave) {
      suggestions.push({
        id: `sug_resp_${idCounter++}`,
        type: "responsibility",
        text: resp,
        status: "pending",
      });
    }
  }

  return suggestions;
}

/**
 * Generate a professional summary based on user data.
 */
export function generateSummary(resume: Partial<Resume>, occupation?: string): string {
  const profile = occupation ? findOccupation(occupation) : null;
  const name = resume.fullName || "professional";
  const expCount = resume.experience?.length || 0;
  const skillCount = resume.skills?.length || 0;

  const parts: string[] = [];

  if (expCount > 0 && resume.experience) {
    const latestRole = resume.experience[0];
    parts.push(
      `Dedicated ${profile?.occupation || "professional"} with hands-on experience in ${latestRole.title || "the field"}.`,
    );
  } else if (profile) {
    parts.push(
      `Motivated and detail-oriented individual seeking to leverage skills and training in ${profile.occupation}.`,
    );
  } else {
    parts.push("Motivated and results-oriented professional seeking new opportunities for growth and contribution.");
  }

  if (skillCount >= 3 && resume.skills) {
    const topSkills = resume.skills.slice(0, 3).join(", ");
    parts.push(`Core competencies include ${topSkills}.`);
  }

  if (profile) {
    parts.push(`Known for strong ${profile.skills.slice(0, 2).join(" and ").toLowerCase()} abilities.`);
  }

  parts.push("Committed to delivering quality results and contributing to team success.");

  return parts.join(" ");
}

/**
 * Enhance a single work experience description into bullet points.
 */
export function enhanceExperienceDescription(rawDescription: string, jobTitle?: string): string[] {
  if (!rawDescription || !rawDescription.trim()) return [];

  const enhanced = enhanceDescription(rawDescription, jobTitle);

  // Split into sentences/bullet points
  const lines = enhanced
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Ensure each starts with an action verb
  return lines.map((line) => {
    // Check if it already starts with a common action verb
    const firstWord = line.split(/\s/)[0];
    const isActionVerb = firstWord && firstWord.charAt(0) === firstWord.charAt(0).toUpperCase() && firstWord.length > 3;
    if (isActionVerb) return line;

    // Prepend a relevant action verb
    const verb = ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)];
    return `${verb} ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  });
}
