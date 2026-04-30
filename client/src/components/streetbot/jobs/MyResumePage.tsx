import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Briefcase,
  GraduationCap,
  Award,
  Sparkles,
  Save,
  Star,
  FileText,
  Lock,
  CheckCircle,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { calculateJobMatch } from "./jobMatching";
import { enrichJobsSchedule } from "./jobSchedule";
import { calculateCompletenessScore, getCompletenessLabel, getCompletenessColor } from "./jobCompleteness";
import {
  getResume, saveResume, createEmptyResume,
  getResumeVersions, saveResumeVersion, deleteResumeVersion, setDefaultResumeVersion,
  getPrivacySettings, savePrivacySettings, getApplications,
} from "./jobsStorage";
import CoverLetterEditor from "./CoverLetterEditor";
import ResumePathChooser from "./ResumePathChooser";
import ResumeUploader from "./ResumeUploader";
import ResumeBuilder from "./ResumeBuilder";
import CoverLetterBuilder from "./CoverLetterBuilder";
import DocumentManager from "./DocumentManager";
import { getUploadedDocuments, deleteUploadedDocument, setDefaultUploadedDocument, getCoverLetters, deleteCoverLetter } from "./jobsStorage";
import type {
  Job,
  Resume,
  ResumeExperience,
  ResumeEducation,
  ResumeCertification,
  ResumeVersion,
  PrivacySettings,
  JobApplication,
} from "./types";

