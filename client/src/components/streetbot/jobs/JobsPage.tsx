// Module-level prefetch — fires jobs API call at import time, before mount
import './jobsPrefetch';

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isDirectory } from '~/config/appVariant';
import { useCallback, useEffect, useMemo, useState } from "react";
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { readSessionCache } from '../shared/perfCache';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useResponsive } from '../hooks/useResponsive';
import { useUserRole } from '../lib/auth/useUserRole';
import { isJobApplied, withdrawApplicationByJob } from './jobsStorage';
import { enrichJobsSchedule } from './jobSchedule';
import type { Job } from './types';
import {
  Search,
  SlidersHorizontal,
  Briefcase,
  Star,
  Heart,
  FileText,
  X,
  MapPin,
  DollarSign,
  Clock,
  Eye,
  Share2,
  Sparkles,
  GraduationCap,
  Palette,
  Camera,
  Building2,
  Loader2,
  SearchX,
  Shield,
} from "lucide-react";

// Inline userId helper (replaces @/lib/userId)
function getOrCreateUserId(): string {
  const key = "sb_user_id";
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = "user_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(key, userId);
  }
  return userId;
}

// Salary parser for filtering and sorting
function parseSalaryFromJob(job: Job): { min: number; max: number } | null {
  const text = job.salary_range || job.compensation || "";
  if (!text) return null;
  // Match patterns like "$55,000-65,000", "$16.50/hour", "$35-50/hour", "55000-65000"
  const numbers = text.replace(/[$,]/g, "").match(/(\d+(?:\.\d+)?)/g);
  if (!numbers || numbers.length === 0) return null;
  const vals = numbers.map(Number).filter((n) => !isNaN(n));
  if (vals.length === 0) return null;
  // Annualize hourly rates
  const isHourly = /hour|hr/i.test(text);
  const factor = isHourly ? 2080 : 1; // 40hrs * 52 weeks
  const min = Math.min(...vals) * factor;
  const max = Math.max(...vals) * factor;
  return { min, max };
}

// Type alias for colors object from shared glass design system
type JobColors = ReturnType<typeof useGlassStyles>['colors'];

const JOBS_API_URL = `${SB_API_BASE}/jobs`;

// Job type imported from ./types

// Sample job logos - using file-based SVGs for better rendering
const SAMPLE_LOGOS = {
  techstart: "/job-logos/techstart.svg",
  mapleleaf: "/job-logos/mapleleaf.svg",
  grounded: "/job-logos/grounded.svg",
  creative: "/job-logos/creative-collective.svg",
  quickship: "/job-logos/quickship.svg",
  digitalink: "/job-logos/digitalink.svg",
  northern: "/job-logos/northern-tech.svg",
  celebrate: "/job-logos/celebrate.svg",
  urbanHarvest: "/job-logos/urban-harvest.svg",
  brightFutures: "/job-logos/bright-futures.svg",
  buildright: "/job-logos/buildright.svg",
  metroHealth: "/job-logos/metro-health.svg",
  communityCare: "/job-logos/community-care.svg",
  peakFitness: "/job-logos/peak-fitness.svg",
  goodEats: "/job-logos/good-eats.svg",
  ecoClean: "/job-logos/eco-clean.svg",
  transitTo: "/job-logos/transit-to.svg",
  firstNationsCu: "/job-logos/first-nations-cu.svg",
  spectrumMedia: "/job-logos/spectrum-media.svg",
  secureGuard: "/job-logos/secure-guard.svg",
  apexDistribution: "/job-logos/apex-distribution.svg",
  sparkDigital: "/job-logos/spark-digital.svg",
  streetHope: "/job-logos/street-hope.svg",
  beanBrew: "/job-logos/bean-brew.svg",
  default: "/job-logos/default-job.svg",
};

// Organization name to logo mapping for database jobs
const ORGANIZATION_LOGOS: Record<string, string> = {
  // Database organizations
  "Access Alliance Multicultural Health": "/job-logos/access-alliance.svg",
  "Beats & Rhymes Youth Program": "/job-logos/beats-rhymes.svg",
  "Big Brothers Big Sisters Toronto": "/job-logos/big-brothers.svg",
  "Black Voices Media Collective": "/job-logos/black-voices-media.svg",
  "CAMH Community Programs": "/job-logos/camh.svg",
  "Community Care Network": "/job-logos/community-care.svg",
  "Community Connect Network": "/job-logos/community-connect.svg",
  "Housing First Program": "/job-logos/housing-first.svg",
  "Housing Justice Coalition": "/job-logos/housing-justice.svg",
  "North York Community Pantry": "/job-logos/north-york-pantry.svg",
  "Parks & Recreation Community Programs": "/job-logos/parks-rec.svg",
  "Regent Park Arts Collective": "/job-logos/regent-park-arts.svg",
  "Safe Haven Community Center": "/job-logos/safe-haven.svg",
  "Social Planning Council": "/job-logos/social-planning.svg",
  "Street Voices Community Services": "/job-logos/street-voices.svg",
  "TechForGood Initiative": "/job-logos/techforgood.svg",
  "The Stop Community Food Centre": "/job-logos/the-stop.svg",
  "Youth Achievement Center": "/job-logos/youth-achievement.svg",
  "Youth Services Bureau": "/job-logos/youth-services-bureau.svg",
  "Youth Wellness Hub": "/job-logos/youth-wellness-hub.svg",
};

// Get logo URL for a job based on organization name
function getLogoForJob(job: Job): string {
  if (job.logo_url) return job.logo_url;
  if (job.organization && ORGANIZATION_LOGOS[job.organization]) {
    return ORGANIZATION_LOGOS[job.organization];
  }
  // Use default job logo
  return "/job-logos/default-job.svg";
}

