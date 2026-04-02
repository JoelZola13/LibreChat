export type Job = {
  id: string;
  title: string;
  organization?: string;
  employer_email?: string;
  logo_url?: string;
  work_mode?: string;
  hours_per_week?: string;
  opportunity_type?: string;
  category?: string;
  experience_level?: string;
  location?: string;
  compensation?: string;
  salary_range?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  nice_to_have?: string;
  posting_date?: string;
  deadline?: string;
  apply_method?: string;
  external_apply_url?: string;
  tags?: string;
  equity_statement?: string;
  company_website?: string;
  is_featured?: boolean;
  training_provided?: boolean;
  is_media_gig?: boolean;
  is_creative_opportunity?: boolean;
  no_experience_required?: boolean;
  black_led_organization?: boolean;
  view_count?: number;
  approval_status?: string;
  owner_id?: string;
  application_count?: number;
  status?: string;
  hires_without_address?: boolean;
  hires_with_gaps?: boolean;
  hires_with_record?: boolean;
  provides_work_gear?: boolean;
  same_day_pay?: boolean;
  requires_background_check?: boolean;
  is_transit_accessible?: boolean;
  employer_verified?: boolean;
  employer_verification_type?: string;
};

export type ApplicationStatus = "applied" | "under_review" | "interview" | "offered" | "rejected";

export type ApplicationDocument = {
  id: string;
  kind: "resume" | "cover_letter" | "portfolio" | "other";
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

export type JobApplication = {
  id: string;
  jobId: string;
  userId: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  withdrawn: boolean;
  applicantName?: string;
  applicantEmail?: string;
  coverNote?: string;
  documents?: ApplicationDocument[];
  employerNotification?: {
    email: string;
    sentAt: string;
    status: "sent";
  };
  jobSnapshot: {
    title: string;
    organization?: string;
    logo_url?: string;
    opportunity_type?: string;
    location?: string;
    compensation?: string;
  };
};

export type ResumeExperience = {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
};

export type ResumeEducation = {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
};

export type ResumeCertification = {
  id: string;
  name: string;
  issuer: string;
  date?: string;
};

export type Resume = {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  interests: string[];
  certifications: ResumeCertification[];
  updatedAt: string;
};

export type EmployerListing = {
  jobId: string;
  userId: string;
  createdAt: string;
  isActive: boolean;
  jobSnapshot: {
    title: string;
    organization?: string;
    logo_url?: string;
    opportunity_type?: string;
    location?: string;
    compensation?: string;
    description?: string;
  };
  stats: {
    viewCount: number;
    applicationCount: number;
  };
};