// ── Helpers ──

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(d: string): string {
  if (!d) return "";
  try {
    const [y, m] = d.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  } catch {
    return d;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MyResumePage
// ══════════════════════════════════════════════════════════════════════════════

export default function MyResumePage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const userId = useMemo(() => getUserId(), []);

  const [resume, setResume] = useState<Resume>(() => {
    return getResume(userId) || createEmptyResume(userId);
  });
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [toast, setToast] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [activeTab, setActiveTab] = useState<"resume" | "coverLetters">("resume");
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings>(() => getPrivacySettings(userId));
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [recentApps, setRecentApps] = useState<JobApplication[]>([]);
  const [resumeView, setResumeView] = useState<"main" | "chooser" | "upload" | "builder">("main");
  const [coverLetterView, setCoverLetterView] = useState<"main" | "chooser" | "upload" | "builder">("main");
  const [uploadedDocs, setUploadedDocs] = useState(() => getUploadedDocuments(userId));

  // Load resume versions, applications
  useEffect(() => {
    const versions = getResumeVersions(userId);
    setResumeVersions(versions);
    if (versions.length > 0 && !activeVersionId) {
      const defaultV = versions.find((v) => v.isDefault) || versions[0];
      setActiveVersionId(defaultV.id);
    }
    const apps = getApplications(userId).filter((a) => !a.withdrawn).sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    setRecentApps(apps.slice(0, 5));
  }, [userId]);

  // Auto-save whenever resume changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveResume(resume);
      // Also save to active resume version
      if (activeVersionId) {
        const versions = getResumeVersions(userId);
        const v = versions.find((ver) => ver.id === activeVersionId);
        if (v) {
          saveResumeVersion({ ...v, resume });
        }
      }
      setLastSaved(new Date().toLocaleTimeString());
    }, 500);
    return () => clearTimeout(timer);
  }, [resume]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoadingJobs(true);
      try {
        const response = await fetch(`${SB_API_BASE}/jobs`);
        if (!response.ok) throw new Error("Failed to load jobs");
        const data = await response.json();
        if (!cancelled) {
          setJobs(Array.isArray(data) ? enrichJobsSchedule(data) : []);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJobs(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Field updaters ──

  const updateField = useCallback(
    <K extends keyof Resume>(key: K, value: Resume[K]) => {
      setResume((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ── Experience ──

  const addExperience = useCallback(() => {
    setResume((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          id: genId(),
          title: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          description: "",
        },
      ],
    }));
  }, []);

  const updateExperience = useCallback(
    (id: string, updates: Partial<ResumeExperience>) => {
      setResume((prev) => ({
        ...prev,
        experience: prev.experience.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }));
    },
    []
  );

  const removeExperience = useCallback((id: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  }, []);

  // ── Education ──

  const addEducation = useCallback(() => {
    setResume((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: genId(),
          institution: "",
          degree: "",
          field: "",
          startDate: "",
          endDate: "",
          current: false,
        },
      ],
    }));
  }, []);

  const updateEducation = useCallback(
    (id: string, updates: Partial<ResumeEducation>) => {
      setResume((prev) => ({
        ...prev,
        education: prev.education.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }));
    },
    []
  );

  const removeEducation = useCallback((id: string) => {
    setResume((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  }, []);

  // ── Certifications ──

  const addCertification = useCallback(() => {
    setResume((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        { id: genId(), name: "", issuer: "", date: "" },
      ],
    }));
  }, []);

  const updateCertification = useCallback(
    (id: string, updates: Partial<ResumeCertification>) => {
      setResume((prev) => ({
        ...prev,
        certifications: prev.certifications.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },
    []
  );

  const removeCertification = useCallback((id: string) => {
    setResume((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((c) => c.id !== id),
    }));
  }, []);

  // ── Skills ──

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (resume.skills.includes(trimmed)) {
      setSkillInput("");
      return;
    }
    setResume((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setSkillInput("");
  }, [skillInput, resume.skills]);

  const removeSkill = useCallback((skill: string) => {
    setResume((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  }, []);

  const addInterest = useCallback(() => {
    const trimmed = interestInput.trim();
    if (!trimmed) return;
    if (resume.interests.includes(trimmed)) {
      setInterestInput("");
      return;
    }
    setResume((prev) => ({ ...prev, interests: [...prev.interests, trimmed] }));
    setInterestInput("");
  }, [interestInput, resume.interests]);

  const removeInterest = useCallback((interest: string) => {
    setResume((prev) => ({
      ...prev,
      interests: prev.interests.filter((item) => item !== interest),
    }));
  }, []);

  const recommendedJobs = useMemo(() => {
    return jobs
      .map((job) => ({
        job,
        match: calculateJobMatch(job, resume),
      }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 6);
  }, [jobs, resume]);

  // ── Shared styles ──

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: "14px",
    border: `1px solid ${colors.border}`,
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)",
    padding: "10px 14px",
    fontSize: "14px",
    color: colors.text,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: "80px",
    resize: "vertical",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: 500,
    color: colors.textSecondary,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: colors.text,
    margin: "0 0 16px 0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const cardStyle: React.CSSProperties = {
    ...glassCard,
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
  };

  const addBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "12px",
    border: `1px dashed ${colors.border}`,
    background: "transparent",
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: 500,
    color: colors.textSecondary,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "inherit",
  };

  const removeBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: `1px solid rgba(239,68,68,0.3)`,
    background: "rgba(239,68,68,0.08)",
    color: "#ef4444",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Preview Mode
  // ══════════════════════════════════════════════════════════════════════════

  const renderPreview = () => (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px", paddingBottom: "20px", borderBottom: `1px solid ${colors.border}` }}>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: colors.text, margin: "0 0 4px 0" }}>
          {resume.fullName || "Your Name"}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center", fontSize: "13px", color: colors.textSecondary, marginTop: "10px" }}>
          {resume.email && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Mail style={{ width: "14px", height: "14px", color: colors.accent }} /> {resume.email}
            </span>
          )}
          {resume.phone && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Phone style={{ width: "14px", height: "14px", color: colors.accent }} /> {resume.phone}
            </span>
          )}
          {resume.location && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <MapPin style={{ width: "14px", height: "14px", color: colors.accent }} /> {resume.location}
            </span>
          )}
          {resume.website && (
            <a href={resume.website} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: colors.textSecondary, textDecoration: "none" }}>
              <Globe style={{ width: "14px", height: "14px", color: colors.accent }} /> Portfolio
            </a>
          )}
          {resume.linkedin && (
            <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: colors.textSecondary, textDecoration: "none" }}>
              <Linkedin style={{ width: "14px", height: "14px", color: colors.accent }} /> LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <section style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Summary
          </h3>
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: colors.textSecondary, margin: 0, whiteSpace: "pre-wrap" }}>
            {resume.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 14px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Experience
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {resume.experience.map((exp) => (
              <div key={exp.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: colors.text }}>{exp.title || "Untitled Role"}</div>
                    <div style={{ fontSize: "13px", color: colors.textSecondary }}>
                      {exp.company}{exp.location ? ` \u2022 ${exp.location}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textMuted, whiteSpace: "nowrap" }}>
                    {formatDate(exp.startDate)} \u2013 {exp.current ? "Present" : formatDate(exp.endDate || "")}
                  </div>
                </div>
                {exp.description && (
                  <p style={{ fontSize: "13px", lineHeight: 1.7, color: colors.textSecondary, margin: "6px 0 0 0", whiteSpace: "pre-wrap" }}>
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 14px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Education
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {resume.education.map((edu) => (
              <div key={edu.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: colors.text }}>
                    {edu.degree}{edu.field ? `, ${edu.field}` : ""}
                  </div>
                  <div style={{ fontSize: "13px", color: colors.textSecondary }}>{edu.institution}</div>
                </div>
                <div style={{ fontSize: "12px", color: colors.textMuted, whiteSpace: "nowrap" }}>
                  {formatDate(edu.startDate)} \u2013 {edu.current ? "Present" : formatDate(edu.endDate || "")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Skills
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {resume.skills.map((skill) => (
              <span
                key={skill}
                style={{
                  borderRadius: "9999px",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${colors.border}`,
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: colors.text,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {resume.interests.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Interests
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {resume.interests.map((interest) => (
              <span
                key={interest}
                style={{
                  borderRadius: "9999px",
                  background: isDark ? "rgba(255,214,0,0.08)" : "rgba(255,214,0,0.14)",
                  border: `1px solid rgba(255, 214, 0, 0.25)`,
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: colors.text,
                }}
              >
                {interest}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Certifications */}
      {resume.certifications.length > 0 && (
        <section>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: colors.accent, margin: "0 0 14px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Certifications
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {resume.certifications.map((cert) => (
              <div key={cert.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{cert.name}</div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary }}>{cert.issuer}</div>
                </div>
                {cert.date && (
                  <div style={{ fontSize: "12px", color: colors.textMuted }}>{formatDate(cert.date)}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!resume.fullName && !resume.summary && resume.experience.length === 0 && resume.education.length === 0 && resume.skills.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: colors.textMuted }}>
          <User style={{ width: "48px", height: "48px", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "15px", margin: "0 0 4px 0" }}>Your resume is empty</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Switch to Edit mode to start building</p>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Edit Mode
  // ══════════════════════════════════════════════════════════════════════════

  const renderEdit = () => (
    <>
      {/* Contact Info */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <User style={{ width: "20px", height: "20px", color: colors.accent }} />
          Personal Information
        </h3>
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} value={resume.fullName} onChange={(e) => updateField("fullName", e.target.value)} placeholder="e.g. Jordan Mitchell" />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={resume.email} onChange={(e) => updateField("email", e.target.value)} placeholder="e.g. jordan@email.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} type="tel" value={resume.phone || ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="e.g. (416) 555-0123" />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={resume.location || ""} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Toronto, ON" />
          </div>
          <div>
            <label style={labelStyle}>Website or Portfolio</label>
            <input style={inputStyle} value={resume.website || ""} onChange={(e) => updateField("website", e.target.value)} placeholder="e.g. https://yourportfolio.com" />
          </div>
          <div>
            <label style={labelStyle}>LinkedIn</label>
            <input style={inputStyle} value={resume.linkedin || ""} onChange={(e) => updateField("linkedin", e.target.value)} placeholder="e.g. linkedin.com/in/jordanmitchell" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <Sparkles style={{ width: "20px", height: "20px", color: colors.accent }} />
          Professional Summary
        </h3>
        <textarea
          style={textareaStyle}
          value={resume.summary}
          onChange={(e) => updateField("summary", e.target.value)}
          placeholder="Craft a compelling overview of your professional journey — highlight your core strengths, key accomplishments, and the unique value you bring to prospective employers..."
          rows={4}
        />
      </div>

      {/* Experience */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <Briefcase style={{ width: "20px", height: "20px", color: colors.accent }} />
          Work Experience
        </h3>
        {resume.experience.map((exp, idx) => (
          <div
            key={exp.id}
            style={{
              padding: "18px",
              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
              borderRadius: "14px",
              border: `1px solid ${colors.border}`,
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textMuted }}>Position {idx + 1}</span>
              <button style={removeBtnStyle} onClick={() => removeExperience(exp.id)} aria-label="Remove position">
                <Trash2 style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Job Title</label>
                <input style={inputStyle} value={exp.title} onChange={(e) => updateExperience(exp.id, { title: e.target.value })} placeholder="e.g. Program Coordinator" />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={exp.company} onChange={(e) => updateExperience(exp.id, { company: e.target.value })} placeholder="e.g. Community Health Network" />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={exp.location || ""} onChange={(e) => updateExperience(exp.id, { location: e.target.value })} placeholder="e.g. Toronto, ON" />
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input style={inputStyle} type="month" value={exp.startDate} onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input style={inputStyle} type="month" value={exp.endDate || ""} onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })} disabled={exp.current} />
              </div>
              <div style={{ display: "flex", alignItems: "end", paddingBottom: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.textSecondary, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={exp.current}
                    onChange={(e) => updateExperience(exp.id, { current: e.target.checked, endDate: "" })}
                    style={{ accentColor: colors.accent }}
                  />
                  Currently here
                </label>
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={textareaStyle}
                value={exp.description}
                onChange={(e) => updateExperience(exp.id, { description: e.target.value })}
                placeholder="Outline your key responsibilities, measurable accomplishments, and the impact you made in this role..."
                rows={3}
              />
            </div>
          </div>
        ))}
        <button style={addBtnStyle} onClick={addExperience}>
          <Plus style={{ width: "14px", height: "14px" }} /> Add Experience
        </button>
      </div>

      {/* Education */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <GraduationCap style={{ width: "20px", height: "20px", color: colors.accent }} />
          Education
        </h3>
        {resume.education.map((edu, idx) => (
          <div
            key={edu.id}
            style={{
              padding: "18px",
              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
              borderRadius: "14px",
              border: `1px solid ${colors.border}`,
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textMuted }}>Education {idx + 1}</span>
              <button style={removeBtnStyle} onClick={() => removeEducation(edu.id)} aria-label="Remove education">
                <Trash2 style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Institution</label>
                <input style={inputStyle} value={edu.institution} onChange={(e) => updateEducation(edu.id, { institution: e.target.value })} placeholder="e.g. University of Toronto" />
              </div>
              <div>
                <label style={labelStyle}>Degree</label>
                <input style={inputStyle} value={edu.degree} onChange={(e) => updateEducation(edu.id, { degree: e.target.value })} placeholder="e.g. Bachelor of Arts" />
              </div>
              <div>
                <label style={labelStyle}>Field of Study</label>
                <input style={inputStyle} value={edu.field || ""} onChange={(e) => updateEducation(edu.id, { field: e.target.value })} placeholder="e.g. Social Work, Business Administration" />
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input style={inputStyle} type="month" value={edu.startDate} onChange={(e) => updateEducation(edu.id, { startDate: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input style={inputStyle} type="month" value={edu.endDate || ""} onChange={(e) => updateEducation(edu.id, { endDate: e.target.value })} disabled={edu.current} />
              </div>
              <div style={{ display: "flex", alignItems: "end", paddingBottom: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.textSecondary, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={edu.current}
                    onChange={(e) => updateEducation(edu.id, { current: e.target.checked, endDate: "" })}
                    style={{ accentColor: colors.accent }}
                  />
                  Currently enrolled
                </label>
              </div>
            </div>
          </div>
        ))}
        <button style={addBtnStyle} onClick={addEducation}>
          <Plus style={{ width: "14px", height: "14px" }} /> Add Education
        </button>
      </div>

      {/* Skills */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <Sparkles style={{ width: "20px", height: "20px", color: colors.accent }} />
          Core Competencies &amp; Skills
        </h3>
        <p style={{ fontSize: "0.8rem", color: colors.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>
          Showcase the expertise that sets you apart. Include both technical proficiencies and transferable skills.
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            placeholder="Enter a skill and press Enter (e.g. Project Management, Data Analysis)..."
          />
          <button
            onClick={addSkill}
            style={{
              borderRadius: "14px",
              border: `1px solid ${colors.accent}`,
              background: "transparent",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              color: colors.accent,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            <Plus style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
        {resume.skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {resume.skills.map((skill) => (
              <span
                key={skill}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "9999px",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${colors.border}`,
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: colors.text,
                }}
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: colors.textMuted,
                  }}
                  aria-label={`Remove ${skill}`}
                >
                  <X style={{ width: "12px", height: "12px" }} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <Sparkles style={{ width: "20px", height: "20px", color: colors.accent }} />
          Career Interests
        </h3>
        <p style={{ margin: "0 0 14px 0", fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>
          Add the kinds of work, industries, causes, or environments you want more of so we can personalize job recommendations for you.
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } }}
            placeholder="Enter your interests (e.g. Community Development, Digital Media)..."
          />
          <button
            onClick={addInterest}
            style={{
              borderRadius: "14px",
              border: `1px solid ${colors.accent}`,
              background: "transparent",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              color: colors.accent,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            <Plus style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
        {resume.interests.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {resume.interests.map((interest) => (
              <span
                key={interest}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "9999px",
                  background: isDark ? "rgba(255,214,0,0.08)" : "rgba(255,214,0,0.14)",
                  border: `1px solid rgba(255, 214, 0, 0.25)`,
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: colors.text,
                }}
              >
                {interest}
                <button
                  onClick={() => removeInterest(interest)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: colors.textMuted,
                  }}
                  aria-label={`Remove ${interest}`}
                >
                  <X style={{ width: "12px", height: "12px" }} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <Award style={{ width: "20px", height: "20px", color: colors.accent }} />
          Certifications
        </h3>
        {resume.certifications.map((cert, idx) => (
          <div
            key={cert.id}
            style={{
              padding: "18px",
              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
              borderRadius: "14px",
              border: `1px solid ${colors.border}`,
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textMuted }}>Certification {idx + 1}</span>
              <button style={removeBtnStyle} onClick={() => removeCertification(cert.id)} aria-label="Remove certification">
                <Trash2 style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Certification Name</label>
                <input style={inputStyle} value={cert.name} onChange={(e) => updateCertification(cert.id, { name: e.target.value })} placeholder="e.g. First Aid/CPR, WHMIS" />
              </div>
              <div>
                <label style={labelStyle}>Issuer</label>
                <input style={inputStyle} value={cert.issuer} onChange={(e) => updateCertification(cert.id, { issuer: e.target.value })} placeholder="e.g. Canadian Red Cross" />
              </div>
              <div>
                <label style={labelStyle}>Date Earned</label>
                <input style={inputStyle} type="month" value={cert.date || ""} onChange={(e) => updateCertification(cert.id, { date: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
        <button style={addBtnStyle} onClick={addCertification}>
          <Plus style={{ width: "14px", height: "14px" }} /> Add Certification
        </button>
      </div>

      {/* ── Save & Generate Resume ── */}
      <div style={{
        ...glassCard,
        padding: "28px",
        borderRadius: "20px",
        marginTop: "8px",
        textAlign: "center",
        background: isDark
          ? "linear-gradient(135deg, rgba(255,214,0,0.06), rgba(255,255,255,0.03))"
          : "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(255,255,255,0.6))",
        border: `1px solid ${isDark ? "rgba(255,214,0,0.15)" : "rgba(255,214,0,0.25)"}`,
      }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>
          Ready to Finalize Your Resume?
        </h3>
        <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px", lineHeight: 1.5 }}>
          Review your details above, then save to generate your professional resume. Your information is auto-saved as you type, but clicking below ensures everything is up to date.
        </p>
        <button
          onClick={() => {
            saveResume(resume);
            if (activeVersionId) {
              const versions = getResumeVersions(userId);
              const v = versions.find((ver) => ver.id === activeVersionId);
              if (v) saveResumeVersion({ ...v, resume });
            }
            setLastSaved(new Date().toLocaleTimeString());
            setToast("Resume saved successfully!");
            setMode("preview");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 36px",
            borderRadius: "14px",
            border: "none",
            background: "linear-gradient(135deg, #FFD600, #E6C200)",
            color: "#000",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255, 214, 0, 0.35)",
            transition: "all 0.2s",
          }}
        >
          <Save style={{ width: "18px", height: "18px" }} />
          Save &amp; Preview Resume
        </button>
      </div>
    </>
  );

  const renderRecommendations = () => (
    <div style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
        <div>
          <h3 style={{ ...sectionTitleStyle, marginBottom: "8px" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: colors.accent }} />
            Tailored Opportunities for You
          </h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>
            These curated matches are powered by your skills, experience, and professional interests. A more complete resume yields higher-quality recommendations.
          </p>
        </div>
      </div>

      {isLoadingJobs ? (
        <p style={{ margin: 0, fontSize: "14px", color: colors.textSecondary }}>Loading recommendations...</p>
      ) : recommendedJobs.length === 0 ? (
        <p style={{ margin: 0, fontSize: "14px", color: colors.textSecondary }}>
          Add your skills and areas of interest to receive personalized job recommendations tailored to your profile.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {recommendedJobs.map(({ job, match }) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                borderRadius: "18px",
                border: `1px solid ${colors.border}`,
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)",
                padding: "18px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: colors.text }}>{job.title}</div>
                  <div style={{ fontSize: "13px", color: colors.textSecondary }}>
                    {job.organization || "Street Voices"}{job.location ? ` • ${job.location}` : ""}
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: "9999px",
                    padding: "10px 14px",
                    background: match.score >= 75
                      ? "rgba(16,185,129,0.14)"
                      : match.score >= 60
                        ? "rgba(245,158,11,0.14)"
                        : "rgba(59,130,246,0.12)",
                    border: `1px solid ${match.score >= 75 ? "rgba(16,185,129,0.28)" : match.score >= 60 ? "rgba(245,158,11,0.28)" : "rgba(59,130,246,0.24)"}`,
                    minWidth: "120px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "22px", fontWeight: 800, color: colors.text }}>{match.score}%</div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {match.label}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {job.work_mode && (
                  <span style={{ borderRadius: "9999px", padding: "6px 12px", fontSize: "12px", fontWeight: 500, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                    {job.work_mode}
                  </span>
                )}
                {job.hours_per_week && (
                  <span style={{ borderRadius: "9999px", padding: "6px 12px", fontSize: "12px", fontWeight: 500, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                    {job.hours_per_week}
                  </span>
                )}
                {job.opportunity_type && (
                  <span style={{ borderRadius: "9999px", padding: "6px 12px", fontSize: "12px", fontWeight: 500, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                    {job.opportunity_type}
                  </span>
                )}
              </div>

              {match.reasons.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "8px", color: colors.textSecondary }}>
                  {match.reasons.map((reason) => (
                    <li key={reason} style={{ fontSize: "14px", lineHeight: 1.6 }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ══════════════════════════════════════════════════════════════════════════

  const hasResumes = resumeVersions.length > 0 || uploadedDocs.filter((d) => d.kind === "resume").length > 0;
  const hasCoverLetters = getCoverLetters(userId).length > 0 || uploadedDocs.filter((d) => d.kind === "cover_letter").length > 0;

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "860px", margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* ═══ HEADER — clean and simple ═══ */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Link
            to="/jobs"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              borderRadius: "12px", border: `1px solid ${colors.border}`,
              background: colors.surface, backdropFilter: "blur(24px)",
              padding: "8px 14px", fontSize: "13px", fontWeight: 500,
              color: colors.textSecondary, textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: "14px", height: "14px" }} /> Jobs
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: colors.text, margin: 0 }}>
            My Documents
          </h1>
        </div>
        <p style={{ fontSize: "0.9rem", color: colors.textMuted, margin: "0 0 24px" }}>
          Upload or create your resume and cover letter to apply for jobs.
        </p>

        {/* ═══ TAB NAVIGATION — Resume / Cover Letters ═══ */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderRadius: "14px", border: `1px solid ${colors.border}`, background: colors.surface, overflow: "hidden", width: "fit-content" }}>
          <button
            onClick={() => { setActiveTab("resume"); setResumeView("main"); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", border: "none", background: activeTab === "resume" ? colors.accent : "transparent", color: activeTab === "resume" ? "#000" : colors.textSecondary }}
          >
            <FileText size={14} /> Resume
          </button>
          <button
            onClick={() => { setActiveTab("coverLetters"); setCoverLetterView("main"); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", border: "none", background: activeTab === "coverLetters" ? colors.accent : "transparent", color: activeTab === "coverLetters" ? "#000" : colors.textSecondary }}
          >
            <Mail size={14} /> Cover Letters
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* ═══ RESUME TAB ═══ */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "resume" && (
          <>
            {/* Builder view */}
            {resumeView === "builder" ? (
              <ResumeBuilder
                userId={userId} existingResume={resume}
                onComplete={() => {
                  setResumeView("main");
                  setResume(getResume(userId) || createEmptyResume(userId));
                  setResumeVersions(getResumeVersions(userId));
                  setMode("preview"); // Show preview immediately after creating
                }}
                onCancel={() => setResumeView("main")}
                colors={colors} isDark={isDark} glassCard={glassCard} glassSurface={glassSurface}
              />
            ) : resumeView === "upload" ? (
              <ResumeUploader
                userId={userId} kind="resume"
                onComplete={() => { setResumeView("main"); setUploadedDocs(getUploadedDocuments(userId)); }}
                onCancel={() => setResumeView("main")}
                colors={colors} isDark={isDark} glassCard={glassCard}
              />
            ) : (
              /* ── Main resume view ── */
              <>
                {/* Two big action buttons — always visible */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                  <button
                    onClick={() => setResumeView("upload")}
                    style={{
                      ...glassSurface, padding: "24px 20px", borderRadius: "20px",
                      border: `2px solid transparent`, cursor: "pointer", textAlign: "center",
                      transition: "all 0.3s ease", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "12px",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3B82F6"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Copy size={22} color="#3B82F6" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: colors.text }}>Upload Resume</div>
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>Add your existing PDF or Word file</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setResumeView("builder")}
                    style={{
                      ...glassSurface, padding: "24px 20px", borderRadius: "20px",
                      border: `2px solid transparent`, cursor: "pointer", textAlign: "center",
                      transition: "all 0.3s ease", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "12px",
                      background: isDark ? "linear-gradient(135deg, rgba(255,214,0,0.06), rgba(255,255,255,0.03))" : "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(255,255,255,0.6))",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#FFD600"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,214,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sparkles size={22} color="#FFD600" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: colors.text }}>Create Resume</div>
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>We'll help you build a professional one</div>
                    </div>
                  </button>
                </div>

                {/* Saved resumes list */}
                {hasResumes && (
                  <div style={{ ...glassCard, padding: "20px 24px", borderRadius: "20px", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 16px" }}>Your Saved Resumes</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {/* Created resumes */}
                      {resumeVersions.map((v) => (
                        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${colors.border}` }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,214,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FileText size={16} color="#FFD600" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>{v.label}</div>
                            <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>Created {v.isDefault ? " \u00b7 Default" : ""}</div>
                          </div>
                          <button
                            onClick={() => { setActiveVersionId(v.id); setResume(v.resume); setMode("preview"); }}
                            style={{ padding: "6px 14px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Eye size={13} /> Preview
                          </button>
                          <button
                            onClick={() => { setActiveVersionId(v.id); setResume(v.resume); setMode("edit"); }}
                            style={{ padding: "6px 12px", borderRadius: "10px", border: "none", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: colors.textMuted, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        </div>
                      ))}
                      {/* Uploaded resumes */}
                      {uploadedDocs.filter((d) => d.kind === "resume").map((doc) => (
                        <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${colors.border}` }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Copy size={16} color="#3B82F6" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>{doc.label}</div>
                            <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>Uploaded \u00b7 {doc.fileName}{doc.isDefault ? " \u00b7 Default" : ""}</div>
                          </div>
                          <button
                            onClick={() => {
                              deleteUploadedDocument(userId, doc.id);
                              setUploadedDocs(getUploadedDocuments(userId));
                            }}
                            style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.06)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit/Preview area — only show when user clicks Preview or Edit on a resume */}
                {mode === "preview" && resumeVersions.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>Resume Preview</h3>
                      <button
                        onClick={() => setMode("edit")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        <Pencil size={14} /> Switch to Edit
                      </button>
                    </div>
                    {renderPreview()}
                  </div>
                )}

                {mode === "edit" && resumeVersions.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>
                        Editing: {resumeVersions.find((v) => v.id === activeVersionId)?.label || "Resume"}
                      </h3>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {lastSaved && (
                          <span style={{ fontSize: "0.7rem", color: colors.textMuted, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Save style={{ width: "11px", height: "11px" }} /> {lastSaved}
                          </span>
                        )}
                        <button
                          onClick={() => setMode("preview")}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          <Eye size={14} /> Preview
                        </button>
                      </div>
                    </div>
                    {renderEdit()}
                  </div>
                )}

                {/* Recommendations — only show if user has a resume */}
                {hasResumes && renderRecommendations()}
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* ═══ COVER LETTERS TAB ═══ */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "coverLetters" && (
          <>
            {coverLetterView === "builder" ? (
              <CoverLetterBuilder
                userId={userId}
                onComplete={() => setCoverLetterView("main")}
                onCancel={() => setCoverLetterView("main")}
                colors={colors} isDark={isDark} glassCard={glassCard} glassSurface={glassSurface}
              />
            ) : coverLetterView === "upload" ? (
              <ResumeUploader
                userId={userId} kind="cover_letter"
                onComplete={() => { setCoverLetterView("main"); setUploadedDocs(getUploadedDocuments(userId)); }}
                onCancel={() => setCoverLetterView("main")}
                colors={colors} isDark={isDark} glassCard={glassCard}
              />
            ) : (
              <>
                {/* Two big action buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                  <button
                    onClick={() => setCoverLetterView("upload")}
                    style={{
                      ...glassSurface, padding: "24px 20px", borderRadius: "20px",
                      border: `2px solid transparent`, cursor: "pointer", textAlign: "center",
                      transition: "all 0.3s ease", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "12px",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3B82F6"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Copy size={22} color="#3B82F6" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: colors.text }}>Upload Cover Letter</div>
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>Add your existing PDF or Word file</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCoverLetterView("builder")}
                    style={{
                      ...glassSurface, padding: "24px 20px", borderRadius: "20px",
                      border: `2px solid transparent`, cursor: "pointer", textAlign: "center",
                      transition: "all 0.3s ease", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "12px",
                      background: isDark ? "linear-gradient(135deg, rgba(255,214,0,0.06), rgba(255,255,255,0.03))" : "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(255,255,255,0.6))",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#FFD600"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,214,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sparkles size={22} color="#FFD600" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: colors.text }}>Create Cover Letter</div>
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>We'll generate a tailored one for you</div>
                    </div>
                  </button>
                </div>

                {/* Saved cover letters */}
                {hasCoverLetters && (
                  <div style={{ ...glassCard, padding: "20px 24px", borderRadius: "20px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 16px" }}>Your Saved Cover Letters</h3>
                    <CoverLetterEditor userId={userId} colors={colors} isDark={isDark} glassCard={glassCard} glassSurface={glassSurface} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
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
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
          }}
        >
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