const SAMPLE_JOBS: Job[] = [
  {
    id: "sample-1",
    title: "Junior Web Developer",
    organization: "TechStart Toronto",
    logo_url: SAMPLE_LOGOS.techstart,
    opportunity_type: "Full-time",
    category: "Technology",
    location: "Toronto, ON",
    compensation: "$55,000-65,000/year",
    description: "Join our growing team building web applications for local businesses. Work with React, Node.js, and modern tools. Great mentorship program for those starting their tech career.",
    tags: "javascript,react,nodejs,entry level",
    is_featured: true,
    training_provided: true,
    no_experience_required: true,
    view_count: 342,
    application_count: 28,
    deadline: "2025-02-15",
    posting_date: "2025-01-15",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-2",
    title: "Social Media Coordinator",
    organization: "Maple Leaf Marketing",
    logo_url: SAMPLE_LOGOS.mapleleaf,
    opportunity_type: "Full-time",
    category: "Media",
    location: "Vancouver, BC",
    compensation: "$45,000-52,000/year",
    description: "Manage social media accounts for our diverse client roster. Create engaging content, track analytics, and grow online communities. Creative thinkers wanted!",
    tags: "social media,marketing,content creation",
    is_featured: true,
    is_media_gig: true,
    view_count: 289,
    application_count: 45,
    deadline: "2025-02-28",
    posting_date: "2025-01-20",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-3",
    title: "Barista",
    organization: "Grounded Coffee Co.",
    logo_url: SAMPLE_LOGOS.grounded,
    opportunity_type: "Part-time",
    category: "Other",
    location: "Calgary, AB",
    compensation: "$16.50/hour + tips",
    description: "Craft specialty coffee drinks and create welcoming experiences for customers. Flexible scheduling, free coffee, and opportunities to advance to shift lead.",
    tags: "coffee,customer service,hospitality",
    training_provided: true,
    no_experience_required: true,
    hires_with_gaps: true,
    view_count: 156,
    application_count: 19,
    posting_date: "2025-01-10",
  },
  {
    id: "sample-4",
    title: "Graphic Designer",
    organization: "Creative Collective Studio",
    logo_url: SAMPLE_LOGOS.creative,
    opportunity_type: "Contract",
    category: "Media",
    location: "Montreal, QC",
    compensation: "$35-50/hour",
    description: "Design branding, marketing materials, and digital assets for a variety of clients. Proficiency in Adobe Creative Suite required. Remote-friendly with occasional in-person meetings.",
    tags: "design,adobe,branding,freelance",
    is_featured: true,
    is_creative_opportunity: true,
    view_count: 412,
    application_count: 33,
    deadline: "2025-01-31",
    posting_date: "2025-01-05",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-5",
    title: "Delivery Driver",
    organization: "QuickShip Logistics",
    logo_url: SAMPLE_LOGOS.quickship,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Toronto, ON",
    compensation: "$19/hour + mileage",
    description: "Deliver packages throughout the GTA. Must have valid G license and reliable vehicle. Flexible routes and scheduling available. Same-day pay option.",
    tags: "driving,delivery,logistics",
    same_day_pay: true,
    hires_with_record: true,
    view_count: 198,
    application_count: 12,
    posting_date: "2025-01-18",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-6",
    title: "Content Writer",
    organization: "Digital Ink Media",
    logo_url: SAMPLE_LOGOS.digitalink,
    opportunity_type: "Freelance",
    category: "Media",
    location: "Remote",
    compensation: "$0.15-0.25/word",
    description: "Write blog posts, articles, and web copy for tech and lifestyle clients. Consistent work available for reliable writers. Pitch your ideas or take on assigned topics.",
    tags: "writing,content,remote,freelance",
    is_media_gig: true,
    hires_without_address: true,
    view_count: 267,
    application_count: 52,
    posting_date: "2025-01-12",
  },
  {
    id: "sample-7",
    title: "IT Support Technician",
    organization: "Northern Tech Solutions",
    logo_url: SAMPLE_LOGOS.northern,
    opportunity_type: "Full-time",
    category: "Technology",
    location: "Ottawa, ON",
    compensation: "$50,000-58,000/year",
    description: "Provide technical support for small business clients. Troubleshoot hardware and software issues, set up networks, and maintain systems. CompTIA A+ preferred but not required.",
    tags: "IT,support,networking,helpdesk",
    training_provided: true,
    view_count: 143,
    application_count: 8,
    deadline: "2025-02-15",
    posting_date: "2025-01-22",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-8",
    title: "Event Coordinator",
    organization: "Celebrate Events Inc.",
    logo_url: SAMPLE_LOGOS.celebrate,
    opportunity_type: "Part-time",
    category: "Community",
    location: "Edmonton, AB",
    compensation: "$22/hour",
    description: "Help plan and execute corporate events, weddings, and community gatherings. Great organizational skills and attention to detail a must. Weekends required.",
    tags: "events,planning,coordination",
    view_count: 187,
    application_count: 14,
    posting_date: "2025-01-08",
  },
  {
    id: "sample-9",
    title: "Community Garden Coordinator",
    organization: "Urban Harvest",
    logo_url: SAMPLE_LOGOS.urbanHarvest,
    opportunity_type: "Part-time",
    category: "Community",
    location: "Toronto, ON",
    compensation: "$20/hour",
    description: "Coordinate activities at our community gardens across the city. Organize volunteer days, lead workshops on urban farming, and help maintain garden plots. Passion for sustainability a plus!",
    tags: "gardening,community,sustainability,outdoors",
    is_featured: true,
    training_provided: true,
    no_experience_required: true,
    view_count: 234,
    application_count: 31,
    posting_date: "2025-01-25",
    employer_verified: true,
    employer_verification_type: "nonprofit",
  },
  {
    id: "sample-10",
    title: "Youth Program Facilitator",
    organization: "Bright Futures Education",
    logo_url: SAMPLE_LOGOS.brightFutures,
    opportunity_type: "Full-time",
    category: "Community",
    location: "Mississauga, ON",
    compensation: "$48,000-55,000/year",
    description: "Lead after-school programs for youth ages 12-18. Create engaging activities around STEM, arts, and life skills. Make a real difference in young people's lives!",
    tags: "education,youth,mentorship,teaching",
    training_provided: true,
    requires_background_check: true,
    view_count: 312,
    application_count: 22,
    deadline: "2025-02-10",
    posting_date: "2025-01-03",
    employer_verified: true,
    employer_verification_type: "nonprofit",
  },
  {
    id: "sample-11",
    title: "Construction Labourer",
    organization: "BuildRight Construction",
    logo_url: SAMPLE_LOGOS.buildright,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Hamilton, ON",
    compensation: "$22-28/hour",
    description: "Join our crew on residential and commercial construction sites. Learn valuable trades skills on the job. Physical work in a team environment. Safety training provided.",
    tags: "construction,trades,labour,physical",
    training_provided: true,
    provides_work_gear: true,
    hires_with_record: true,
    hires_with_gaps: true,
    view_count: 421,
    application_count: 67,
    posting_date: "2025-01-14",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-12",
    title: "Medical Receptionist",
    organization: "Metro Health Community Clinic",
    logo_url: SAMPLE_LOGOS.metroHealth,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Scarborough, ON",
    compensation: "$42,000-48,000/year",
    description: "Be the welcoming face of our community health clinic. Schedule appointments, assist patients, and support our healthcare team. Bilingual (English/French or English/Tagalog) preferred.",
    tags: "healthcare,reception,administration,customer service",
    training_provided: true,
    is_transit_accessible: true,
    view_count: 189,
    application_count: 26,
    deadline: "2025-02-05",
    posting_date: "2025-01-07",
    employer_verified: true,
    employer_verification_type: "nonprofit",
  },
  {
    id: "sample-13",
    title: "Peer Support Worker",
    organization: "Community Care Network",
    logo_url: SAMPLE_LOGOS.communityCare,
    opportunity_type: "Full-time",
    category: "Community",
    location: "Toronto, ON",
    compensation: "$45,000-52,000/year",
    description: "Use your lived experience to support others on their recovery journey. Connect clients with resources, provide emotional support, and advocate for their needs. Lived experience with homelessness or mental health required.",
    tags: "peer support,mental health,social services,advocacy",
    is_featured: true,
    training_provided: true,
    hires_without_address: true,
    hires_with_gaps: true,
    view_count: 445,
    application_count: 38,
    deadline: "2025-02-20",
    posting_date: "2024-12-28",
    employer_verified: true,
    employer_verification_type: "nonprofit",
    black_led_organization: true,
  },
  {
    id: "sample-14",
    title: "Personal Trainer",
    organization: "Peak Fitness",
    logo_url: SAMPLE_LOGOS.peakFitness,
    opportunity_type: "Part-time",
    category: "Other",
    location: "Brampton, ON",
    compensation: "$25-40/hour + commissions",
    description: "Help clients reach their fitness goals! Train individuals and small groups. Certification required (or willingness to get certified). Build your client base with our marketing support.",
    tags: "fitness,personal training,health,coaching",
    training_provided: true,
    view_count: 276,
    application_count: 19,
    posting_date: "2025-01-16",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-15",
    title: "Line Cook",
    organization: "Good Eats Kitchen",
    logo_url: SAMPLE_LOGOS.goodEats,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Toronto, ON",
    compensation: "$18-22/hour + meals",
    description: "Cook delicious food in our busy downtown restaurant. Work alongside experienced chefs. Free meals during shifts and room to grow into sous chef role.",
    tags: "cooking,restaurant,culinary,food service",
    training_provided: true,
    no_experience_required: true,
    hires_with_record: true,
    view_count: 334,
    application_count: 41,
    posting_date: "2024-12-20",
  },
  {
    id: "sample-16",
    title: "Commercial Cleaner",
    organization: "EcoClean Solutions",
    logo_url: SAMPLE_LOGOS.ecoClean,
    opportunity_type: "Part-time",
    category: "Other",
    location: "Multiple Locations, GTA",
    compensation: "$17-20/hour",
    description: "Clean offices, retail spaces, and commercial buildings using eco-friendly products. Evening and weekend shifts available. Reliable transportation required.",
    tags: "cleaning,janitorial,maintenance,evening",
    provides_work_gear: true,
    hires_without_address: true,
    hires_with_record: true,
    same_day_pay: true,
    view_count: 521,
    application_count: 89,
    posting_date: "2025-01-11",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-17",
    title: "Bus Operator Trainee",
    organization: "Transit TO",
    logo_url: SAMPLE_LOGOS.transitTo,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Toronto, ON",
    compensation: "$58,000-68,000/year",
    description: "Join Toronto's transit system! Full paid training program provided. Must have valid G license and clean driving record. Excellent benefits and pension. Union position.",
    tags: "driving,transit,public service,union",
    is_featured: true,
    training_provided: true,
    requires_background_check: true,
    view_count: 892,
    application_count: 156,
    deadline: "2025-02-28",
    posting_date: "2025-01-19",
    employer_verified: true,
    employer_verification_type: "government",
  },
  {
    id: "sample-18",
    title: "Member Services Representative",
    organization: "First Nations Credit Union",
    logo_url: SAMPLE_LOGOS.firstNationsCu,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Brantford, ON",
    compensation: "$40,000-46,000/year",
    description: "Serve members of our Indigenous-owned credit union. Help with accounts, loans, and financial planning. Knowledge of Indigenous communities an asset. We welcome applications from Indigenous peoples.",
    tags: "banking,finance,customer service,indigenous",
    training_provided: true,
    view_count: 167,
    application_count: 12,
    deadline: "2025-02-12",
    posting_date: "2024-12-30",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-19",
    title: "Video Production Assistant",
    organization: "Spectrum Media",
    logo_url: SAMPLE_LOGOS.spectrumMedia,
    opportunity_type: "Contract",
    category: "Media",
    location: "Toronto, ON",
    compensation: "$200-350/day",
    description: "Assist on commercial and music video shoots. Help with equipment, lighting, and production coordination. Great way to break into the industry. Portfolio building opportunities.",
    tags: "video,production,film,creative",
    is_creative_opportunity: true,
    is_media_gig: true,
    no_experience_required: true,
    view_count: 623,
    application_count: 78,
    posting_date: "2025-01-23",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-20",
    title: "Security Guard",
    organization: "SecureGuard Services",
    logo_url: SAMPLE_LOGOS.secureGuard,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Toronto, ON",
    compensation: "$18-22/hour",
    description: "Provide security for office buildings, events, and retail locations. Must be able to obtain security license (we help with this). Day, evening, and overnight shifts available.",
    tags: "security,patrol,safety,protection",
    training_provided: true,
    provides_work_gear: true,
    hires_with_gaps: true,
    view_count: 445,
    application_count: 53,
    posting_date: "2025-01-06",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-21",
    title: "Warehouse Associate",
    organization: "Apex Distribution Co.",
    logo_url: SAMPLE_LOGOS.apexDistribution,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Mississauga, ON",
    compensation: "$18/hour + benefits",
    description: "Pick, pack, and ship orders in our fulfillment center. Forklift experience a plus but not required. Physical work in climate-controlled environment. Multiple shifts available.",
    tags: "warehouse,logistics,shipping,forklift",
    training_provided: true,
    no_experience_required: true,
    hires_with_record: true,
    is_transit_accessible: true,
    view_count: 387,
    application_count: 62,
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-22",
    title: "Digital Marketing Intern",
    organization: "Spark Digital Agency",
    logo_url: SAMPLE_LOGOS.sparkDigital,
    opportunity_type: "Internship",
    category: "Media",
    location: "Toronto, ON",
    compensation: "$18/hour",
    description: "Paid internship learning all aspects of digital marketing. Work on real client campaigns. SEO, social media, email marketing, and analytics. Perfect for students or career changers.",
    tags: "marketing,intern,digital,learning",
    training_provided: true,
    no_experience_required: true,
    view_count: 534,
    application_count: 87,
    deadline: "2025-02-01",
    employer_verified: true,
    employer_verification_type: "business",
  },
  {
    id: "sample-23",
    title: "Community Outreach Worker",
    organization: "Street Hope Foundation",
    logo_url: SAMPLE_LOGOS.streetHope,
    opportunity_type: "Full-time",
    category: "Community",
    location: "Toronto, ON",
    compensation: "$48,000-54,000/year",
    description: "Connect with unhoused individuals on the streets. Provide immediate support and connect people to housing, health, and social services. Lived experience valued.",
    tags: "outreach,social work,homelessness,advocacy",
    training_provided: true,
    hires_without_address: true,
    hires_with_gaps: true,
    view_count: 298,
    application_count: 24,
    employer_verified: true,
    employer_verification_type: "nonprofit",
    black_led_organization: true,
  },
  {
    id: "sample-24",
    title: "Shift Supervisor",
    organization: "Bean & Brew Coffee House",
    logo_url: SAMPLE_LOGOS.beanBrew,
    opportunity_type: "Full-time",
    category: "Other",
    location: "Toronto, ON",
    compensation: "$19/hour + tips",
    description: "Lead a team of baristas at our busy downtown location. Open and close shifts, handle cash, train new staff. 1+ years coffee shop experience preferred. Great stepping stone to management.",
    tags: "coffee,supervisor,leadership,hospitality",
    training_provided: true,
    view_count: 212,
    application_count: 18,
    employer_verified: true,
    employer_verification_type: "business",
  },
];

