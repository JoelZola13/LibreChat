import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, Eye, Trash2, Plus, Calendar, MapPin, DollarSign,
  Briefcase, CheckSquare, AlertCircle, X,
} from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import {
  getEmployerListing, addEmployerListing, updateEmployerListing,
  deleteEmployerListing, savePostedJob, deletePostedJob,
} from "./jobsStorage";
import type { PostedJob } from "./types";

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

const DRAFT_KEY = "sb_job_draft";

const CATEGORIES = [
  "Technology", "Media & Communications", "Healthcare", "Education",
  "Food & Hospitality", "Retail", "Creative & Design", "Social Services",
  "Transportation & Logistics", "Construction & Trades", "Administration",
  "Finance", "Legal", "Other",
];

const OPPORTUNITY_TYPES = ["Full-time", "Part-time", "Contract", "Temporary", "Seasonal"];
const WORK_TYPES = ["Remote", "In Person", "Hybrid"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior Level", "No Experience Required"];

type FormState = {
  title: string;
  organization: string;
  logo_url: string;
  description: string;
  responsibilities: string;
  requirements: string;
  nice_to_have: string;
  category: string;
  opportunity_type: string;
  work_mode: string;
  experience_level: string;
  location: string;
  compensation: string;
  salary_range: string;
  startDate: string;
  expirationDate: string;
  autoCloseOnHire: boolean;
  tags: string;
  equity_statement: string;
  company_website: string;
  hires_without_address: boolean;
  hires_with_gaps: boolean;
  hires_with_record: boolean;
  provides_work_gear: boolean;
  same_day_pay: boolean;
  training_provided: boolean;
  no_experience_required: boolean;
  is_transit_accessible: boolean;
};

const emptyForm: FormState = {
  title: "", organization: "", logo_url: "", description: "", responsibilities: "",
  requirements: "", nice_to_have: "", category: "", opportunity_type: "Full-time",
  work_mode: "In Person", experience_level: "Entry Level", location: "",
  compensation: "", salary_range: "", startDate: "", expirationDate: "",
  autoCloseOnHire: false, tags: "", equity_statement: "", company_website: "",
  hires_without_address: false, hires_with_gaps: false, hires_with_record: false,
  provides_work_gear: false, same_day_pay: false, training_provided: false,
  no_experience_required: false, is_transit_accessible: false,
};

export default function PostJobPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const navigate = useNavigate();
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const userId = useMemo(() => getUserId(), []);

  const isEdit = !!jobId;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load existing job for edit, or draft for new
  useEffect(() => {
    if (isEdit && jobId) {
      const listing = getEmployerListing(userId, jobId);
      if (listing?.jobData) {
        const j = listing.jobData;
        setForm({
          title: j.title || "", organization: j.organization || "", logo_url: j.logo_url || "",
          description: j.description || "", responsibilities: j.responsibilities || "",
          requirements: j.requirements || "", nice_to_have: j.nice_to_have || "",
          category: j.category || "", opportunity_type: j.opportunity_type || "Full-time",
          work_mode: j.work_mode || "In Person", experience_level: j.experience_level || "Entry Level",
          location: j.location || "", compensation: j.compensation || "", salary_range: j.salary_range || "",
          startDate: j.startDate || "", expirationDate: j.expirationDate || "",
          autoCloseOnHire: j.autoCloseOnHire || false, tags: j.tags || "",
          equity_statement: j.equity_statement || "", company_website: j.company_website || "",
          hires_without_address: j.hires_without_address || false,
          hires_with_gaps: j.hires_with_gaps || false,
          hires_with_record: j.hires_with_record || false,
          provides_work_gear: j.provides_work_gear || false,
          same_day_pay: j.same_day_pay || false,
          training_provided: j.training_provided || false,
          no_experience_required: j.no_experience_required || false,
          is_transit_accessible: j.is_transit_accessible || false,
        });
      }
    } else {
      try {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) setForm(JSON.parse(draft));
      } catch { /* ignore */ }
    }
  }, [isEdit, jobId, userId]);

  // Auto-save draft (new jobs only)
  useEffect(() => {
    if (!isEdit) {
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [form, isEdit]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!form.title.trim()) errs.push("Job title is required");
    if (!form.description.trim()) errs.push("Job description is required");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const now = new Date().toISOString();
    const id = isEdit && jobId ? jobId : `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const postedJob: PostedJob = {
      id,
      title: form.title.trim(),
      organization: form.organization.trim() || undefined,
      logo_url: form.logo_url.trim() || undefined,
      description: form.description.trim(),
      responsibilities: form.responsibilities.trim() || undefined,
      requirements: form.requirements.trim() || undefined,
      nice_to_have: form.nice_to_have.trim() || undefined,
      category: form.category || undefined,
      opportunity_type: form.opportunity_type || undefined,
      work_mode: form.work_mode || undefined,
      experience_level: form.experience_level || undefined,
      location: form.location.trim() || undefined,
      compensation: form.compensation.trim() || undefined,
      salary_range: form.salary_range.trim() || undefined,
      tags: form.tags.trim() || undefined,
      equity_statement: form.equity_statement.trim() || undefined,
      company_website: form.company_website.trim() || undefined,
      posting_date: form.startDate || now,
      deadline: form.expirationDate || undefined,
      hires_without_address: form.hires_without_address,
      hires_with_gaps: form.hires_with_gaps,
      hires_with_record: form.hires_with_record,
      provides_work_gear: form.provides_work_gear,
      same_day_pay: form.same_day_pay,
      training_provided: form.training_provided,
      no_experience_required: form.no_experience_required,
      is_transit_accessible: form.is_transit_accessible,
      postedBy: userId,
      startDate: form.startDate || undefined,
      expirationDate: form.expirationDate || undefined,
      autoCloseOnHire: form.autoCloseOnHire,
      createdAt: now,
      updatedAt: now,
      status: "active",
      approval_status: "approved",
      owner_id: userId,
    };

    savePostedJob(postedJob);

    if (isEdit) {
      updateEmployerListing(userId, id, {
        jobData: postedJob,
        expirationDate: form.expirationDate || undefined,
        autoCloseOnHire: form.autoCloseOnHire,
        jobSnapshot: {
          title: postedJob.title,
          organization: postedJob.organization,
          logo_url: postedJob.logo_url,
          opportunity_type: postedJob.opportunity_type,
          location: postedJob.location,
          compensation: postedJob.compensation,
          description: postedJob.description,
        },
      });
      showToast("Job listing updated!");
    } else {
      addEmployerListing(userId, postedJob);
      localStorage.removeItem(DRAFT_KEY);
      showToast("Job listing created!");
    }

    setTimeout(() => navigate("/jobs/employer"), 500);
  };

  const handleDelete = () => {
    if (isEdit && jobId) {
      deleteEmployerListing(userId, jobId);
      deletePostedJob(jobId);
      showToast("Listing deleted");
      setTimeout(() => navigate("/jobs/employer"), 500);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: `1px solid ${colors.border}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    color: colors.text,
    fontSize: "0.9rem",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: "6px",
  };

  const sectionStyle: React.CSSProperties = {
    ...glassCard,
    padding: "24px",
    marginBottom: "20px",
  };

  const checkboxRow = (label: string, key: keyof FormState, description: string) => (
    <label
      key={key}
      style={{
        display: "flex", gap: "12px", alignItems: "flex-start", padding: "10px 0",
        cursor: "pointer", fontSize: "0.85rem", color: colors.text,
      }}
    >
      <input
        type="checkbox"
        checked={!!form[key]}
        onChange={(e) => updateField(key, e.target.checked as never)}
        style={{ marginTop: "2px", accentColor: colors.accent }}
      />
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>{description}</div>
      </div>
    </label>
  );

  // ── Preview Mode ──
  if (preview) {
    return (
      <div style={{ position: "relative", minHeight: "100%" }}>
        <GlassBackground />
        <div style={{ position: "relative", zIndex: 1, padding: "48px 24px 60px", maxWidth: "800px", margin: "0 auto" }}>
          <button
            onClick={() => setPreview(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px",
              fontWeight: 500, color: colors.textMuted, background: "none", border: "none",
              cursor: "pointer", marginBottom: "20px",
            }}
          >
            <ArrowLeft size={14} /> Back to Editor
          </button>

          <div style={sectionStyle}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
              {form.logo_url && (
                <img src={form.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "contain", border: `1px solid ${colors.border}` }} />
              )}
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.text, margin: "0 0 4px" }}>{form.title || "Untitled Job"}</h1>
                {form.organization && <div style={{ color: colors.textSecondary, fontSize: "0.9rem" }}>{form.organization}</div>}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
              {form.location && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: colors.textMuted }}>
                  <MapPin size={14} /> {form.location}
                </span>
              )}
              {form.compensation && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: colors.textMuted }}>
                  <DollarSign size={14} /> {form.compensation}
                </span>
              )}
              {form.opportunity_type && (
                <span style={{ padding: "2px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 600, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", color: colors.text }}>
                  {form.opportunity_type}
                </span>
              )}
              {form.work_mode && (
                <span style={{ padding: "2px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 600, background: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)", color: "#3B82F6" }}>
                  {form.work_mode}
                </span>
              )}
            </div>

            {form.description && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>About This Job</h3>
                <p style={{ color: colors.textSecondary, fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{form.description}</p>
              </div>
            )}

            {form.responsibilities && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>Responsibilities</h3>
                <p style={{ color: colors.textSecondary, fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{form.responsibilities}</p>
              </div>
            )}

            {form.requirements && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>Requirements</h3>
                <p style={{ color: colors.textSecondary, fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{form.requirements}</p>
              </div>
            )}

            {form.nice_to_have && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>Nice to Have</h3>
                <p style={{ color: colors.textSecondary, fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{form.nice_to_have}</p>
              </div>
            )}

            {form.equity_statement && (
              <div style={{ marginBottom: "20px", padding: "16px", borderRadius: "12px", background: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p style={{ color: colors.textSecondary, fontSize: "0.85rem", fontStyle: "italic", margin: 0 }}>{form.equity_statement}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Editor Mode ──
  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 1000, padding: "14px 24px", borderRadius: "14px", background: "#10B981", color: "#fff", fontWeight: 600, fontSize: "0.9rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ ...glassCard, padding: "32px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <Trash2 size={40} color="#EF4444" style={{ marginBottom: "16px" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Delete This Listing?</h3>
            <p style={{ color: colors.textSecondary, fontSize: "0.9rem", margin: "0 0 24px" }}>This action cannot be undone. All applicant data for this listing will be lost.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: "10px 24px", borderRadius: "10px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDelete} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "#EF4444", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "48px 24px 60px", maxWidth: "800px", margin: "0 auto" }}>
        {/* Back link */}
        <Link
          to="/jobs/employer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500, color: colors.textMuted, textDecoration: "none", marginBottom: "20px" }}
        >
          <ArrowLeft size={14} /> Employer Dashboard
        </Link>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
              {isEdit ? "Edit Job Listing" : "Create Job Listing"}
            </h1>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: "0.9rem" }}>
              {isEdit ? "Update your job posting details" : "Fill in the details to post a new job"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setPreview(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "12px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
            >
              <Eye size={16} /> Preview
            </button>
            {isEdit && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div style={{ ...glassSurface, padding: "16px 20px", borderRadius: "14px", marginBottom: "20px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <AlertCircle size={16} color="#EF4444" />
              <span style={{ fontWeight: 600, color: "#EF4444", fontSize: "0.85rem" }}>Please fix the following:</span>
            </div>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: "0.8rem", color: colors.textSecondary, paddingLeft: "24px" }}>• {e}</div>
            ))}
          </div>
        )}

        {/* Section 1: Basic Info */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Briefcase size={18} color={colors.accent} /> Basic Information
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Job Title *</label>
              <input type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="e.g. Community Outreach Coordinator" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Organization</label>
                <input type="text" value={form.organization} onChange={(e) => updateField("organization", e.target.value)} placeholder="Your company name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Company Website</label>
                <input type="url" value={form.company_website} onChange={(e) => updateField("company_website", e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Logo URL (optional)</label>
              <input type="url" value={form.logo_url} onChange={(e) => updateField("logo_url", e.target.value)} placeholder="https://example.com/logo.png" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Section 2: Job Details */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 20px" }}>Job Details</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Description *</label>
              <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Describe the role, team, and what makes it unique..." rows={6} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Responsibilities</label>
              <textarea value={form.responsibilities} onChange={(e) => updateField("responsibilities", e.target.value)} placeholder="List key responsibilities (one per line)..." rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Requirements</label>
              <textarea value={form.requirements} onChange={(e) => updateField("requirements", e.target.value)} placeholder="List requirements and qualifications..." rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Nice to Have</label>
              <textarea value={form.nice_to_have} onChange={(e) => updateField("nice_to_have", e.target.value)} placeholder="Optional preferred qualifications..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
        </div>

        {/* Section 3: Classification */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 20px" }}>Classification</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => updateField("category", e.target.value)} style={inputStyle}>
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Job Type</label>
              <select value={form.opportunity_type} onChange={(e) => updateField("opportunity_type", e.target.value)} style={inputStyle}>
                {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Work Type</label>
              <select value={form.work_mode} onChange={(e) => updateField("work_mode", e.target.value)} style={inputStyle}>
                {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Experience Level</label>
              <select value={form.experience_level} onChange={(e) => updateField("experience_level", e.target.value)} style={inputStyle}>
                {EXPERIENCE_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Location & Compensation */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={18} color={colors.accent} /> Location & Compensation
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" value={form.location} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Toronto, ON" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Compensation</label>
              <input type="text" value={form.compensation} onChange={(e) => updateField("compensation", e.target.value)} placeholder="e.g. $55,000-65,000/year" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Salary Range (for filtering)</label>
              <input type="text" value={form.salary_range} onChange={(e) => updateField("salary_range", e.target.value)} placeholder="e.g. 55000-65000" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Section 5: Posting Settings */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={18} color={colors.accent} /> Posting Settings
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiration Date</label>
              <input type="date" value={form.expirationDate} onChange={(e) => updateField("expirationDate", e.target.value)} style={inputStyle} />
            </div>
          </div>
          <label style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px", cursor: "pointer", fontSize: "0.85rem", color: colors.text }}>
            <input type="checkbox" checked={form.autoCloseOnHire} onChange={(e) => updateField("autoCloseOnHire", e.target.checked)} style={{ accentColor: colors.accent }} />
            <span>Automatically close listing when a candidate is hired</span>
          </label>
          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={(e) => updateField("tags", e.target.value)} placeholder="e.g. community, nonprofit, youth" style={inputStyle} />
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>Equity Statement</label>
            <textarea value={form.equity_statement} onChange={(e) => updateField("equity_statement", e.target.value)} placeholder="Optional equity and inclusion statement..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>

        {/* Section 6: Barrier-Free Badges */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckSquare size={18} color={colors.accent} /> Barrier-Free Hiring Badges
          </h2>
          <p style={{ fontSize: "0.8rem", color: colors.textMuted, margin: "0 0 16px" }}>
            Select the badges that apply to help candidates find inclusive opportunities.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {checkboxRow("No Experience Required", "no_experience_required", "Open to candidates without prior work experience")}
            {checkboxRow("Training Provided", "training_provided", "On-the-job training included")}
            {checkboxRow("Hires Without Address", "hires_without_address", "Housing not required to apply")}
            {checkboxRow("Hires With Gaps", "hires_with_gaps", "Employment gaps are welcome")}
            {checkboxRow("Hires With Record", "hires_with_record", "Criminal record does not disqualify")}
            {checkboxRow("Provides Work Gear", "provides_work_gear", "Necessary equipment/uniforms provided")}
            {checkboxRow("Same Day Pay", "same_day_pay", "Get paid the same day you work")}
            {checkboxRow("Transit Accessible", "is_transit_accessible", "Location is accessible by public transit")}
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Link
            to="/jobs/employer"
            style={{ padding: "14px 28px", borderRadius: "14px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "14px 32px", borderRadius: "14px", border: "none",
              background: colors.accent, color: "#000", fontWeight: 700,
              fontSize: "0.9rem", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
              transition: "all 0.2s",
            }}
          >
            <Save size={18} /> {isEdit ? "Update Listing" : "Publish Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
