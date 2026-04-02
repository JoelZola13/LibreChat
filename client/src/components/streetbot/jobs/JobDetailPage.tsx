import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useGlassStyles } from "../shared/useGlassStyles";
import { useResponsive } from "../hooks/useResponsive";
import { getAboutThisJob, getRequirementsList, getResponsibilitiesList } from "./jobContent";
import { enrichJobSchedule, enrichJobsSchedule } from "./jobSchedule";
import { addApplication, getApplicationByJob, getResume } from "./jobsStorage";
import type { ApplicationDocument, Job, JobApplication } from "./types";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  Clock,
  DollarSign,
  ExternalLink,
  Mail,
  GraduationCap,
  Heart,
  MapPin,
  Palette,
  Share2,
  Shield,
  Sparkles,
  Star,
  X,
  Bus,
  HardHat,
  Banknote,
  UserCheck,
  FileText,
  Upload,
} from "lucide-react";

// ── Helpers ──

function getOrCreateUserId(): string {
  const key = "sb_user_id";
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId =
      "user_" +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36);
    localStorage.setItem(key, userId);
  }
  return userId;
}

const JOBS_API_URL = `${SB_API_BASE}/jobs`;

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// Organization name → logo mapping (mirrors JobsPage)
const ORGANIZATION_LOGOS: Record<string, string> = {
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

const SAMPLE_LOGOS: Record<string, string> = {
  "TechStart Toronto": "/job-logos/techstart.svg",
  "Maple Leaf Marketing": "/job-logos/mapleleaf.svg",
  "Grounded Coffee Co.": "/job-logos/grounded.svg",
  "Creative Collective Studio": "/job-logos/creative-collective.svg",
  "QuickShip Logistics": "/job-logos/quickship.svg",
  "Digital Ink Media": "/job-logos/digitalink.svg",
  "Northern Tech Solutions": "/job-logos/northern-tech.svg",
  "Celebrate Events Inc.": "/job-logos/celebrate.svg",
  "Urban Harvest": "/job-logos/urban-harvest.svg",
  "Bright Futures Education": "/job-logos/bright-futures.svg",
  "BuildRight Construction": "/job-logos/buildright.svg",
  "Metro Health Community Clinic": "/job-logos/metro-health.svg",
  "Community Care Network": "/job-logos/community-care.svg",
  "Peak Fitness Studios": "/job-logos/peak-fitness.svg",
  "Good Eats Catering": "/job-logos/good-eats.svg",
  "EcoClean Services": "/job-logos/eco-clean.svg",
  "TransitTo Solutions": "/job-logos/transit-to.svg",
  "First Nations Credit Union": "/job-logos/first-nations-cu.svg",
  "Spectrum Media Group": "/job-logos/spectrum-media.svg",
  "SecureGuard Services": "/job-logos/secure-guard.svg",
  "Apex Distribution": "/job-logos/apex-distribution.svg",
  "Spark Digital Agency": "/job-logos/spark-digital.svg",
  "Street Hope Foundation": "/job-logos/street-hope.svg",
  "Bean & Brew Coffee House": "/job-logos/bean-brew.svg",
};

function getLogoForJob(job: Job): string {
  if (job.logo_url) return job.logo_url;
  if (job.organization && ORGANIZATION_LOGOS[job.organization])
    return ORGANIZATION_LOGOS[job.organization];
  if (job.organization && SAMPLE_LOGOS[job.organization])
    return SAMPLE_LOGOS[job.organization];
  return "/job-logos/default-job.svg";
}

// ── Verification Badge (matches JobsPage) ──

function VerificationBadge({
  verificationType,
  size = "md",
}: {
  verificationType?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!verificationType) return null;

  const sizeStyles = {
    sm: { padding: "2px 8px", fontSize: "10px", iconSize: 10 },
    md: { padding: "4px 10px", fontSize: "11px", iconSize: 12 },
    lg: { padding: "6px 14px", fontSize: "13px", iconSize: 14 },
  };

  const typeConfig: Record<
    string,
    { label: string; bg: string; color: string }
  > = {
    basic: {
      label: "Verified",
      bg: "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)",
      color: "#22c55e",
    },
    business: {
      label: "Verified Business",
      bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)",
      color: "#3b82f6",
    },
    nonprofit: {
      label: "Verified Nonprofit",
      bg: "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)",
      color: "#a855f7",
    },
    government: {
      label: "Government",
      bg: "linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0.15) 100%)",
      color: "#eab308",
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
    >
      <Shield
        style={{ width: styles.iconSize, height: styles.iconSize }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

// ── Toast (matches JobsPage) ──

function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
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
        boxShadow:
          "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
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
        aria-label="Dismiss"
      >
        <X style={{ width: "16px", height: "16px" }} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// JobDetailPage
// ══════════════════════════════════════════════════════════════════════════════

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { colors, gradientOrbs, isDark } = useGlassStyles();
  const { isMobile } = useResponsive();
  const applicationSectionRef = useRef<HTMLDivElement | null>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [showApplicationSection, setShowApplicationSection] = useState(searchParams.get("apply") === "1");
  const [toast, setToast] = useState<string | null>(null);
  const [currentApplication, setCurrentApplication] = useState<JobApplication | null>(null);
  const [applicationName, setApplicationName] = useState("");
  const [applicationEmail, setApplicationEmail] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [uploadedDocuments, setUploadedDocuments] = useState<ApplicationDocument[]>([]);
  const responsibilitiesList = useMemo(() => (job ? getResponsibilitiesList(job) : []), [job]);
  const requirementsList = useMemo(() => (job ? getRequirementsList(job) : []), [job]);
  const aboutThisJob = useMemo(() => (job ? getAboutThisJob(job) : ""), [job]);

  // ── Load job ──
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        // Try API first
        const resp = await fetch(`${JOBS_API_URL}/${jobId}`);
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled) setJob(enrichJobSchedule(data));
        } else {
          // Fallback: fetch all jobs and find by id
          const allResp = await fetch(JOBS_API_URL);
          if (allResp.ok) {
            const allJobs = enrichJobsSchedule(await allResp.json());
            const found = allJobs.find((j) => j.id === jobId);
            if (!cancelled) {
              if (found) setJob(found);
              else setNotFound(true);
            }
          } else if (!cancelled) {
            setNotFound(true);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // ── Load saved / applied state ──
  useEffect(() => {
    if (!job) return;
    const userId = getOrCreateUserId();
    const existingApplication = getApplicationByJob(userId, job.id);
    const resume = getResume(userId);
    setCurrentApplication(existingApplication);
    setIsApplied(Boolean(existingApplication));
    setApplicationName(existingApplication?.applicantName || resume?.fullName || "");
    setApplicationEmail(existingApplication?.applicantEmail || resume?.email || "");
    setCoverNote(existingApplication?.coverNote || "");
    setUploadedDocuments(existingApplication?.documents || []);

    // Check favorites
    (async () => {
      try {
        const resp = await fetch(
          `${JOBS_API_URL}/favorites?user_id=${encodeURIComponent(userId)}`
        );
        if (resp.ok) {
          const data: Job[] = await resp.json();
          if (Array.isArray(data)) {
            setIsSaved(data.some((j) => j.id === job.id));
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [job]);

  useEffect(() => {
    const shouldShowApply = searchParams.get("apply") === "1";
    setShowApplicationSection(shouldShowApply);
    if (!job || !shouldShowApply) return;
    const timer = window.setTimeout(() => {
      applicationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [job, searchParams]);

  // ── Actions ──
  const toggleFavorite = useCallback(async () => {
    if (!job) return;
    const userId = getOrCreateUserId();
    try {
      const resp = await fetch(
        `${JOBS_API_URL}/${job.id}/favorite?user_id=${encodeURIComponent(userId)}`,
        { method: isSaved ? "DELETE" : "POST" }
      );
      if (!resp.ok) throw new Error();
      setIsSaved((prev) => !prev);
      setToast(isSaved ? "Removed from saved jobs" : "Job saved!");
    } catch {
      setToast("Failed to update saved jobs");
    }
  }, [job, isSaved]);

  const handleApply = useCallback(() => {
    if (!job) return;
    if (!applicationName.trim() || !applicationEmail.trim()) {
      setToast("Add your name and email before submitting.");
      return;
    }
    if (uploadedDocuments.length === 0) {
      setToast("Upload at least one document before submitting.");
      return;
    }
    const userId = getOrCreateUserId();
    const nextApplication = addApplication(userId, job, {
      applicantName: applicationName.trim(),
      applicantEmail: applicationEmail.trim(),
      coverNote: coverNote.trim(),
      documents: uploadedDocuments,
    });
    setCurrentApplication(nextApplication);
    setIsApplied(true);
    setToast("Application submitted and employer notified!");
  }, [applicationEmail, applicationName, coverNote, job, uploadedDocuments]);

  const focusApplicationSection = useCallback(() => {
    setShowApplicationSection(true);
    applicationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDocumentUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const nextDocuments = files.map((file) => {
        const lowerName = file.name.toLowerCase();
        let kind: ApplicationDocument["kind"] = "other";
        if (lowerName.includes("resume")) kind = "resume";
        else if (lowerName.includes("cover")) kind = "cover_letter";
        else if (lowerName.includes("portfolio")) kind = "portfolio";

        return {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
        };
      });

      setUploadedDocuments((prev) => [...prev, ...nextDocuments]);
      event.target.value = "";
    },
    [],
  );

  const removeUploadedDocument = useCallback((documentId: string) => {
    setUploadedDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  }, []);

  const shareJob = useCallback(() => {
    if (!job) return;
    const url = `${window.location.origin}/jobs/${job.id}`;
    const text = `Check out this opportunity: ${job.title} at ${job.organization || "Street Voices"}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text, url });
    } else {
      navigator.clipboard.writeText(url);
      setToast("Link copied to clipboard!");
    }
  }, [job]);

  // ── Tag badges config ──
  const specialBadges = useMemo(() => {
    if (!job) return [];
    const badges: { label: string; icon: typeof Sparkles; gradient: string }[] =
      [];
    if (job.black_led_organization)
      badges.push({
        label: "Black-Led Organization",
        icon: Building2,
        gradient: "linear-gradient(to right, #ec4899, #f43f5e)",
      });
    if (job.no_experience_required)
      badges.push({
        label: "No Experience Required",
        icon: Sparkles,
        gradient: "linear-gradient(to right, #60a5fa, #22d3ee)",
      });
    if (job.training_provided)
      badges.push({
        label: "Training Provided",
        icon: GraduationCap,
        gradient: "linear-gradient(to right, #4ade80, #34d399)",
      });
    if (job.is_creative_opportunity)
      badges.push({
        label: "Creative Opportunity",
        icon: Palette,
        gradient: "linear-gradient(to right, #f472b6, #facc15)",
      });
    if (job.is_media_gig)
      badges.push({
        label: "Media Gig",
        icon: Camera,
        gradient: "linear-gradient(to right, #22d3ee, #6366f1)",
      });
    if (job.hires_with_record)
      badges.push({
        label: "Second Chance Employer",
        icon: UserCheck,
        gradient: "linear-gradient(to right, #f97316, #eab308)",
      });
    if (job.hires_with_gaps)
      badges.push({
        label: "Employment Gaps OK",
        icon: UserCheck,
        gradient: "linear-gradient(to right, #a78bfa, #818cf8)",
      });
    if (job.hires_without_address)
      badges.push({
        label: "No Fixed Address OK",
        icon: UserCheck,
        gradient: "linear-gradient(to right, #fb923c, #f472b6)",
      });
    if (job.provides_work_gear)
      badges.push({
        label: "Work Gear Provided",
        icon: HardHat,
        gradient: "linear-gradient(to right, #38bdf8, #818cf8)",
      });
    if (job.same_day_pay)
      badges.push({
        label: "Same Day Pay",
        icon: Banknote,
        gradient: "linear-gradient(to right, #34d399, #22d3ee)",
      });
    if (job.is_transit_accessible)
      badges.push({
        label: "Transit Accessible",
        icon: Bus,
        gradient: "linear-gradient(to right, #60a5fa, #a78bfa)",
      });
    if (job.requires_background_check)
      badges.push({
        label: "Background Check Required",
        icon: Shield,
        gradient: "linear-gradient(to right, #f87171, #fb923c)",
      });
    return badges;
  }, [job]);

  // ── Render: Loading ──
  if (isLoading) {
    return (
      <div>
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "16px",
            color: colors.textSecondary,
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid",
              borderColor: `${colors.accent} transparent transparent transparent`,
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p>Loading job details...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render: Not Found ──
  if (notFound || !job) {
    return (
      <div>
        <div style={gradientOrbs.purple} aria-hidden="true" />
        <div style={gradientOrbs.pink} aria-hidden="true" />
        <div style={gradientOrbs.cyan} aria-hidden="true" />
        <div style={gradientOrbs.gold} aria-hidden="true" />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "16px",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <Briefcase
            style={{
              width: "64px",
              height: "64px",
              color: colors.textMuted,
            }}
          />
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: colors.text,
              margin: 0,
            }}
          >
            Job Not Found
          </h2>
          <p style={{ color: colors.textSecondary, margin: 0 }}>
            This listing may have been removed or the link is incorrect.
          </p>
          <Link
            to="/jobs"
            style={{
              marginTop: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "14px",
              background: colors.accent,
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#000",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
            }}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
            Back to Job Board
          </Link>
        </div>
      </div>
    );
  }

  const logoUrl = getLogoForJob(job);
  const tags = job.tags
    ? job.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // ══════════════════════════════════════════════════════════════════════════
  // Render: Job Detail
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Background orbs */}
      <div style={gradientOrbs.purple} aria-hidden="true" />
      <div style={gradientOrbs.pink} aria-hidden="true" />
      <div style={gradientOrbs.cyan} aria-hidden="true" />
      <div style={gradientOrbs.gold} aria-hidden="true" />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Back Navigation ── */}
        <nav
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            padding: isMobile ? "16px 12px" : "24px 24px 0",
          }}
        >
          <button
            onClick={() => navigate("/jobs")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "14px",
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              color: colors.textSecondary,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.borderHover;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
            Back to Jobs
          </button>
        </nav>

        {/* ── Main Card ── */}
        <article
          style={{
            maxWidth: "960px",
            margin: isMobile ? "16px 12px 80px" : "24px auto 80px",
            borderRadius: "24px",
            border: `1px solid ${colors.border}`,
            background: colors.cardBg,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: colors.glassShadow,
            overflow: "hidden",
          }}
        >
          {/* ── Logo Banner ── */}
          <div
            style={{
              position: "relative",
              height: isMobile ? "160px" : "220px",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <img
              src={logoUrl}
              alt={`${job.organization || job.title} logo`}
              style={{
                maxWidth: "85%",
                maxHeight: isMobile ? "120px" : "160px",
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/job-logos/default-job.svg";
              }}
            />

            {/* Opportunity Type Badge */}
            <span
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                display: "inline-block",
                borderRadius: "9999px",
                background: colors.accent,
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#000",
              }}
            >
              {job.opportunity_type || "Opportunity"}
            </span>

            {/* Featured badge */}
            {job.is_featured && (
              <span
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  borderRadius: "9999px",
                  background: colors.accent,
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#000",
                  boxShadow: "0 2px 8px rgba(255, 214, 0, 0.4)",
                }}
              >
                <Star style={{ width: "14px", height: "14px" }} fill="#000" />
                Featured
              </span>
            )}

            {/* Verified badge - bottom center */}
            {job.employer_verified && (
              <div
                style={{
                  position: "absolute",
                  bottom: "-14px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <VerificationBadge
                  verificationType={job.employer_verification_type}
                  size="lg"
                />
              </div>
            )}
          </div>

          {/* ── Content ── */}
          <div
            style={{
              padding: isMobile ? "24px 16px" : "36px 48px",
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
          >
            {/* Title & Org */}
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  fontSize: isMobile ? "24px" : "32px",
                  fontWeight: 800,
                  color: colors.text,
                  margin: "0 0 8px 0",
                  lineHeight: 1.2,
                }}
              >
                {job.title}
              </h1>
              {job.organization && (
                <p
                  style={{
                    fontSize: isMobile ? "16px" : "18px",
                    color: colors.textSecondary,
                    margin: 0,
                  }}
                >
                  {job.organization}
                </p>
              )}
            </div>

            {/* Action Buttons Row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              {showApplicationSection ? (
                <button
                  onClick={focusApplicationSection}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "14px",
                    padding: "12px 28px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: isApplied
                      ? isDark
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(16,185,129,0.1)"
                      : colors.accent,
                    color: isApplied ? "#10B981" : "#000",
                    transition: "all 0.2s",
                    boxShadow: isApplied
                      ? "none"
                      : "0 4px 14px rgba(255, 214, 0, 0.3)",
                  }}
                >
                  {isApplied ? (
                    <>View Application</>
                  ) : (
                    <>
                      <Briefcase style={{ width: "16px", height: "16px" }} />
                      Apply Now
                    </>
                  )}
                </button>
              ) : (
                <Link
                  to={`/jobs/${job.id}?apply=1`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "14px",
                    padding: "12px 28px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: colors.accent,
                    color: "#000",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
                    textDecoration: "none",
                  }}
                >
                  <Briefcase style={{ width: "16px", height: "16px" }} />
                  Apply Now
                </Link>
              )}

              <button
                onClick={toggleFavorite}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "14px",
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  backdropFilter: "blur(24px)",
                  color: isSaved ? "#ef4444" : colors.text,
                  transition: "all 0.2s",
                }}
              >
                <Heart
                  style={{ width: "16px", height: "16px" }}
                  fill={isSaved ? "#ef4444" : "none"}
                  color={isSaved ? "#ef4444" : "currentColor"}
                />
                {isSaved ? "Saved" : "Save"}
              </button>

              <button
                onClick={shareJob}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "14px",
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  backdropFilter: "blur(24px)",
                  color: colors.text,
                  transition: "all 0.2s",
                }}
              >
                <Share2 style={{ width: "16px", height: "16px" }} />
                Share
              </button>

            </div>

            {/* Special Badges */}
            {specialBadges.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "center",
                }}
                role="list"
                aria-label="Job attributes"
              >
                {specialBadges.map((badge) => (
                  <span
                    key={badge.label}
                    role="listitem"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      borderRadius: "9999px",
                      background: badge.gradient,
                      padding: "6px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    <badge.icon
                      style={{ width: "14px", height: "14px" }}
                      aria-hidden="true"
                    />
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {/* Key Info Grid */}
            <div
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fit, minmax(200px, 1fr))",
                padding: "20px",
                background: isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.02)",
                borderRadius: "16px",
                border: `1px solid ${colors.border}`,
              }}
            >
              {job.location && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <MapPin
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Location
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.location}
                    </div>
                  </div>
                </div>
              )}
              {job.compensation && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <DollarSign
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Compensation
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.compensation}
                    </div>
                  </div>
                </div>
              )}
              {job.opportunity_type && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Briefcase
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Type
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.opportunity_type}
                    </div>
                  </div>
                </div>
              )}
              {job.work_mode && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Building2
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Work Mode
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.work_mode}
                    </div>
                  </div>
                </div>
              )}
              {job.hours_per_week && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Clock
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Hours Per Week
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.hours_per_week}
                    </div>
                  </div>
                </div>
              )}
              {job.category && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Star
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Category
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.category}
                    </div>
                  </div>
                </div>
              )}
              {job.deadline && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Clock
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Application Deadline
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.deadline}
                    </div>
                  </div>
                </div>
              )}
              {job.experience_level && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <GraduationCap
                    style={{
                      width: "18px",
                      height: "18px",
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Experience Level
                    </div>
                    <div style={{ fontSize: "14px", color: colors.text, fontWeight: 500 }}>
                      {job.experience_level}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Description ── */}
            {aboutThisJob && (
              <section>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: colors.text,
                    margin: "0 0 12px 0",
                  }}
                >
                  About This Role
                </h2>
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.7,
                    color: colors.textSecondary,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {aboutThisJob}
                </p>
              </section>
            )}

            {/* ── Responsibilities ── */}
            {responsibilitiesList.length > 0 && (
              <section>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: colors.text,
                    margin: "0 0 12px 0",
                  }}
                >
                  Responsibilities
                </h2>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    color: colors.textSecondary,
                  }}
                >
                  {responsibilitiesList.map((item) => (
                    <li key={item} style={{ fontSize: "15px", lineHeight: 1.7 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Requirements ── */}
            {requirementsList.length > 0 && (
              <section>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: colors.text,
                    margin: "0 0 12px 0",
                  }}
                >
                  Requirements
                </h2>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    color: colors.textSecondary,
                  }}
                >
                  {requirementsList.map((item) => (
                    <li key={item} style={{ fontSize: "15px", lineHeight: 1.7 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!showApplicationSection && (
              <section
                style={{
                  padding: isMobile ? "20px 16px" : "24px",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  borderRadius: "18px",
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: colors.text, margin: "0 0 8px 0" }}>
                    Ready to Apply?
                  </h2>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>
                    Continue to the application page to upload your documents and submit this job application.
                  </p>
                </div>
                <Link
                  to={`/jobs/${job.id}?apply=1`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "14px",
                    background: colors.accent,
                    padding: "12px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#000",
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
                  }}
                >
                  <Briefcase style={{ width: "16px", height: "16px" }} />
                  Apply Now
                </Link>
              </section>
            )}

            {showApplicationSection && (
            <section
              ref={applicationSectionRef}
              id="application-section"
              style={{
                padding: isMobile ? "20px 16px" : "24px",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                borderRadius: "18px",
                border: `1px solid ${colors.border}`,
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: colors.text,
                    margin: "0 0 8px 0",
                  }}
                >
                  Apply for This Role
                </h2>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>
                  Submit your documents here and we&apos;ll package them with this job listing so you can review the application and notification status in one place.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>Full Name</span>
                  <input
                    type="text"
                    value={applicationName}
                    onChange={(e) => setApplicationName(e.target.value)}
                    placeholder="Your full name"
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      padding: "12px 14px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>Email Address</span>
                  <input
                    type="email"
                    value={applicationEmail}
                    onChange={(e) => setApplicationEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      padding: "12px 14px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>Cover Note</span>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Add a short note for the employer."
                  rows={5}
                  style={{
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    padding: "12px 14px",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "16px",
                  borderRadius: "14px",
                  border: `1px dashed ${colors.borderHover}`,
                  background: isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.4)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: colors.text }}>
                      Upload Documents
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary }}>
                      Add your resume, cover letter, portfolio, or supporting files.
                    </p>
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "12px",
                      background: colors.accent,
                      color: "#000",
                      padding: "10px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Upload style={{ width: "16px", height: "16px" }} />
                    Add Files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png"
                      onChange={handleDocumentUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                {uploadedDocuments.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "13px", color: colors.textMuted }}>
                    No documents uploaded yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {uploadedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: colors.surface,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: "12px", color: colors.textMuted }}>
                            {doc.kind.replace("_", " ")} · {Math.max(1, Math.round(doc.size / 1024))} KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeUploadedDocument(doc.id)}
                          style={{
                            borderRadius: "10px",
                            border: `1px solid ${colors.border}`,
                            background: "transparent",
                            color: colors.textSecondary,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: "13px", color: colors.textSecondary }}>
                  Employer notification will be sent to{" "}
                  <span style={{ color: colors.text, fontWeight: 600 }}>
                    {currentApplication?.employerNotification?.email || job.employer_email || "the employer inbox on file"}
                  </span>
                  {" "}when you submit.
                </div>
                <button
                  type="button"
                  onClick={handleApply}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "14px",
                    background: colors.accent,
                    padding: "12px 24px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#000",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
                  }}
                >
                  <Briefcase style={{ width: "16px", height: "16px" }} />
                  {isApplied ? "Update Application" : "Submit Application"}
                </button>
              </div>

              {currentApplication && (
                <div
                  id="application-summary"
                  style={{
                    display: "grid",
                    gap: "14px",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                    paddingTop: "8px",
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <section
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                    }}
                  >
                    <h3 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: 700, color: colors.text }}>
                      View Application
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: colors.textSecondary }}>
                      <div><strong style={{ color: colors.text }}>Applicant:</strong> {currentApplication.applicantName || "Not provided"}</div>
                      <div><strong style={{ color: colors.text }}>Email:</strong> {currentApplication.applicantEmail || "Not provided"}</div>
                      <div><strong style={{ color: colors.text }}>Submitted:</strong> {formatDateTime(currentApplication.appliedAt)}</div>
                      <div><strong style={{ color: colors.text }}>Status:</strong> {currentApplication.status.replace("_", " ")}</div>
                      {currentApplication.coverNote && (
                        <div><strong style={{ color: colors.text }}>Cover Note:</strong> {currentApplication.coverNote}</div>
                      )}
                    </div>
                    <Link
                      to="/jobs/my-applications"
                      style={{
                        marginTop: "14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        borderRadius: "12px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.text,
                        padding: "10px 14px",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Open My Applications
                    </Link>
                  </section>

                  <section
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                    }}
                  >
                    <h3 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: 700, color: colors.text }}>
                      Employer Email Notification
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: colors.textSecondary }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#10B981", fontWeight: 700 }}>
                        <Mail style={{ width: "15px", height: "15px" }} />
                        Notification sent
                      </div>
                      <div><strong style={{ color: colors.text }}>Recipient:</strong> {currentApplication.employerNotification?.email}</div>
                      <div><strong style={{ color: colors.text }}>Sent:</strong> {currentApplication.employerNotification ? formatDateTime(currentApplication.employerNotification.sentAt) : "Pending"}</div>
                      <div><strong style={{ color: colors.text }}>Attachments:</strong> {currentApplication.documents?.length || 0} file(s)</div>
                    </div>
                    {(currentApplication.documents?.length || 0) > 0 && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {currentApplication.documents?.map((doc) => (
                          <div key={doc.id} style={{ fontSize: "12px", color: colors.textSecondary }}>
                            {doc.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </section>
            )}

            {/* ── Nice to Have ── */}
            {job.nice_to_have && (
              <section>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: colors.text,
                    margin: "0 0 12px 0",
                  }}
                >
                  Nice to Have
                </h2>
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.7,
                    color: colors.textSecondary,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {job.nice_to_have}
                </p>
              </section>
            )}

            {/* ── Equity Statement ── */}
            {job.equity_statement && (
              <section
                style={{
                  padding: "20px",
                  background: isDark
                    ? "rgba(139, 92, 246, 0.08)"
                    : "rgba(139, 92, 246, 0.05)",
                  borderRadius: "16px",
                  border: `1px solid rgba(139, 92, 246, 0.2)`,
                }}
              >
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#a855f7",
                    margin: "0 0 8px 0",
                  }}
                >
                  Equity Statement
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.7,
                    color: colors.textSecondary,
                    margin: 0,
                  }}
                >
                  {job.equity_statement}
                </p>
              </section>
            )}

            {/* ── Tags ── */}
            {tags.length > 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: colors.textMuted,
                    margin: "0 0 10px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Tags
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/jobs?tag=${encodeURIComponent(tag)}`}
                      style={{
                        borderRadius: "9999px",
                        border: `1px solid ${colors.border}`,
                        background: colors.surface,
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: colors.textSecondary,
                        textDecoration: "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── External Apply / Company Website ── */}
            {(job.external_apply_url || job.company_website) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  paddingTop: "12px",
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                {job.external_apply_url && (
                  <a
                    href={job.external_apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "14px",
                      background: colors.accent,
                      padding: "12px 24px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#000",
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
                      transition: "all 0.2s",
                    }}
                  >
                    <ExternalLink style={{ width: "16px", height: "16px" }} />
                    Apply on Company Site
                  </a>
                )}
                {job.company_website && (
                  <a
                    href={job.company_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      padding: "12px 24px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: colors.text,
                      textDecoration: "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <ExternalLink style={{ width: "16px", height: "16px" }} />
                    Company Website
                  </a>
                )}
              </div>
            )}

            {/* ── Stats Footer ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
                paddingTop: "16px",
                borderTop: `1px solid ${colors.border}`,
                fontSize: "13px",
                color: colors.textMuted,
              }}
            >
              {typeof job.view_count === "number" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <FileText style={{ width: "14px", height: "14px" }} aria-hidden="true" />
                  {job.view_count} views
                </span>
              )}
              {typeof job.application_count === "number" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Briefcase style={{ width: "14px", height: "14px" }} aria-hidden="true" />
                  {job.application_count} applications
                </span>
              )}
              {job.posting_date && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Clock style={{ width: "14px", height: "14px" }} aria-hidden="true" />
                  Posted {job.posting_date}
                </span>
              )}
            </div>
          </div>
        </article>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
