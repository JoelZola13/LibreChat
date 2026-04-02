import type { ApplicationDocument, Job, JobApplication, ApplicationStatus, EmployerListing, Resume } from "./types";

const APPS_KEY = "sb_job_applications";
const RESUME_KEY = "sb_user_resume";
const EMPLOYER_KEY = "sb_employer_listings";
const SEEDED_KEY = "sb_jobs_seeded";

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
