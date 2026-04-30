import type { ApplicationDocument, Job, JobApplication, ApplicationStatus, EmployerListing, Resume, ResumeVersion, CoverLetter, PrivacySettings, PostedJob, UploadedDocument } from "./types";

const APPS_KEY = "sb_job_applications";
const RESUME_KEY = "sb_user_resume";
const EMPLOYER_KEY = "sb_employer_listings";
const SEEDED_KEY = "sb_jobs_seeded";
const RESUME_VERSIONS_KEY = "sb_resume_versions";
const COVER_LETTERS_KEY = "sb_cover_letters";
const PRIVACY_KEY = "sb_privacy_settings";
const POSTED_JOBS_KEY = "sb_posted_jobs";
const UPLOADED_DOCS_KEY = "sb_uploaded_documents";

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Applications ──

export function getApplications(userId: string): JobApplication[] {
  return read<JobApplication>(APPS_KEY).filter((a) => a.userId === userId);
}

function getEmployerEmail(job: Job): string {
  if (job.employer_email) return job.employer_email;

  if (job.company_website) {
    try {
      const hostname = new URL(job.company_website).hostname.replace(/^www\./, "");
      return `hiring@${hostname}`;
    } catch {
      // Fall through to organization-based fallback.
    }
  }

  const orgSlug = (job.organization || "streetvoices")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${orgSlug || "streetvoices"}@employer.streetvoices.local`;
}

export function getApplicationByJob(userId: string, jobId: string): JobApplication | null {
  return (
    read<JobApplication>(APPS_KEY).find(
      (a) => a.userId === userId && a.jobId === jobId && !a.withdrawn,
    ) || null
  );
}

export function addApplication(
  userId: string,
  job: Job,
  details?: {
    applicantName?: string;
    applicantEmail?: string;
    coverNote?: string;
    documents?: ApplicationDocument[];
  },
): JobApplication {
  const apps = read<JobApplication>(APPS_KEY);
  const now = new Date().toISOString();
  const existingIndex = apps.findIndex(
    (a) => a.userId === userId && a.jobId === job.id && !a.withdrawn,
  );

  const nextApp: JobApplication = {
    id:
      existingIndex !== -1
        ? apps[existingIndex].id
        : `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: job.id,
    userId,
    status: "applied",
    appliedAt: existingIndex !== -1 ? apps[existingIndex].appliedAt : now,
    updatedAt: now,
    withdrawn: false,
    applicantName: details?.applicantName ?? apps[existingIndex]?.applicantName,
    applicantEmail: details?.applicantEmail ?? apps[existingIndex]?.applicantEmail,
    coverNote: details?.coverNote ?? apps[existingIndex]?.coverNote,
    documents: details?.documents ?? apps[existingIndex]?.documents ?? [],
    employerNotification: {
      email: getEmployerEmail(job),
      sentAt: now,
      status: "sent",
    },
    jobSnapshot: {
      title: job.title,
      organization: job.organization,
      logo_url: job.logo_url,
      opportunity_type: job.opportunity_type,
      location: job.location,
      compensation: job.compensation,
    },
  };

  if (existingIndex !== -1) {
    apps[existingIndex] = nextApp;
  } else {
    apps.push(nextApp);
  }

  write(APPS_KEY, apps);
  return nextApp;
}

export function withdrawApplication(userId: string, applicationId: string) {
  const apps = read<JobApplication>(APPS_KEY);
  const idx = apps.findIndex((a) => a.id === applicationId && a.userId === userId);
  if (idx !== -1) {
    apps[idx].withdrawn = true;
    apps[idx].updatedAt = new Date().toISOString();
    write(APPS_KEY, apps);
  }
}

export function withdrawApplicationByJob(userId: string, jobId: string) {
  const apps = read<JobApplication>(APPS_KEY);
  const idx = apps.findIndex(
    (a) => a.userId === userId && a.jobId === jobId && !a.withdrawn,
  );
  if (idx !== -1) {
    apps[idx].withdrawn = true;
    apps[idx].updatedAt = new Date().toISOString();
    write(APPS_KEY, apps);
  }
}

