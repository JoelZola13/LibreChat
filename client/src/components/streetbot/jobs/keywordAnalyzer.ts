/**
 * Keyword extraction and gap analysis for matching resumes against job postings.
 */

import type { Job, Resume } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was",
  "one", "our", "out", "day", "had", "has", "his", "how", "its", "may", "new",
  "now", "old", "see", "way", "who", "did", "get", "let", "say", "she", "too",
  "use", "with", "this", "that", "from", "they", "been", "have", "many", "some",
  "them", "than", "each", "make", "like", "long", "look", "more", "most", "only",
  "over", "such", "take", "will", "into", "year", "your", "work", "also", "back",
  "about", "would", "there", "their", "which", "could", "other", "after", "first",
  "well", "just", "where", "what", "when", "able", "must", "should", "being",
  "every", "those", "through", "while", "these", "between", "before", "under",
  "including", "within", "experience", "working", "strong", "ability", "looking",
  "skills", "position", "candidate", "opportunity", "required", "preferred",
]);

/**
 * Extract meaningful keywords from text.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  // Count frequency and return unique keywords sorted by frequency
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

/**
 * Extract keywords from a job posting.
 */
export function extractJobKeywords(job: Job): string[] {
  const text = [
    job.title,
    job.organization,
    job.description,
    job.responsibilities,
    job.requirements,
    job.nice_to_have,
    job.tags,
    job.category,
  ]
    .filter(Boolean)
    .join(" ");

  return extractKeywords(text);
}

/**
 * Extract keywords from a resume.
 */
export function extractResumeKeywords(resume: Resume): string[] {
  const parts = [
    resume.summary,
    ...(resume.skills || []),
    ...(resume.interests || []),
    ...(resume.experience || []).map((e) => `${e.title} ${e.company} ${e.description}`),
    ...(resume.education || []).map((e) => `${e.degree} ${e.field || ""} ${e.institution}`),
    ...(resume.certifications || []).map((c) => `${c.name} ${c.issuer}`),
  ].filter(Boolean);

  return extractKeywords(parts.join(" "));
}

/**
 * Compare resume keywords against a specific job posting.
 */
export function compareKeywords(
  resumeKeywords: string[],
  jobKeywords: string[],
): { matched: string[]; missing: string[]; score: number } {
  const resumeSet = new Set(resumeKeywords.map((k) => k.toLowerCase()));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jobKeywords.slice(0, 30)) {
    if (resumeSet.has(keyword.toLowerCase())) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = jobKeywords.length > 0
    ? Math.round((matched.length / Math.min(jobKeywords.length, 30)) * 100)
    : 0;

  return { matched, missing: missing.slice(0, 15), score };
}

export type KeywordSuggestion = {
  keyword: string;
  frequency: number;
  fromJobs: string[];
};

/**
 * Analyze multiple job postings and suggest keywords to add to a resume.
 */
export function suggestKeywordsFromJobs(
  resume: Resume,
  jobs: Job[],
): KeywordSuggestion[] {
  const resumeKeywords = new Set(extractResumeKeywords(resume).map((k) => k.toLowerCase()));
  const keywordFreq: Record<string, { count: number; jobs: string[] }> = {};

  for (const job of jobs.slice(0, 20)) {
    const jobKw = extractJobKeywords(job);
    for (const kw of jobKw.slice(0, 20)) {
      if (!resumeKeywords.has(kw.toLowerCase())) {
        if (!keywordFreq[kw]) keywordFreq[kw] = { count: 0, jobs: [] };
        keywordFreq[kw].count++;
        if (!keywordFreq[kw].jobs.includes(job.title)) {
          keywordFreq[kw].jobs.push(job.title);
        }
      }
    }
  }

  return Object.entries(keywordFreq)
    .map(([keyword, data]) => ({
      keyword,
      frequency: data.count,
      fromJobs: data.jobs,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);
}

/**
 * Get keyword gap analysis for a resume against a specific job.
 */
export function getKeywordGapAnalysis(
  resume: Resume,
  job: Job,
): { matched: string[]; missing: string[]; suggestions: string[] } {
  const resumeKw = extractResumeKeywords(resume);
  const jobKw = extractJobKeywords(job);
  const { matched, missing } = compareKeywords(resumeKw, jobKw);

  // Generate actionable suggestions from missing keywords
  const suggestions = missing.slice(0, 8).map((kw) => {
    return `Consider adding "${kw}" to your resume to better match this role`;
  });

  return { matched, missing, suggestions };
}