const ENRICHED_SAMPLE_JOBS: Job[] = enrichJobsSchedule(SAMPLE_JOBS);

// Verification Badge component
function VerificationBadge({
  verificationType,
  size = "sm"
}: {
  verificationType?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!verificationType) return null;

  const sizeStyles = {
    sm: { padding: "2px 8px", fontSize: "10px", iconSize: 10 },
    md: { padding: "4px 10px", fontSize: "11px", iconSize: 12 },
    lg: { padding: "6px 12px", fontSize: "12px", iconSize: 14 },
  };

  const typeConfig: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    basic: {
      label: "Verified",
      bg: "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)",
      color: "#22c55e",
      icon: "check",
    },
    business: {
      label: "Verified Business",
      bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)",
      color: "#3b82f6",
      icon: "building",
    },
    nonprofit: {
      label: "Verified Nonprofit",
      bg: "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)",
      color: "#a855f7",
      icon: "heart",
    },
    government: {
      label: "Government",
      bg: "linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0.15) 100%)",
      color: "#eab308",
      icon: "shield",
    },
  };

  const config = typeConfig[verificationType] || typeConfig.basic;
  const styles = sizeStyles[size];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "9999px",
        background: config.bg,
        border: `1px solid ${config.color}33`,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: 600,
        color: config.color,
        whiteSpace: "nowrap",
      }}
      title={`${config.label} employer`}
    >
      <Shield style={{ width: styles.iconSize, height: styles.iconSize }} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        borderRadius: "8px",
        background: "#1f2937",
        padding: "12px 16px",
        color: "#fff",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
      }}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "#9ca3af",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Dismiss notification"
      >
        <X style={{ width: "16px", height: "16px" }} />
      </button>
    </div>
  );
}

