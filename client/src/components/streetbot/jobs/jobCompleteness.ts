import type { Resume, CompletenessScore, CompletenessCheck } from "./types";

/**
 * Calculates a completeness score for a resume, checking 8 key sections.
 * Returns a score 0-100 and per-section check results with suggestions.
 */
export function calculateCompletenessScore(resume: Resume | null): CompletenessScore {
  if (!resume) {
    return {
      score: 0,
      checks: [
        { key: "fullName", label: "Full Name", complete: false, suggestion: "Include your full legal name" },
        { key: "email", label: "Email Address", complete: false, suggestion: "Provide a professional email address" },
        { key: "phone", label: "Phone Number", complete: false, suggestion: "Include a contact number for employers" },
        { key: "summary", label: "Professional Summary", complete: false, suggestion: "Compose a compelling professional summary" },
        { key: "experience", label: "Work Experience", complete: false, suggestion: "Detail at least one professional role" },
        { key: "education", label: "Education", complete: false, suggestion: "List your educational background" },
        { key: "skills", label: "Skills", complete: false, suggestion: "Highlight at least 3 core competencies" },
        { key: "certifications", label: "Certifications", complete: false, suggestion: "Add relevant certifications to strengthen your profile" },
      ],
    };
  }

  const checks: CompletenessCheck[] = [
    {
      key: "fullName",
      label: "Full Name",
      complete: !!resume.fullName?.trim(),
      suggestion: resume.fullName?.trim() ? undefined : "Include your full legal name",
    },
    {
      key: "email",
      label: "Email Address",
      complete: !!resume.email?.trim(),
      suggestion: resume.email?.trim() ? undefined : "Provide a professional email address",
    },
    {
      key: "phone",
      label: "Phone Number",
      complete: !!resume.phone?.trim(),
      suggestion: resume.phone?.trim() ? undefined : "Include a contact number so employers can reach you directly",
    },
    {
      key: "summary",
      label: "Professional Summary",
      complete: (resume.summary?.trim().length ?? 0) >= 20,
      suggestion: (resume.summary?.trim().length ?? 0) >= 20
        ? undefined
        : "Compose a compelling summary that showcases your strengths and career objectives",
    },
    {
      key: "experience",
      label: "Work Experience",
      complete: (resume.experience?.length ?? 0) >= 1,
      suggestion: (resume.experience?.length ?? 0) >= 1
        ? undefined
        : "Detail at least one professional role with measurable accomplishments",
    },
    {
      key: "education",
      label: "Education",
      complete: (resume.education?.length ?? 0) >= 1,
      suggestion: (resume.education?.length ?? 0) >= 1
        ? undefined
        : "List your educational background, including degrees or diplomas earned",
    },
    {
      key: "skills",
      label: "Core Competencies",
      complete: (resume.skills?.length ?? 0) >= 3,
      suggestion: (resume.skills?.length ?? 0) >= 3
        ? undefined
        : `Highlight at least 3 core competencies (currently ${resume.skills?.length ?? 0})`,
    },
    {
      key: "certifications",
      label: "Certifications",
      complete: (resume.certifications?.length ?? 0) >= 1,
      suggestion: (resume.certifications?.length ?? 0) >= 1
        ? undefined
        : "Add relevant certifications or licenses to strengthen your candidacy",
    },
  ];

  // Weight: first 7 checks are 14 points each (98), certifications is bonus 2 points
  const weights = [14, 14, 14, 14, 14, 14, 14, 2];
  let score = 0;
  for (let i = 0; i < checks.length; i++) {
    if (checks[i].complete) score += weights[i];
  }

  return { score: Math.min(100, score), checks };
}

/**
 * Returns a human-readable label for the completeness score.
 */
export function getCompletenessLabel(score: number): string {
  if (score >= 90) return "Outstanding";
  if (score >= 70) return "Strong Foundation";
  if (score >= 50) return "Making Progress";
  if (score >= 25) return "Building Momentum";
  return "Getting Started";
}

/**
 * Returns a color string for the completeness score.
 */
export function getCompletenessColor(score: number): string {
  if (score >= 90) return "#22c55e"; // green
  if (score >= 70) return "#3b82f6"; // blue
  if (score >= 50) return "#f59e0b"; // amber
  return "#ef4444"; // red
}
