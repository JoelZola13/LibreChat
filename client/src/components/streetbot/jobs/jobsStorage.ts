import type { Job, JobApplication, ApplicationStatus, EmployerListing } from "./types";

const APPS_KEY = "sb_job_applications";
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

export function addApplication(userId: string, job: Job): JobApplication {
  const apps = read<JobApplication>(APPS_KEY);
  const app: JobApplication = {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: job.id,
    userId,
    status: "applied",
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    withdrawn: false,
    jobSnapshot: {
      title: job.title,
      organization: job.organization,
      logo_url: job.logo_url,
      opportunity_type: job.opportunity_type,
      location: job.location,
      compensation: job.compensation,
    },
  };
  apps.push(app);
  write(APPS_KEY, apps);
  return app;
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

export function isJobApplied(userId: string, jobId: string): boolean {
  return read<JobApplication>(APPS_KEY).some(
    (a) => a.userId === userId && a.jobId === jobId && !a.withdrawn,
  );
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