// Job Card component
function JobCard({
  job,
  isSaved,
  onToggleFavorite,
  onShare,
  isApplied,
  onUnapply,
  colors,
  isDark,
}: {
  job: Job;
  isSaved: boolean;
  onToggleFavorite: (id: string) => void;
  onShare: (job: Job) => void;
  isApplied: boolean;
  onUnapply: (job: Job) => void;
  colors: JobColors;
  isDark: boolean;
}) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        background: colors.cardBg,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRadius: "24px",
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-8px)";
        e.currentTarget.style.borderColor = colors.borderHover;
        e.currentTarget.style.boxShadow = isDark ? "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)" : "0 20px 40px rgba(31, 38, 135, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.boxShadow = colors.glassShadow;
      }}
    >
      {/* Logo Banner Area - Matches Directory Style */}
      <div
        style={{
          position: "relative",
          height: "160px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {/* Large Logo */}
        <img loading="lazy" decoding="async"
          src={getLogoForJob(job)}
          alt={`${job.organization} logo`}
          style={{
            maxWidth: "85%",
            maxHeight: "120px",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/job-logos/default-job.svg";
          }}
        />

        {/* Opportunity Type Badge - Top Left */}
        <span
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            display: "inline-block",
            borderRadius: "9999px",
            background: colors.accent,
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#000",
          }}
        >
          {job.opportunity_type || "Opportunity"}
        </span>

        {/* Action Buttons - Top Right */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(job.id);
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              padding: 0,
            }}
            aria-label={isSaved ? "Remove from saved jobs" : "Save job"}
            aria-pressed={isSaved}
          >
            <Heart
              style={{ width: "18px", height: "18px" }}
              color={isSaved ? "#ef4444" : isDark ? "#fff" : "#666"}
              fill={isSaved ? "#ef4444" : "none"}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShare(job);
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              padding: 0,
            }}
            aria-label="Share job listing"
          >
            <Share2 style={{ width: "18px", height: "18px" }} color={isDark ? "#fff" : "#666"} />
          </button>
        </div>

        {/* Verified Badge - Bottom Center */}
        {job.employer_verified && (
          <div
            style={{
              position: "absolute",
              bottom: "-14px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <VerificationBadge verificationType={job.employer_verification_type} size="md" />
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Title & Organization */}
        <Link to={`/jobs/${job.id}`} style={{ textDecoration: "none" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "0 0 4px 0", textAlign: "center", transition: "color 0.2s" }}>
            {job.title}
          </h3>
          {job.organization && (
            <p style={{ fontSize: "14px", color: colors.textSecondary, margin: 0, textAlign: "center" }}>
              {job.organization}
            </p>
          )}
        </Link>

        {/* Description */}
        {job.description && (
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: colors.textSecondary,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              margin: 0,
              textAlign: "center",
            }}
          >
            {job.description}
          </p>
        )}

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }} role="list" aria-label="Job attributes">
          {job.black_led_organization && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "9999px", background: "linear-gradient(to right, #ec4899, #f43f5e)", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }} role="listitem">
              <Building2 style={{ width: "12px", height: "12px" }} />
              Black-Led
            </span>
          )}
          {job.no_experience_required && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "9999px", background: "linear-gradient(to right, #60a5fa, #22d3ee)", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }} role="listitem">
              <Sparkles style={{ width: "12px", height: "12px" }} />
              No Experience
            </span>
          )}
          {job.training_provided && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "9999px", background: "linear-gradient(to right, #4ade80, #34d399)", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }} role="listitem">
              <GraduationCap style={{ width: "12px", height: "12px" }} />
              Training
            </span>
          )}
          {job.is_creative_opportunity && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "9999px", background: "linear-gradient(to right, #f472b6, #facc15)", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }} role="listitem">
              <Palette style={{ width: "12px", height: "12px" }} />
              Creative
            </span>
          )}
          {job.is_media_gig && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "9999px", background: "linear-gradient(to right, #22d3ee, #6366f1)", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }} role="listitem">
              <Camera style={{ width: "12px", height: "12px" }} />
              Media
            </span>
          )}
        </div>

        {/* Meta Info - Contact/Location Box */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            borderRadius: "12px",
          }}
        >
          {job.location && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "13px", color: colors.text }}>{job.location}</span>
            </div>
          )}
          {job.compensation && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <DollarSign style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "13px", color: colors.text }}>{job.compensation}</span>
            </div>
          )}
          {job.work_mode && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Briefcase style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "13px", color: colors.text }}>{job.work_mode}</span>
            </div>
          )}
          {job.hours_per_week && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "13px", color: colors.text }}>{job.hours_per_week}</span>
            </div>
          )}
          {job.posting_date && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "13px", color: colors.text }}>Posted: {job.posting_date}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid ${colors.border}`, paddingTop: "14px" }}>
          {isApplied ? (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              <Link
                to={`/jobs/${job.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minWidth: "148px",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
              >
                View Details
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onUnapply(job);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minWidth: "148px",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid rgba(239, 68, 68, 0.35)`,
                  background: isDark ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  transition: "all 0.2s",
                }}
              >
                Unapply
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              <Link
                to={`/jobs/${job.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minWidth: "148px",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
              >
                View Details
              </Link>
              <Link
                to={`/jobs/${job.id}?apply=1`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minWidth: "148px",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${colors.accent}`,
                  background: "transparent",
                  color: colors.accent,
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
              >
                Apply Now
              </Link>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
}

// Featured Job Card component
function FeaturedJobCard({ job, colors, isDark }: { job: Job; colors: JobColors; isDark: boolean }) {
  return (
    <Link to={`/jobs/${job.id}`} style={{ display: "block", textDecoration: "none" }}>
      <article
        style={{
          position: "relative",
          borderRadius: "24px",
          border: `2px solid rgba(255, 214, 0, 0.4)`,
          background: isDark
            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(255, 214, 0, 0.08) 100%)"
            : "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(255, 214, 0, 0.05) 100%)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: `${colors.glassShadow}, 0 0 20px rgba(255, 214, 0, 0.15)`,
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-8px)";
          e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.6)";
          e.currentTarget.style.boxShadow = isDark ? "0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(255, 214, 0, 0.25)" : "0 20px 40px rgba(31, 38, 135, 0.2), 0 0 30px rgba(255, 214, 0, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255, 214, 0, 0.4)";
          e.currentTarget.style.boxShadow = `${colors.glassShadow}, 0 0 20px rgba(255, 214, 0, 0.15)`;
        }}
      >
        {/* Logo Banner Area */}
        <div
          style={{
            position: "relative",
            height: "140px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          {/* Large Logo */}
          <img loading="lazy" decoding="async"
            src={getLogoForJob(job)}
            alt={`${job.organization} logo`}
            style={{
              maxWidth: "80%",
              maxHeight: "100px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/job-logos/default-job.svg";
            }}
          />

          {/* Featured Badge - Top Left */}
          <span
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              borderRadius: "9999px",
              background: colors.accent,
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#000",
              boxShadow: "0 2px 8px rgba(255, 214, 0, 0.4)",
            }}
          >
            <Star style={{ width: "12px", height: "12px" }} fill="#000" />
            Featured
          </span>

          {/* Verified Badge */}
          {job.employer_verified && (
            <div
              style={{
                position: "absolute",
                bottom: "-14px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <VerificationBadge verificationType={job.employer_verification_type} size="md" />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "20px" }}>
          <h3 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: colors.text, textAlign: "center", transition: "color 0.2s" }}>
            {job.title}
          </h3>
          {job.organization && (
            <p style={{ marginBottom: "12px", fontSize: "14px", color: colors.textSecondary, textAlign: "center" }}>
              {job.organization}
            </p>
          )}
          <p
            style={{
              marginBottom: "14px",
              fontSize: "13px",
              lineHeight: 1.5,
              color: colors.textSecondary,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textAlign: "center",
            }}
          >
            {job.description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", fontSize: "13px", color: colors.textSecondary }}>
            {job.location && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <MapPin style={{ width: "14px", height: "14px", color: colors.accent }} aria-hidden="true" />
                {job.location}
              </span>
            )}
            {job.compensation && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <DollarSign style={{ width: "14px", height: "14px", color: colors.accent }} aria-hidden="true" />
                {job.compensation}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { colors, gradientOrbs, isDark } = useGlassStyles();
  const { isMobile } = useResponsive();

  const [isLoading, setIsLoading] = useState(() => {
    const cached = readSessionCache<Job[]>('streetbot:jobs:listings:v2', 5 * 60 * 1000);
    return !cached || cached.length === 0;
  });
  const [jobs, setJobs] = useState<Job[]>(() => {
    const cached = readSessionCache<Job[]>('streetbot:jobs:listings:v2', 5 * 60 * 1000);
    return cached && cached.length > 0 ? enrichJobsSchedule(cached) : [];
  });
  const [jobQuery, setJobQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterOpportunityType, setFilterOpportunityType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterWorkType, setFilterWorkType] = useState("");
  const [filterExperienceLevel, setFilterExperienceLevel] = useState("");
  const [filterSalaryMin, setFilterSalaryMin] = useState("");
  const [filterSalaryMax, setFilterSalaryMax] = useState("");
  const [sortMode, setSortMode] = useState("newest");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "saved">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [paginationMode, setPaginationMode] = useState<"paginated" | "infinite">("paginated");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedCount, setLoadedCount] = useState(20);
  const PAGE_SIZE = 20;
  const { isAdmin } = useUserRole();

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    jobs.forEach((job) => {
      if (job.tags) {
        job.tags.split(",").forEach((tag) => tags.add(tag.trim()));
      }
    });
    return Array.from(tags).sort();
  }, [jobs]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory) count++;
    if (filterOpportunityType) count++;
    if (filterLocation) count++;
    if (filterTags.length > 0) count += filterTags.length;
    if (filterWorkType) count++;
    if (filterExperienceLevel) count++;
    if (filterSalaryMin || filterSalaryMax) count++;
    return count;
  }, [filterCategory, filterOpportunityType, filterLocation, filterTags, filterWorkType, filterExperienceLevel, filterSalaryMin, filterSalaryMax]);

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (viewMode === "saved") {
      result = result.filter((job) => savedIds.includes(job.id));
    }

    if (jobQuery.trim()) {
      const query = jobQuery.toLowerCase();
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.organization?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query) ||
          job.location?.toLowerCase().includes(query)
      );
    }

    if (filterCategory) {
      result = result.filter((job) => job.category === filterCategory);
    }

    if (filterOpportunityType) {
      result = result.filter(
        (job) => job.opportunity_type === filterOpportunityType
      );
    }

    if (filterLocation) {
      result = result.filter((job) =>
        job.location?.toLowerCase().includes(filterLocation.toLowerCase())
      );
    }

    if (filterTags.length > 0) {
      result = result.filter((job) => {
        if (!job.tags) return false;
        const jobTags = job.tags.split(",").map((t) => t.trim());
        return filterTags.some((tag) => jobTags.includes(tag));
      });
    }

    if (filterWorkType) {
      result = result.filter((job) =>
        (job.work_mode || "").toLowerCase().includes(filterWorkType.toLowerCase())
      );
    }

    if (filterExperienceLevel) {
      result = result.filter((job) => {
        if (filterExperienceLevel === "No Experience Required") return job.no_experience_required;
        return (job.experience_level || "").toLowerCase().includes(filterExperienceLevel.toLowerCase());
      });
    }

    if (filterSalaryMin || filterSalaryMax) {
      const minVal = filterSalaryMin ? parseFloat(filterSalaryMin) : 0;
      const maxVal = filterSalaryMax ? parseFloat(filterSalaryMax) : Infinity;
      result = result.filter((job) => {
        const parsed = parseSalaryFromJob(job);
        if (!parsed) return true; // Include jobs without parseable salary
        return parsed.max >= minVal && parsed.min <= maxVal;
      });
    }

    result = [...result].sort((a, b) => {
      if (sortMode === "newest") {
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      } else if (sortMode === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      } else if (sortMode === "views") {
        return (b.view_count || 0) - (a.view_count || 0);
      } else if (sortMode === "featured") {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return 0;
      } else if (sortMode === "salary") {
        const sa = parseSalaryFromJob(a);
        const sb = parseSalaryFromJob(b);
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        return sb.max - sa.max;
      } else if (sortMode === "company") {
        const orgA = (a.organization || "").toLowerCase();
        const orgB = (b.organization || "").toLowerCase();
        if (!orgA && !orgB) return 0;
        if (!orgA) return 1;
        if (!orgB) return -1;
        return orgA.localeCompare(orgB);
      }
      return 0;
    });

    return result;
  }, [
    jobs,
    savedIds,
    viewMode,
    jobQuery,
    filterCategory,
    filterOpportunityType,
    filterLocation,
    filterTags,
    filterWorkType,
    filterExperienceLevel,
    filterSalaryMin,
    filterSalaryMax,
    sortMode,
  ]);

  const featuredJobs = useMemo(
    () => jobs.filter((job) => job.is_featured).slice(0, 3),
    [jobs]
  );

  const stats = useMemo(
    () => ({
      total: filteredJobs.length,
      featured: filteredJobs.filter((j) => j.is_featured).length,
      saved: savedIds.length,
      applications: filteredJobs.reduce(
        (acc, j) => acc + (j.application_count || 0),
        0
      ),
    }),
    [filteredJobs, savedIds]
  );

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(JOBS_API_URL);
      if (!resp.ok) throw new Error("Failed to load jobs");
      const data = await resp.json();
      const jobsData = Array.isArray(data) ? enrichJobsSchedule(data) : [];
      setJobs(jobsData.length > 0 ? jobsData : ENRICHED_SAMPLE_JOBS);
    } catch {
      setJobs(ENRICHED_SAMPLE_JOBS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const base = JOBS_API_URL.replace(/\/$/, "");
      const userId = getOrCreateUserId();
      const resp = await fetch(
        `${base}/favorites?user_id=${encodeURIComponent(userId)}`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        setSavedIds(data.map((job: Job) => job.id));
      }
    } catch {
      setSavedIds([]);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (jobId: string) => {
      const base = JOBS_API_URL.replace(/\/$/, "");
      const isSaved = savedIds.includes(jobId);
      try {
        const userId = getOrCreateUserId();
        const resp = await fetch(
          `${base}/${jobId}/favorite?user_id=${encodeURIComponent(userId)}`,
          {
            method: isSaved ? "DELETE" : "POST",
          }
        );
        if (!resp.ok) throw new Error();
        setSavedIds((prev) =>
          isSaved ? prev.filter((id) => id !== jobId) : [...prev, jobId]
        );
        setToast(isSaved ? "Removed from saved jobs" : "Job saved!");
      } catch {
        setToast("Failed to update saved jobs");
      }
    },
    [savedIds]
  );

  const shareJob = useCallback((job: Job) => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    const text = `Check out this opportunity: ${job.title} at ${job.organization || "Street Voices"}`;

    if (navigator.share) {
      navigator.share({ title: job.title, text, url });
    } else {
      navigator.clipboard.writeText(url);
      setToast("Link copied to clipboard!");
    }
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterCategory("");
    setFilterOpportunityType("");
    setFilterLocation("");
    setFilterTags([]);
    setFilterWorkType("");
    setFilterExperienceLevel("");
    setFilterSalaryMin("");
    setFilterSalaryMax("");
    setJobQuery("");
    setCurrentPage(1);
    setLoadedCount(20);
  }, []);

  // Load applied job IDs from localStorage
  const loadAppliedIds = useCallback(() => {
    const userId = getOrCreateUserId();
    const ids = jobs.map((j) => j.id).filter((id) => isJobApplied(userId, id));
    setAppliedIds(ids);
  }, [jobs]);

  const handleUnapply = useCallback((job: Job) => {
    const userId = getOrCreateUserId();
    withdrawApplicationByJob(userId, job.id);
    setAppliedIds((prev) => prev.filter((id) => id !== job.id));
    setToast("Application withdrawn.");
  }, []);

  useEffect(() => {
    loadJobs();
    loadFavorites();
  }, [loadJobs, loadFavorites]);

  useEffect(() => {
    if (jobs.length > 0) loadAppliedIds();
  }, [jobs, loadAppliedIds]);

  useEffect(() => {
    const savedParam = searchParams?.get("saved");
    if (savedParam === "1") {
      setViewMode("saved");
    }
  }, [searchParams]);

  return (
    <div>
      {/* Glassmorphism Background Orbs */}
      <div style={gradientOrbs.purple} aria-hidden="true" />
      <div style={gradientOrbs.pink} aria-hidden="true" />
      <div style={gradientOrbs.cyan} aria-hidden="true" />
      <div style={gradientOrbs.gold} aria-hidden="true" />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Hero Section */}
        <header
          style={{
            background: "transparent",
            padding: isMobile ? "32px 12px 24px" : "60px 24px 48px",
          }}
        >
          <div style={{ maxWidth: "1024px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "32px", textAlign: "center" }}>
            <div style={{ maxWidth: "768px" }}>
              <h1 style={{ fontSize: "clamp(1.875rem, 4vw, 3.75rem)", fontWeight: 800, lineHeight: 1.1, color: colors.text, margin: 0 }}>
                <span style={{ background: "linear-gradient(to right, #facc15, #ca8a04)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Discover
                </span>{" "}
                Your Next Opportunity
              </h1>
              <p style={{ marginTop: "16px", fontSize: "clamp(1rem, 2vw, 1.25rem)", color: colors.textSecondary }}>
                Connecting talent with creative, tech, and community
                opportunities across Canada
              </p>
            </div>

            {/* Search Bar */}
            <div style={{ width: "100%", maxWidth: "672px" }}>
              {isDirectory ? (
                <>
                  <style>{`.sv-search-input::placeholder { color: #000; opacity: 1; }`}</style>
                  <div style={{ display: "flex", alignItems: "center", borderRadius: 30, background: "#d3d3d3", overflow: "hidden", height: 46 }}>
                    <div style={{ flex: 3, height: "100%", display: "flex", alignItems: "center", padding: "0 20px", background: "#fff" }}>
                      <input
                        id="job-search"
                        type="text"
                        className="sv-search-input"
                        value={jobQuery}
                        onChange={(e) => setJobQuery(e.target.value)}
                        placeholder="Search jobs, companies, skills..."
                        style={{ width: "100%", height: "100%", border: "none", background: "transparent", color: "#000", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      style={{ height: 46, padding: "1px 50px", borderRadius: 25, border: "none", background: "#FFD600", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      Search
                    </button>
                  </div>
                </>
              ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  borderRadius: "20px",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  padding: "8px",
                  boxShadow: colors.glassShadow,
                }}
              >
                <Search
                  style={{ marginLeft: "8px", width: "20px", height: "20px", flexShrink: 0, color: colors.textMuted }}
                  aria-hidden="true"
                />
                <label htmlFor="job-search" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}>
                  Search jobs
                </label>
                <input
                  id="job-search"
                  type="text"
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                  placeholder="Search jobs, companies, skills..."
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    padding: "12px 8px",
                    fontSize: "16px",
                    color: colors.text,
                    outline: "none",
                    boxShadow: "none",
                  }}
                />
                {jobQuery && (
                  <button
                    type="button"
                    onClick={() => setJobQuery("")}
                    style={{
                      borderRadius: "8px",
                      padding: "8px",
                      background: "transparent",
                      border: "none",
                      color: colors.textMuted,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Clear search"
                  >
                    <X style={{ width: "16px", height: "16px" }} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "14px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: showFilters ? colors.accent : colors.surface,
                    color: showFilters ? "#000" : colors.text,
                    border: showFilters ? "none" : `1px solid ${colors.border}`,
                    boxShadow: showFilters ? "0 4px 14px rgba(255, 214, 0, 0.3)" : "none",
                  }}
                  aria-expanded={showFilters}
                  aria-controls="filters-panel"
                >
                  <SlidersHorizontal style={{ width: "16px", height: "16px" }} aria-hidden="true" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", background: "#a855f7", fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
              )}
            </div>

          </div>
        </header>

        {/* Filters Panel */}
        {showFilters && (
          <section
            id="filters-panel"
            style={{ maxWidth: "1152px", margin: "0 auto 32px", padding: "0 16px" }}
            aria-label="Filter options"
          >
            <div
              style={{
                borderRadius: isMobile ? "16px" : "24px",
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                padding: isMobile ? "16px" : "24px",
                boxShadow: colors.glassShadow,
              }}
            >
              <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: isMobile ? "16px" : "18px", fontWeight: 600, color: colors.text, margin: 0 }}>Filters</h2>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{
                    borderRadius: "10px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    padding: "8px 16px",
                    fontSize: "14px",
                    color: colors.textSecondary,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  Reset All
                </button>
              </div>

              <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div>
                  <label htmlFor="filter-category" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Category
                  </label>
                  <select
                    id="filter-category"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                    }}
                  >
                    <option value="">All Categories</option>
                    <option value="Technology">Technology</option>
                    <option value="Media">Media &amp; Creative</option>
                    <option value="Community">Community</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-type" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Opportunity Type
                  </label>
                  <select
                    id="filter-type"
                    value={filterOpportunityType}
                    onChange={(e) => setFilterOpportunityType(e.target.value)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                    }}
                  >
                    <option value="">All Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance/Gig</option>
                    <option value="Internship">Internship</option>
                    <option value="Volunteer">Volunteer</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-location" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Location
                  </label>
                  <input
                    id="filter-location"
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="City or remote"
                    style={{
                      width: "100%",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="filter-work-type" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Work Type
                  </label>
                  <select
                    id="filter-work-type"
                    value={filterWorkType}
                    onChange={(e) => { setFilterWorkType(e.target.value); setCurrentPage(1); }}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                    }}
                  >
                    <option value="">All Work Types</option>
                    <option value="Remote">Remote</option>
                    <option value="In Person">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-experience" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Experience Level
                  </label>
                  <select
                    id="filter-experience"
                    value={filterExperienceLevel}
                    onChange={(e) => { setFilterExperienceLevel(e.target.value); setCurrentPage(1); }}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                    }}
                  >
                    <option value="">All Levels</option>
                    <option value="Entry">Entry Level</option>
                    <option value="Mid">Mid Level</option>
                    <option value="Senior">Senior Level</option>
                    <option value="No Experience Required">No Experience Required</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Salary Range (Annual)
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="number"
                      value={filterSalaryMin}
                      onChange={(e) => { setFilterSalaryMin(e.target.value); setCurrentPage(1); }}
                      placeholder="Min"
                      style={{
                        flex: 1,
                        borderRadius: "14px",
                        border: `1px solid ${colors.border}`,
                        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                        padding: "10px 12px",
                        fontSize: "14px",
                        color: colors.text,
                        outline: "none",
                        boxSizing: "border-box" as const,
                      }}
                    />
                    <span style={{ color: colors.textMuted, fontSize: "14px" }}>-</span>
                    <input
                      type="number"
                      value={filterSalaryMax}
                      onChange={(e) => { setFilterSalaryMax(e.target.value); setCurrentPage(1); }}
                      placeholder="Max"
                      style={{
                        flex: 1,
                        borderRadius: "14px",
                        border: `1px solid ${colors.border}`,
                        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                        padding: "10px 12px",
                        fontSize: "14px",
                        color: colors.text,
                        outline: "none",
                        boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="filter-sort" style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Sort By
                  </label>
                  <select
                    id="filter-sort"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.5)",
                      padding: "10px 12px",
                      fontSize: "14px",
                      color: colors.text,
                      outline: "none",
                    }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="deadline">Deadline Approaching</option>
                    <option value="views">Most Viewed</option>
                    <option value="featured">Featured First</option>
                    <option value="salary">Highest Salary</option>
                    <option value="company">Company (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              {availableTags.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <span style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: colors.textSecondary }}>
                    Filter by Tags
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }} role="group" aria-label="Tag filters">
                    {availableTags.slice(0, 12).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagFilter(tag)}
                        style={{
                          borderRadius: "9999px",
                          border: filterTags.includes(tag) ? "none" : `1px solid ${colors.border}`,
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: filterTags.includes(tag) ? colors.accent : colors.surface,
                          color: filterTags.includes(tag) ? "#000" : colors.text,
                        }}
                        aria-pressed={filterTags.includes(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <main style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 16px 80px" }}>
          {/* View Tabs */}
          <nav
            style={{ marginBottom: isMobile ? "20px" : "32px", display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: `1px solid ${colors.border}`, paddingBottom: "12px", overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: isMobile ? "touch" : undefined }}
            aria-label="Job view options"
          >
            <div style={{ display: "flex", gap: isMobile ? "6px" : "8px", flexShrink: 0 }} role="tablist">
              <button
                type="button"
                onClick={() => {
                  setViewMode("all");
                  navigate("/jobs");
                }}
                role="tab"
                aria-selected={viewMode === "all"}
                style={{
                  borderRadius: "14px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: viewMode === "all" ? colors.accent : colors.surface,
                  color: viewMode === "all" ? "#000" : colors.textSecondary,
                  border: viewMode === "all" ? "none" : `1px solid ${colors.border}`,
                  boxShadow: viewMode === "all" ? "0 4px 14px rgba(255, 214, 0, 0.3)" : "none",
                }}
              >
                All Jobs
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("saved");
                  navigate("/jobs?saved=1");
                }}
                role="tab"
                aria-selected={viewMode === "saved"}
                style={{
                  borderRadius: "14px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: viewMode === "saved" ? colors.accent : colors.surface,
                  color: viewMode === "saved" ? "#000" : colors.textSecondary,
                  border: viewMode === "saved" ? "none" : `1px solid ${colors.border}`,
                  boxShadow: viewMode === "saved" ? "0 4px 14px rgba(255, 214, 0, 0.3)" : "none",
                }}
              >
                Saved
              </button>
              <Link
                to="/jobs/my-applications"
                style={{
                  borderRadius: "14px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.2s",
                  background: colors.surface,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText style={{ width: "16px", height: "16px" }} />
                My Applications
              </Link>
              <Link
                to="/jobs/resume"
                style={{
                  borderRadius: "14px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.2s",
                  background: colors.surface,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText style={{ width: "16px", height: "16px" }} />
                My Resume
              </Link>
              {isAdmin && (
                <Link
                  to="/jobs/admin"
                  style={{
                    borderRadius: "14px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "all 0.2s",
                    background: "rgba(248, 113, 113, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(248, 113, 113, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Shield style={{ width: "16px", height: "16px" }} />
                  Admin
                </Link>
              )}
            </div>
            <Link
              to="/jobs/employer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 500,
                color: colors.textMuted,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <Building2 style={{ width: "14px", height: "14px" }} />
              Employer View &rarr;
            </Link>
          </nav>


          {/* Jobs Grid */}
          <section aria-label="Job listings">
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "80px 0", color: colors.textSecondary }}>
                <Loader2
                  style={{ width: "40px", height: "40px", color: "#a855f7", animation: "spin 1s linear infinite" }}
                  aria-hidden="true"
                />
                <p>Loading opportunities...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center" }}>
                <SearchX
                  style={{ marginBottom: "16px", width: "64px", height: "64px", color: colors.textMuted }}
                  aria-hidden="true"
                />
                <h3 style={{ marginBottom: "8px", fontSize: "20px", fontWeight: 700, color: colors.text }}>
                  No jobs found
                </h3>
                <p style={{ marginBottom: "16px", color: colors.textSecondary }}>
                  Try adjusting your filters or search query
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={{
                    borderRadius: "14px",
                    background: colors.accent,
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#000",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
              {/* Pagination mode toggle & info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ fontSize: "0.85rem", color: colors.textMuted }}>
                  {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} found
                </div>
                <div style={{ display: "flex", gap: "4px", borderRadius: "10px", overflow: "hidden", border: `1px solid ${colors.border}` }}>
                  <button
                    onClick={() => { setPaginationMode("paginated"); setCurrentPage(1); }}
                    style={{
                      padding: "6px 14px", fontSize: "0.75rem", fontWeight: 600, border: "none", cursor: "pointer",
                      background: paginationMode === "paginated" ? colors.accent : "transparent",
                      color: paginationMode === "paginated" ? "#000" : colors.textMuted,
                    }}
                  >
                    Pages
                  </button>
                  <button
                    onClick={() => { setPaginationMode("infinite"); setLoadedCount(20); }}
                    style={{
                      padding: "6px 14px", fontSize: "0.75rem", fontWeight: 600, border: "none", cursor: "pointer",
                      background: paginationMode === "infinite" ? colors.accent : "transparent",
                      color: paginationMode === "infinite" ? "#000" : colors.textMuted,
                    }}
                  >
                    Scroll
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: isMobile ? "14px" : "20px", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))" }}>
                {(paginationMode === "paginated"
                  ? filteredJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  : filteredJobs.slice(0, loadedCount)
                ).map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={savedIds.includes(job.id)}
                    onToggleFavorite={toggleFavorite}
                    onShare={shareJob}
                    isApplied={appliedIds.includes(job.id)}
                    onUnapply={handleUnapply}
                    colors={colors}
                    isDark={isDark}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {paginationMode === "paginated" && filteredJobs.length > PAGE_SIZE && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={{
                      padding: "10px 20px", borderRadius: "12px", border: `1px solid ${colors.border}`,
                      background: currentPage <= 1 ? "transparent" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                      color: currentPage <= 1 ? colors.textMuted : colors.text,
                      fontWeight: 600, fontSize: "0.85rem", cursor: currentPage <= 1 ? "default" : "pointer",
                      opacity: currentPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: "0.85rem", color: colors.textSecondary, fontWeight: 500 }}>
                    Page {currentPage} of {Math.ceil(filteredJobs.length / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredJobs.length / PAGE_SIZE), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredJobs.length / PAGE_SIZE)}
                    style={{
                      padding: "10px 20px", borderRadius: "12px", border: `1px solid ${colors.border}`,
                      background: currentPage >= Math.ceil(filteredJobs.length / PAGE_SIZE) ? "transparent" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                      color: currentPage >= Math.ceil(filteredJobs.length / PAGE_SIZE) ? colors.textMuted : colors.text,
                      fontWeight: 600, fontSize: "0.85rem",
                      cursor: currentPage >= Math.ceil(filteredJobs.length / PAGE_SIZE) ? "default" : "pointer",
                      opacity: currentPage >= Math.ceil(filteredJobs.length / PAGE_SIZE) ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Infinite scroll sentinel */}
              {paginationMode === "infinite" && loadedCount < filteredJobs.length && (
                <div
                  style={{ textAlign: "center", padding: "24px", marginTop: "12px" }}
                  ref={(el) => {
                    if (!el) return;
                    const observer = new IntersectionObserver(
                      (entries) => {
                        if (entries[0].isIntersecting) {
                          setLoadedCount((prev) => prev + 20);
                          observer.disconnect();
                        }
                      },
                      { threshold: 0.1 }
                    );
                    observer.observe(el);
                  }}
                >
                  <Loader2 size={24} color={colors.textMuted} style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: "0.8rem", color: colors.textMuted, marginTop: "8px" }}>
                    Loading more jobs...
                  </div>
                </div>
              )}
              </>
            )}
          </section>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