export function isJobApplied(userId: string, jobId: string): boolean {
  return read<JobApplication>(APPS_KEY).some(
    (a) => a.userId === userId && a.jobId === jobId && !a.withdrawn,
  );
}

// ── Resume ──

export function getResume(userId: string): Resume | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const resume = JSON.parse(raw) as Partial<Resume>;
    if (resume.userId !== userId) return null;
    return {
      userId,
      fullName: resume.fullName || "",
      email: resume.email || "",
      phone: resume.phone || "",
      location: resume.location || "",
      website: resume.website || "",
      linkedin: resume.linkedin || "",
      summary: resume.summary || "",
      experience: Array.isArray(resume.experience) ? resume.experience : [],
      education: Array.isArray(resume.education) ? resume.education : [],
      skills: Array.isArray(resume.skills) ? resume.skills : [],
      interests: Array.isArray(resume.interests) ? resume.interests : [],
      certifications: Array.isArray(resume.certifications) ? resume.certifications : [],
      updatedAt: resume.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveResume(resume: Resume): void {
  resume.updatedAt = new Date().toISOString();
  localStorage.setItem(RESUME_KEY, JSON.stringify(resume));
}

export function createEmptyResume(userId: string): Resume {
  return {
    userId,
    fullName: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    summary: "",
    experience: [],
    education: [],
    skills: [],
    interests: [],
    certifications: [],
    updatedAt: new Date().toISOString(),
  };
}

// ── Employer Listings ──

export function getEmployerListings(userId: string): EmployerListing[] {
  return read<EmployerListing>(EMPLOYER_KEY).filter((l) => l.userId === userId);
}

export function toggleListingActive(userId: string, jobId: string) {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  const idx = listings.findIndex((l) => l.jobId === jobId && l.userId === userId);
  if (idx !== -1) {
    listings[idx].isActive = !listings[idx].isActive;
    write(EMPLOYER_KEY, listings);
  }
}

export function getEmployerListing(userId: string, jobId: string): EmployerListing | null {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  return listings.find((l) => l.jobId === jobId && l.userId === userId) || null;
}

export function addEmployerListing(userId: string, jobData: PostedJob): EmployerListing {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  const now = new Date().toISOString();
  const listing: EmployerListing = {
    jobId: jobData.id,
    userId,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    expirationDate: jobData.expirationDate,
    positionFilled: false,
    autoCloseOnHire: jobData.autoCloseOnHire ?? false,
    jobData,
    jobSnapshot: {
      title: jobData.title,
      organization: jobData.organization,
      logo_url: jobData.logo_url,
      opportunity_type: jobData.opportunity_type,
      location: jobData.location,
      compensation: jobData.compensation,
      description: jobData.description,
    },
    stats: { viewCount: 0, applicationCount: 0, screeningCount: 0, interviewCount: 0, offerCount: 0, hiredCount: 0 },
  };
  listings.push(listing);
  write(EMPLOYER_KEY, listings);
  return listing;
}

export function updateEmployerListing(userId: string, jobId: string, updates: Partial<EmployerListing>): void {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  const idx = listings.findIndex((l) => l.jobId === jobId && l.userId === userId);
  if (idx !== -1) {
    listings[idx] = { ...listings[idx], ...updates, updatedAt: new Date().toISOString() };
    write(EMPLOYER_KEY, listings);
  }
}

export function deleteEmployerListing(userId: string, jobId: string): void {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  write(EMPLOYER_KEY, listings.filter((l) => !(l.jobId === jobId && l.userId === userId)));
}

// ── Application Pipeline ──

export function updateApplicationStatus(applicationId: string, newStatus: ApplicationStatus): void {
  const apps = read<JobApplication>(APPS_KEY);
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx !== -1) {
    apps[idx].status = newStatus;
    apps[idx].updatedAt = new Date().toISOString();
    write(APPS_KEY, apps);
  }
}

export function getApplicationsForJob(jobId: string): JobApplication[] {
  return read<JobApplication>(APPS_KEY).filter((a) => a.jobId === jobId && !a.withdrawn);
}

export function getAllApplications(): JobApplication[] {
  return read<JobApplication>(APPS_KEY);
}

// ── Job Expiration ──

export function checkAndExpireJobs(userId: string): void {
  const listings = read<EmployerListing>(EMPLOYER_KEY);
  const now = new Date();
  let changed = false;
  for (const listing of listings) {
    if (listing.userId === userId && listing.isActive && listing.expirationDate) {
      if (new Date(listing.expirationDate) <= now) {
        listing.isActive = false;
        listing.updatedAt = now.toISOString();
        changed = true;
      }
    }
  }
  if (changed) write(EMPLOYER_KEY, listings);
}

// ── Resume Versions ──

export function getResumeVersions(userId: string): ResumeVersion[] {
  const versions = read<ResumeVersion>(RESUME_VERSIONS_KEY).filter((v) => v.userId === userId);
  // Backward compat: migrate legacy single resume if no versions exist
  if (versions.length === 0) {
    const legacy = getResume(userId);
    if (legacy) {
      const now = new Date().toISOString();
      const migrated: ResumeVersion = {
        id: `rv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        label: "My Resume",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        resume: legacy,
      };
      const all = read<ResumeVersion>(RESUME_VERSIONS_KEY);
      all.push(migrated);
      write(RESUME_VERSIONS_KEY, all);
      return [migrated];
    }
  }
  return versions;
}

export function saveResumeVersion(version: ResumeVersion): void {
  const all = read<ResumeVersion>(RESUME_VERSIONS_KEY);
  const idx = all.findIndex((v) => v.id === version.id);
  version.updatedAt = new Date().toISOString();
  version.resume.updatedAt = version.updatedAt;
  if (idx !== -1) {
    all[idx] = version;
  } else {
    all.push(version);
  }
  write(RESUME_VERSIONS_KEY, all);
  // Also update legacy key if this is the default
  if (version.isDefault) {
    saveResume(version.resume);
  }
}

export function deleteResumeVersion(userId: string, versionId: string): void {
  const all = read<ResumeVersion>(RESUME_VERSIONS_KEY);
  const userVersions = all.filter((v) => v.userId === userId);
  if (userVersions.length <= 1) return; // Don't delete the last version
  const filtered = all.filter((v) => !(v.id === versionId && v.userId === userId));
  // If we deleted the default, make the first remaining version default
  const remaining = filtered.filter((v) => v.userId === userId);
  if (remaining.length > 0 && !remaining.some((v) => v.isDefault)) {
    remaining[0].isDefault = true;
  }
  write(RESUME_VERSIONS_KEY, filtered);
}

export function setDefaultResumeVersion(userId: string, versionId: string): void {
  const all = read<ResumeVersion>(RESUME_VERSIONS_KEY);
  for (const v of all) {
    if (v.userId === userId) {
      v.isDefault = v.id === versionId;
    }
  }
  write(RESUME_VERSIONS_KEY, all);
  // Also update legacy key
  const defaultVersion = all.find((v) => v.id === versionId);
  if (defaultVersion) {
    saveResume(defaultVersion.resume);
  }
}

export function getDefaultResume(userId: string): Resume | null {
  const versions = getResumeVersions(userId);
  const defaultVersion = versions.find((v) => v.isDefault) || versions[0];
  return defaultVersion?.resume || getResume(userId);
}

// ── Cover Letters ──

export function getCoverLetters(userId: string): CoverLetter[] {
  return read<CoverLetter>(COVER_LETTERS_KEY).filter((c) => c.userId === userId);
}

export function saveCoverLetter(letter: CoverLetter): void {
  const all = read<CoverLetter>(COVER_LETTERS_KEY);
  const idx = all.findIndex((c) => c.id === letter.id);
  letter.updatedAt = new Date().toISOString();
  if (idx !== -1) {
    all[idx] = letter;
  } else {
    all.push(letter);
  }
  write(COVER_LETTERS_KEY, all);
}

export function deleteCoverLetter(userId: string, letterId: string): void {
  const all = read<CoverLetter>(COVER_LETTERS_KEY);
  write(COVER_LETTERS_KEY, all.filter((c) => !(c.id === letterId && c.userId === userId)));
}

// ── Privacy Settings ──

export function getPrivacySettings(userId: string): PrivacySettings {
  try {
    const raw = localStorage.getItem(PRIVACY_KEY);
    if (raw) {
      const settings = JSON.parse(raw) as PrivacySettings;
      if (settings.userId === userId) return settings;
    }
  } catch { /* use defaults */ }
  return {
    userId,
    profileVisibility: "public",
    resumeVisibility: "employers_only",
    showEmail: true,
    showPhone: false,
    showLocation: true,
  };
}

export function savePrivacySettings(settings: PrivacySettings): void {
  localStorage.setItem(PRIVACY_KEY, JSON.stringify(settings));
}

// ── Posted Jobs (employer-created, visible in main listings) ──

export function getPostedJobs(): PostedJob[] {
  return read<PostedJob>(POSTED_JOBS_KEY);
}

export function savePostedJob(job: PostedJob): void {
  const all = read<PostedJob>(POSTED_JOBS_KEY);
  const idx = all.findIndex((j) => j.id === job.id);
  job.updatedAt = new Date().toISOString();
  if (idx !== -1) {
    all[idx] = job;
  } else {
    all.push(job);
  }
  write(POSTED_JOBS_KEY, all);
}

export function deletePostedJob(jobId: string): void {
  const all = read<PostedJob>(POSTED_JOBS_KEY);
  write(POSTED_JOBS_KEY, all.filter((j) => j.id !== jobId));
}

// ── Uploaded Documents ──

export function getUploadedDocuments(userId: string, kind?: "resume" | "cover_letter"): UploadedDocument[] {
  const all = read<UploadedDocument>(UPLOADED_DOCS_KEY).filter((d) => d.userId === userId);
  return kind ? all.filter((d) => d.kind === kind) : all;
}

export function saveUploadedDocument(doc: UploadedDocument): void {
  const all = read<UploadedDocument>(UPLOADED_DOCS_KEY);
  const idx = all.findIndex((d) => d.id === doc.id);
  doc.updatedAt = new Date().toISOString();
  if (idx !== -1) {
    all[idx] = doc;
  } else {
    all.push(doc);
  }
  write(UPLOADED_DOCS_KEY, all);
}

export function deleteUploadedDocument(userId: string, docId: string): void {
  const all = read<UploadedDocument>(UPLOADED_DOCS_KEY);
  write(UPLOADED_DOCS_KEY, all.filter((d) => !(d.id === docId && d.userId === userId)));
}

export function setDefaultUploadedDocument(userId: string, docId: string, kind: "resume" | "cover_letter"): void {
  const all = read<UploadedDocument>(UPLOADED_DOCS_KEY);
  for (const d of all) {
    if (d.userId === userId && d.kind === kind) {
      d.isDefault = d.id === docId;
    }
  }
  write(UPLOADED_DOCS_KEY, all);
}

export function getStorageUsage(): { used: number; limit: number; percentage: number } {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("sb_")) {
      total += (localStorage.getItem(key) || "").length * 2; // UTF-16 = 2 bytes per char
    }
  }
  const limit = 5 * 1024 * 1024; // 5MB conservative estimate
  return { used: total, limit, percentage: Math.round((total / limit) * 100) };
}

// ── Sample Data Seeding ──

export function seedIfNeeded(userId: string) {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, "1");

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

  const sampleApps: JobApplication[] = [
    {
      id: "app_seed_1",
      jobId: "sample-1",
      userId,
      status: "interview",
      appliedAt: daysAgo(12),
      updatedAt: daysAgo(3),
      withdrawn: false,
      jobSnapshot: {
        title: "Junior Web Developer",
        organization: "TechStart Toronto",
        logo_url: "/job-logos/techstart.svg",
        opportunity_type: "Full-time",
        location: "Toronto, ON",
        compensation: "$55,000-65,000/year",
      },
    },
    {
      id: "app_seed_2",
      jobId: "sample-2",
      userId,
      status: "under_review",
      appliedAt: daysAgo(5),
      updatedAt: daysAgo(5),
      withdrawn: false,
      jobSnapshot: {
        title: "Social Media Coordinator",
        organization: "Maple Leaf Marketing",
        logo_url: "/job-logos/mapleleaf.svg",
        opportunity_type: "Full-time",
        location: "Vancouver, BC",
        compensation: "$45,000-52,000/year",
      },
    },
    {
      id: "app_seed_3",
      jobId: "sample-4",
      userId,
      status: "offered",
      appliedAt: daysAgo(21),
      updatedAt: daysAgo(1),
      withdrawn: false,
      jobSnapshot: {
        title: "Graphic Designer",
        organization: "Creative Collective Studio",
        logo_url: "/job-logos/creative-collective.svg",
        opportunity_type: "Contract",
        location: "Montreal, QC",
        compensation: "$35-50/hour",
      },
    },
    {
      id: "app_seed_4",
      jobId: "sample-5",
      userId,
      status: "rejected",
      appliedAt: daysAgo(30),
      updatedAt: daysAgo(14),
      withdrawn: false,
      jobSnapshot: {
        title: "Delivery Driver",
        organization: "QuickShip Logistics",
        logo_url: "/job-logos/quickship.svg",
        opportunity_type: "Full-time",
        location: "Ottawa, ON",
        compensation: "$18-22/hour + mileage",
      },
    },
    {
      id: "app_seed_5",
      jobId: "sample-3",
      userId,
      status: "applied",
      appliedAt: daysAgo(1),
      updatedAt: daysAgo(1),
      withdrawn: false,
      jobSnapshot: {
        title: "Barista",
        organization: "Grounded Coffee Co.",
        logo_url: "/job-logos/grounded.svg",
        opportunity_type: "Part-time",
        location: "Calgary, AB",
        compensation: "$16.50/hour + tips",
      },
    },
  ];

  const sampleListings: EmployerListing[] = [
    {
      jobId: "emp_seed_1",
      userId,
      createdAt: daysAgo(45),
      isActive: true,
      jobSnapshot: {
        title: "Community Outreach Coordinator",
        organization: "Street Voices Community Services",
        logo_url: "/job-logos/street-voices.svg",
        opportunity_type: "Full-time",
        location: "Toronto, ON",
        compensation: "$48,000-55,000/year",
        description: "Lead community engagement initiatives and build partnerships with local organizations.",
      },
      stats: { viewCount: 234, applicationCount: 18 },
    },
    {
      jobId: "emp_seed_2",
      userId,
      createdAt: daysAgo(20),
      isActive: true,
      jobSnapshot: {
        title: "Youth Program Assistant",
        organization: "Street Voices Community Services",
        logo_url: "/job-logos/street-voices.svg",
        opportunity_type: "Part-time",
        location: "Toronto, ON",
        compensation: "$20-24/hour",
        description: "Support youth programming and after-school activities in community spaces.",
      },
      stats: { viewCount: 156, applicationCount: 12 },
    },
    {
      jobId: "emp_seed_3",
      userId,
      createdAt: daysAgo(60),
      isActive: false,
      jobSnapshot: {
        title: "Grant Writer",
        organization: "Street Voices Community Services",
        logo_url: "/job-logos/street-voices.svg",
        opportunity_type: "Contract",
        location: "Remote",
        compensation: "$40-55/hour",
        description: "Research and write grant proposals for community development projects.",
      },
      stats: { viewCount: 89, applicationCount: 7 },
    },
  ];

  write(APPS_KEY, sampleApps);
  write(EMPLOYER_KEY, sampleListings);
}
