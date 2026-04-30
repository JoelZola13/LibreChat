import React, { useState, useCallback, useMemo } from "react";
import {
  ArrowLeft, ArrowRight, User, Briefcase, GraduationCap, Sparkles,
  Eye, Save, Plus, Trash2, Check, Target, Award, Heart, Languages,
} from "lucide-react";
import { searchOccupations, type OccupationProfile } from "./occupationSkillsMap";
import { generateObjective, generateSuggestions, enhanceDescription, generateSummary } from "./resumeEnhancer";
import { SuggestionGroup } from "./SuggestionCard";
import { saveResume, saveResumeVersion, getResumeVersions } from "./jobsStorage";
import type { Resume, ResumeExperience, ResumeEducation, ResumeCertification, ResumeVersion, SuggestionItem } from "./types";

type Props = {
  userId: string;
  existingResume?: Resume | null;
  onComplete: () => void;
  onCancel: () => void;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
  glassSurface: React.CSSProperties;
};

const STEPS = [
  { key: "info", label: "Personal Info", icon: User },
  { key: "objective", label: "Objective", icon: Target },
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "volunteer", label: "Volunteer", icon: Heart },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "skills", label: "Skills", icon: Sparkles },
  { key: "review", label: "Review", icon: Eye },
];

const JOB_TYPES = ["full-time", "part-time", "contract", "seasonal"];

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ResumeBuilder({ userId, existingResume, onComplete, onCancel, colors, isDark, glassCard, glassSurface }: Props) {
  const [step, setStep] = useState(0);

  // Personal info
  const [fullName, setFullName] = useState(existingResume?.fullName || "");
  const [email, setEmail] = useState(existingResume?.email || "");
  const [phone, setPhone] = useState(existingResume?.phone || "");
  const [location, setLocation] = useState(existingResume?.location || "");

  // Objective
  const [occupation, setOccupation] = useState("");
  const [occupationResults, setOccupationResults] = useState<OccupationProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<OccupationProfile | null>(null);
  const [jobType, setJobType] = useState("full-time");
  const [industry, setIndustry] = useState("");
  const [objective, setObjective] = useState("");

  // Experience
  const [experience, setExperience] = useState<ResumeExperience[]>(existingResume?.experience || []);

  // Education
  const [education, setEducation] = useState<ResumeEducation[]>(existingResume?.education || []);
  const [certifications, setCertifications] = useState<ResumeCertification[]>(existingResume?.certifications || []);

  // Volunteer
  const [volunteerExperience, setVolunteerExperience] = useState<ResumeExperience[]>(existingResume?.volunteerExperience || []);

  // Languages
  const [languages, setLanguages] = useState<string[]>(existingResume?.languages || ["English"]);
  const [languageInput, setLanguageInput] = useState("");

  // Skills
  const [skills, setSkills] = useState<string[]>(existingResume?.skills || []);
  const [skillInput, setSkillInput] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // Summary
  const [summary, setSummary] = useState(existingResume?.summary || "");

  const [toast, setToast] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // Occupation search
  const handleOccupationSearch = (q: string) => {
    setOccupation(q);
    if (q.length >= 2) {
      setOccupationResults(searchOccupations(q));
    } else {
      setOccupationResults([]);
    }
  };

  const selectOccupation = (profile: OccupationProfile) => {
    setSelectedProfile(profile);
    setOccupation(profile.occupation);
    setOccupationResults([]);
    // Auto-generate objective
    const obj = generateObjective({ occupation: profile.occupation, jobType, industry });
    setObjective(obj);
    // Generate suggestions
    const descriptions = experience.map((e) => e.description);
    const sug = generateSuggestions(profile.occupation, skills, descriptions);
    setSuggestions(sug);
  };

  // Regenerate objective when job type changes
  const handleJobTypeChange = (type: string) => {
    setJobType(type);
    if (selectedProfile || occupation) {
      const obj = generateObjective({ occupation: selectedProfile?.occupation || occupation, jobType: type, industry });
      setObjective(obj);
    }
  };

  // Experience CRUD
  const addExperience = () => {
    setExperience((prev) => [...prev, { id: genId(), title: "", company: "", location: "", startDate: "", endDate: "", current: false, description: "" }]);
  };

  const updateExperience = (id: string, updates: Partial<ResumeExperience>) => {
    setExperience((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeExperience = (id: string) => {
    setExperience((prev) => prev.filter((e) => e.id !== id));
  };

  // Volunteer CRUD
  const addVolunteer = () => {
    setVolunteerExperience((prev) => [...prev, { id: genId(), title: "", company: "", location: "", startDate: "", endDate: "", current: false, description: "" }]);
  };
  const updateVolunteer = (id: string, updates: Partial<ResumeExperience>) => {
    setVolunteerExperience((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };
  const removeVolunteer = (id: string) => {
    setVolunteerExperience((prev) => prev.filter((e) => e.id !== id));
  };

  // Language helpers
  const addLanguage = () => {
    const trimmed = languageInput.trim();
    if (trimmed && !languages.includes(trimmed)) setLanguages((prev) => [...prev, trimmed]);
    setLanguageInput("");
  };
  const removeLanguage = (lang: string) => {
    setLanguages((prev) => prev.filter((l) => l !== lang));
  };

  const enhanceExperienceDesc = (id: string) => {
    setExperience((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const enhanced = enhanceDescription(e.description, e.title);
      return { ...e, description: enhanced };
    }));
    showToast("Description enhanced!");
  };

  // Education CRUD
  const addEducation = () => {
    setEducation((prev) => [...prev, { id: genId(), institution: "", degree: "", field: "", startDate: "", endDate: "", current: false }]);
  };

  const updateEducation = (id: string, updates: Partial<ResumeEducation>) => {
    setEducation((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEducation = (id: string) => {
    setEducation((prev) => prev.filter((e) => e.id !== id));
  };

  // Certifications
  const addCertification = () => {
    setCertifications((prev) => [...prev, { id: genId(), name: "", issuer: "", date: "" }]);
  };

  const updateCertification = (id: string, updates: Partial<ResumeCertification>) => {
    setCertifications((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCertification = (id: string) => {
    setCertifications((prev) => prev.filter((c) => c.id !== id));
  };

  // Skills
  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  // Suggestion handlers
  const handleAcceptSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const newStatus = s.status === "accepted" ? "pending" : "accepted";
      // If accepting a skill, add it
      if (newStatus === "accepted" && s.type === "skill" && !skills.includes(s.text)) {
        setSkills((prev) => [...prev, s.text]);
      }
      return { ...s, status: newStatus };
    }));
  };

  const handleRejectSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === "rejected" ? "pending" : "rejected" } : s)));
  };

  const skillSuggestions = suggestions.filter((s) => s.type === "skill");
  const respSuggestions = suggestions.filter((s) => s.type === "responsibility");

  // Generate and save resume
  const handleSave = () => {
    // Generate summary if empty
    const finalSummary = summary || generateSummary({ fullName, email, experience, skills }, selectedProfile?.occupation || occupation);

    const resume: Resume = {
      userId,
      fullName,
      email,
      phone,
      location,
      website: existingResume?.website || "",
      linkedin: existingResume?.linkedin || "",
      summary: finalSummary,
      objective,
      experience,
      volunteerExperience: volunteerExperience.length > 0 ? volunteerExperience : undefined,
      education,
      skills,
      languages: languages.length > 0 ? languages : undefined,
      interests: existingResume?.interests || [],
      certifications,
      showQualificationsBox: true,
      updatedAt: new Date().toISOString(),
    };

    saveResume(resume);

    // Also save as a new ResumeVersion
    const version: ResumeVersion = {
      id: `rv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      label: fullName ? `Resume - ${fullName}` : (selectedProfile?.occupation ? `${selectedProfile.occupation} Resume` : "My Professional Resume"),
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resume,
    };
    // Unset other defaults
    const existing = getResumeVersions(userId);
    for (const v of existing) {
      if (v.isDefault) saveResumeVersion({ ...v, isDefault: false });
    }
    saveResumeVersion(version);

    showToast("Resume created successfully!");
    setTimeout(onComplete, 500);
  };

  const canProceed = () => {
    switch (step) {
      case 0: return fullName.trim().length > 0 && email.trim().length > 0;
      case 1: return objective.trim().length > 0;
      default: return true;
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: "12px",
    border: `1px solid ${colors.border}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    color: colors.text, fontSize: "0.9rem", outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.8rem", fontWeight: 600,
    color: colors.textSecondary, marginBottom: "6px",
  };

  const btnStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "6px 14px", borderRadius: "10px", border: "none",
    background: isDark ? "rgba(255,214,0,0.1)" : "rgba(255,214,0,0.15)",
    color: isDark ? "#FFD600" : "#B8960F", fontWeight: 600,
    fontSize: "0.8rem", cursor: "pointer",
  };

  const removeBtnStyle: React.CSSProperties = {
    padding: "4px", borderRadius: "6px", border: "none",
    background: "rgba(239,68,68,0.08)", color: "#EF4444",
    cursor: "pointer", display: "flex", alignItems: "center",
  };

  // ── Step Renderers ──

  const renderStepInfo = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Let's Start With Your Details</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>This information will appear at the top of your resume.</p>
      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jordan Mitchell" />
        </div>
        <div>
          <label style={labelStyle}>Email Address *</label>
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jordan@email.com" />
        </div>
        <div>
          <label style={labelStyle}>Phone Number</label>
          <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (416) 555-0123" />
        </div>
        <div>
          <label style={labelStyle}>City, Province</label>
          <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Toronto, ON" />
        </div>
      </div>
    </div>
  );

  const renderStepObjective = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>What Type of Work Are You Seeking?</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>Tell us your desired occupation and we'll craft a professional objective statement.</p>

      {/* Occupation search */}
      <div style={{ marginBottom: "16px", position: "relative" }}>
        <label style={labelStyle}>Desired Occupation or Industry</label>
        <input
          style={inputStyle}
          value={occupation}
          onChange={(e) => handleOccupationSearch(e.target.value)}
          placeholder="e.g. Daycare Teacher, Security Guard, Web Developer..."
        />
        {occupationResults.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            ...glassSurface, borderRadius: "12px", marginTop: "4px",
            maxHeight: "200px", overflow: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}>
            {occupationResults.map((p) => (
              <button
                key={p.occupation}
                onClick={() => selectOccupation(p)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 16px", border: "none", background: "transparent",
                  color: colors.text, fontSize: "0.85rem", cursor: "pointer",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.occupation}</div>
                <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>{p.category}</div>
              </button>
            ))}
          </div>
        )}
        {selectedProfile && (
          <div style={{ marginTop: "8px", padding: "8px 12px", borderRadius: "8px", background: "rgba(34,197,94,0.08)", fontSize: "0.75rem", color: "#22C55E", display: "flex", alignItems: "center", gap: "6px" }}>
            <Check size={14} /> Matched: {selectedProfile.occupation} ({selectedProfile.category})
          </div>
        )}
      </div>

      {/* Job type preference */}
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Employment Type Preference</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {JOB_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleJobTypeChange(type)}
              style={{
                padding: "8px 16px", borderRadius: "10px",
                fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                border: jobType === type ? "none" : `1px solid ${colors.border}`,
                background: jobType === type ? colors.accent : "transparent",
                color: jobType === type ? "#000" : colors.textSecondary,
                textTransform: "capitalize",
              }}
            >
              {type.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Industry (if no occupation matched) */}
      {!selectedProfile && (
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Industry (optional)</label>
          <input style={inputStyle} value={industry} onChange={(e) => { setIndustry(e.target.value); if (occupation) { setObjective(generateObjective({ occupation, jobType, industry: e.target.value })); } }} placeholder="e.g. Healthcare, Technology, Hospitality" />
        </div>
      )}

      {/* Generated objective */}
      <div>
        <label style={labelStyle}>Your Objective Statement</label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Your objective will be generated automatically based on your selections above..."
        />
        <p style={{ fontSize: "0.7rem", color: colors.textMuted, margin: "6px 0 0" }}>
          Feel free to edit the generated text to make it your own.
        </p>
      </div>
    </div>
  );

  const renderStepExperience = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Work Experience</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>Add your work history. We'll enhance your descriptions with professional language.</p>

      {experience.map((exp, idx) => (
        <div key={exp.id} style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${colors.border}`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.textMuted }}>Position {idx + 1}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {exp.description && (
                <button onClick={() => enhanceExperienceDesc(exp.id)} style={btnStyle}>
                  <Sparkles size={12} /> Enhance
                </button>
              )}
              <button onClick={() => removeExperience(exp.id)} style={removeBtnStyle}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Job Title</label>
              <input style={inputStyle} value={exp.title} onChange={(e) => updateExperience(exp.id, { title: e.target.value })} placeholder="e.g. Program Coordinator" />
            </div>
            <div>
              <label style={labelStyle}>Company / Organization</label>
              <input style={inputStyle} value={exp.company} onChange={(e) => updateExperience(exp.id, { company: e.target.value })} placeholder="e.g. Community Health Network" />
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input style={inputStyle} type="month" value={exp.startDate} onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} type="month" value={exp.endDate || ""} onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })} disabled={exp.current} />
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: colors.textMuted, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={exp.current} onChange={(e) => updateExperience(exp.id, { current: e.target.checked, endDate: "" })} style={{ accentColor: colors.accent }} /> Current
                </label>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <label style={labelStyle}>Description — describe what you did (we'll elevate the language)</label>
            <textarea
              value={exp.description}
              onChange={(e) => updateExperience(exp.id, { description: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="e.g. Helped kids with activities, managed the classroom, talked to parents about progress..."
            />
          </div>
        </div>
      ))}

      <button onClick={addExperience} style={btnStyle}>
        <Plus size={14} /> Add Work Experience
      </button>

      {/* Responsibility suggestions */}
      {respSuggestions.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <SuggestionGroup
            suggestions={respSuggestions}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            onAcceptAll={() => setSuggestions((prev) => prev.map((s) => s.type === "responsibility" ? { ...s, status: "accepted" } : s))}
            onRejectAll={() => setSuggestions((prev) => prev.map((s) => s.type === "responsibility" ? { ...s, status: "rejected" } : s))}
            title="Suggested Responsibilities for Your Role"
            colors={colors}
            isDark={isDark}
          />
          <p style={{ fontSize: "0.7rem", color: colors.textMuted, margin: "8px 0 0" }}>
            Accepted responsibilities will be added to your most recent experience entry.
          </p>
        </div>
      )}
    </div>
  );

  const renderStepVolunteer = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Community Involvement &amp; Volunteer Experience</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>Highlight any volunteer roles or community service. This section is optional but can strengthen your resume.</p>

      {volunteerExperience.map((vol, idx) => (
        <div key={vol.id} style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${colors.border}`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.textMuted }}>Volunteer Role {idx + 1}</span>
            <button onClick={() => removeVolunteer(vol.id)} style={removeBtnStyle}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
            <div><label style={labelStyle}>Role / Title</label><input style={inputStyle} value={vol.title} onChange={(e) => updateVolunteer(vol.id, { title: e.target.value })} placeholder="e.g. Youth Mentor" /></div>
            <div><label style={labelStyle}>Organization</label><input style={inputStyle} value={vol.company} onChange={(e) => updateVolunteer(vol.id, { company: e.target.value })} placeholder="e.g. Big Brothers Big Sisters" /></div>
            <div><label style={labelStyle}>Start Date</label><input style={inputStyle} type="month" value={vol.startDate} onChange={(e) => updateVolunteer(vol.id, { startDate: e.target.value })} /></div>
            <div><label style={labelStyle}>End Date</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} type="month" value={vol.endDate || ""} onChange={(e) => updateVolunteer(vol.id, { endDate: e.target.value })} disabled={vol.current} />
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: colors.textMuted, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={vol.current} onChange={(e) => updateVolunteer(vol.id, { current: e.target.checked, endDate: "" })} style={{ accentColor: colors.accent }} /> Current
                </label>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <label style={labelStyle}>Description of contributions</label>
            <textarea value={vol.description} onChange={(e) => updateVolunteer(vol.id, { description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="e.g. Mentored at-risk youth, organized community events..." />
          </div>
        </div>
      ))}

      <button onClick={addVolunteer} style={btnStyle}><Plus size={14} /> Add Volunteer Experience</button>
      <p style={{ fontSize: "0.75rem", color: colors.textMuted, margin: "12px 0 0" }}>No volunteer experience? No worries — you can skip this step.</p>
    </div>
  );

  const renderStepEducation = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Education &amp; Certifications</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>List your educational background and any professional certifications.</p>

      {/* Education */}
      {education.map((edu, idx) => (
        <div key={edu.id} style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${colors.border}`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.textMuted }}>Education {idx + 1}</span>
            <button onClick={() => removeEducation(edu.id)} style={removeBtnStyle}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
            <div><label style={labelStyle}>Institution</label><input style={inputStyle} value={edu.institution} onChange={(e) => updateEducation(edu.id, { institution: e.target.value })} placeholder="e.g. University of Toronto" /></div>
            <div><label style={labelStyle}>Degree</label><input style={inputStyle} value={edu.degree} onChange={(e) => updateEducation(edu.id, { degree: e.target.value })} placeholder="e.g. Bachelor of Arts" /></div>
            <div><label style={labelStyle}>Field of Study</label><input style={inputStyle} value={edu.field || ""} onChange={(e) => updateEducation(edu.id, { field: e.target.value })} placeholder="e.g. Social Work" /></div>
            <div><label style={labelStyle}>Dates</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} type="month" value={edu.startDate} onChange={(e) => updateEducation(edu.id, { startDate: e.target.value })} />
                <span style={{ color: colors.textMuted }}>—</span>
                <input style={{ ...inputStyle, flex: 1 }} type="month" value={edu.endDate || ""} onChange={(e) => updateEducation(edu.id, { endDate: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addEducation} style={{ ...btnStyle, marginBottom: "24px" }}><Plus size={14} /> Add Education</button>

      {/* Certifications */}
      <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Award size={16} color={colors.accent} /> Certifications
      </h4>
      {certifications.map((cert) => (
        <div key={cert.id} style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
          <input style={{ ...inputStyle, flex: 2 }} value={cert.name} onChange={(e) => updateCertification(cert.id, { name: e.target.value })} placeholder="e.g. First Aid/CPR" />
          <input style={{ ...inputStyle, flex: 1 }} value={cert.issuer} onChange={(e) => updateCertification(cert.id, { issuer: e.target.value })} placeholder="Issuer" />
          <input style={{ ...inputStyle, flex: 1 }} type="month" value={cert.date || ""} onChange={(e) => updateCertification(cert.id, { date: e.target.value })} />
          <button onClick={() => removeCertification(cert.id)} style={removeBtnStyle}><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={addCertification} style={btnStyle}><Plus size={14} /> Add Certification</button>
    </div>
  );

  const renderStepSkills = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Core Competencies &amp; Skills</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>
        {selectedProfile
          ? `Based on your interest in ${selectedProfile.occupation}, we've prepared some skill suggestions below.`
          : "Add the skills that best represent your abilities."}
      </p>

      {/* Manual skill input */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
          placeholder="Type a skill and press Enter..."
        />
        <button onClick={addSkill} style={btnStyle}><Plus size={14} /> Add</button>
      </div>

      {/* Current skills */}
      {skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {skills.map((skill) => (
            <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 600, background: isDark ? "rgba(255,214,0,0.1)" : "rgba(255,214,0,0.15)", color: isDark ? "#FFD600" : "#B8960F", border: "1px solid rgba(255,214,0,0.2)" }}>
              {skill}
              <button onClick={() => removeSkill(skill)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", opacity: 0.6, display: "flex" }}>
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Skill suggestions */}
      {skillSuggestions.length > 0 && (
        <SuggestionGroup
          suggestions={skillSuggestions}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          onAcceptAll={() => {
            const toAdd = skillSuggestions.filter((s) => s.status !== "accepted").map((s) => s.text);
            setSkills((prev) => [...prev, ...toAdd.filter((t) => !prev.includes(t))]);
            setSuggestions((prev) => prev.map((s) => s.type === "skill" ? { ...s, status: "accepted" } : s));
          }}
          onRejectAll={() => setSuggestions((prev) => prev.map((s) => s.type === "skill" ? { ...s, status: "rejected" } : s))}
          title="Recommended Skills for Your Occupation"
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* Languages */}
      <div style={{ marginTop: "20px" }}>
        <label style={labelStyle}>Languages Spoken</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={languageInput}
            onChange={(e) => setLanguageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }}
            placeholder="e.g. French, Spanish, Mandarin..."
          />
          <button onClick={addLanguage} style={btnStyle}><Plus size={14} /> Add</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {languages.map((lang) => (
            <span key={lang} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 600, background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}>
              {lang}
              <button onClick={() => removeLanguage(lang)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", opacity: 0.6, display: "flex" }}><Trash2 size={11} /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: "24px" }}>
        <label style={labelStyle}>Professional Summary (optional — we'll generate one if left blank)</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Leave blank and we'll craft one from your experience, or write your own here..."
        />
      </div>
    </div>
  );

  const [showBoxBorders, setShowBoxBorders] = useState(true);

  const renderStepReview = () => {
    const finalSummary = summary || generateSummary({ fullName, email, experience, skills }, selectedProfile?.occupation || occupation);
    const contactLine = [location, phone, email].filter(Boolean).join(" | ");
    const acceptedResps = suggestions.filter((s) => s.type === "responsibility" && s.status === "accepted");
    // Build skills list including language proficiency
    const skillBullets: string[] = [];
    if (languages.length > 1) skillBullets.push(`Fluent in ${languages.join(", ")}`);
    else if (languages.length === 1 && languages[0] !== "English") skillBullets.push(`Fluent in English and ${languages[0]}`);
    skills.forEach((s) => skillBullets.push(s));
    const certBullets = certifications.map((c) => `${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`);
    // Sort experience most recent first
    const sortedExp = [...experience].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    const sortedVol = [...volunteerExperience].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    const sortedEdu = [...education].sort((a, b) => (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || ""));

    const sectionHeaderStyle: React.CSSProperties = {
      fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: "0.08em", color: colors.text,
      margin: "0 0 10px", borderBottom: `2px solid ${colors.text}`, paddingBottom: "4px",
    };

    return (
      <div style={{ ...glassCard, padding: "32px", borderRadius: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 4px" }}>Preview Your Professional Resume</h3>
            <p style={{ fontSize: "0.8rem", color: colors.textMuted, margin: 0 }}>Review below, then click "Generate Resume" when satisfied.</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: colors.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={showBoxBorders} onChange={(e) => setShowBoxBorders(e.target.checked)} style={{ accentColor: colors.accent }} />
            Show section borders
          </label>
        </div>

        {/* ═══ Resume Document ═══ */}
        <div style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", borderRadius: "16px", padding: "44px 40px", border: `1px solid ${colors.border}`, maxWidth: "680px", margin: "0 auto", fontFamily: "'Georgia', 'Times New Roman', serif" }}>

          {/* NAME */}
          <div style={{ textAlign: "center", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.7rem", fontWeight: 800, color: colors.text, margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {fullName || "YOUR NAME"}
            </h1>
          </div>

          {/* CONTACT LINE — bold */}
          <div style={{ textAlign: "center", fontSize: "0.82rem", fontWeight: 700, color: colors.text, marginBottom: "4px" }}>
            {contactLine || "City, Province | Phone | Email"}
          </div>

          {/* Divider line */}
          <hr style={{ border: "none", borderTop: `2px solid ${colors.text}`, margin: "10px 0 16px" }} />

          {/* OBJECTIVE */}
          {objective && (
            <div style={{ marginBottom: "18px" }}>
              <h2 style={sectionHeaderStyle}>Objective</h2>
              <p style={{ fontSize: "0.82rem", color: colors.text, lineHeight: 1.6, margin: 0 }}>{objective}</p>
            </div>
          )}

          {/* HIGHLIGHTS OF QUALIFICATIONS — Split Box */}
          {(skillBullets.length > 0 || certBullets.length > 0) && (
            <div style={{ marginBottom: "18px" }}>
              <h2 style={sectionHeaderStyle}>Highlights of Qualifications</h2>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0",
                border: showBoxBorders ? `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}` : "none",
                borderRadius: showBoxBorders ? "8px" : "0",
              }}>
                {/* Skills side */}
                <div style={{
                  padding: "14px 16px",
                  borderRight: showBoxBorders ? `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}` : "none",
                }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colors.textMuted, marginBottom: "8px" }}>Skills</div>
                  <ul style={{ margin: 0, paddingLeft: "16px", listStyleType: "disc" }}>
                    {skillBullets.slice(0, 8).map((s, i) => (
                      <li key={i} style={{ fontSize: "0.8rem", color: colors.text, lineHeight: 1.5, marginBottom: "3px" }}>{s}</li>
                    ))}
                  </ul>
                </div>
                {/* Certificates side */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colors.textMuted, marginBottom: "8px" }}>Certifications &amp; Licenses</div>
                  <ul style={{ margin: 0, paddingLeft: "16px", listStyleType: "disc" }}>
                    {certBullets.length > 0 ? certBullets.map((c, i) => (
                      <li key={i} style={{ fontSize: "0.8rem", color: colors.text, lineHeight: 1.5, marginBottom: "3px" }}>{c}</li>
                    )) : (
                      <li style={{ fontSize: "0.8rem", color: colors.textMuted, fontStyle: "italic" }}>No certifications added</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* WORK HISTORY */}
          {sortedExp.length > 0 && (
            <div style={{ marginBottom: "18px" }}>
              <h2 style={sectionHeaderStyle}>Work History</h2>
              {sortedExp.map((exp) => (
                <div key={exp.id} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: colors.text }}>{exp.title}</span>
                      {exp.company && <span style={{ fontSize: "0.82rem", color: colors.text }}> | {exp.company}</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: colors.textMuted, whiteSpace: "nowrap", flexShrink: 0, marginLeft: "12px" }}>
                      {exp.startDate} — {exp.current ? "Present" : exp.endDate}
                    </div>
                  </div>
                  {exp.description && (
                    <ul style={{ margin: "4px 0 0", paddingLeft: "18px", listStyleType: "disc" }}>
                      {enhanceDescription(exp.description).split(". ").filter((s) => s.trim().length > 5).slice(0, 3).map((line, i) => (
                        <li key={i} style={{ fontSize: "0.8rem", color: colors.text, lineHeight: 1.5, marginBottom: "2px" }}>{line.trim().replace(/\.$/, "")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {acceptedResps.length > 0 && (
                <ul style={{ margin: "0 0 0 0", paddingLeft: "18px", listStyleType: "disc" }}>
                  {acceptedResps.map((r) => (
                    <li key={r.id} style={{ fontSize: "0.8rem", color: colors.text, lineHeight: 1.5, marginBottom: "2px" }}>{r.text}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* VOLUNTEER / COMMUNITY INVOLVEMENT */}
          {sortedVol.length > 0 && (
            <div style={{ marginBottom: "18px" }}>
              <h2 style={sectionHeaderStyle}>Community Involvement</h2>
              {sortedVol.map((vol) => (
                <div key={vol.id} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: colors.text }}>{vol.title}</span>
                      {vol.company && <span style={{ fontSize: "0.82rem", color: colors.text }}> | {vol.company}</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: colors.textMuted, whiteSpace: "nowrap", flexShrink: 0, marginLeft: "12px" }}>
                      {vol.startDate} — {vol.current ? "Present" : vol.endDate}
                    </div>
                  </div>
                  {vol.description && (
                    <ul style={{ margin: "4px 0 0", paddingLeft: "18px", listStyleType: "disc" }}>
                      {enhanceDescription(vol.description).split(". ").filter((s) => s.trim().length > 5).slice(0, 2).map((line, i) => (
                        <li key={i} style={{ fontSize: "0.8rem", color: colors.text, lineHeight: 1.5, marginBottom: "2px" }}>{line.trim().replace(/\.$/, "")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* EDUCATION — year completed on the right, most recent first */}
          {sortedEdu.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <h2 style={sectionHeaderStyle}>Education</h2>
              {sortedEdu.map((edu) => (
                <div key={edu.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>{edu.institution}</span>
                    <span style={{ fontSize: "0.82rem", color: colors.text }}>
                      {edu.degree ? ` — ${edu.degree}` : ""}{edu.field ? `, ${edu.field}` : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted, whiteSpace: "nowrap", flexShrink: 0, marginLeft: "12px" }}>
                    {edu.endDate || edu.startDate || ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const stepRenderers = [renderStepInfo, renderStepObjective, renderStepExperience, renderStepVolunteer, renderStepEducation, renderStepSkills, renderStepReview];

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 1000, padding: "14px 24px", borderRadius: "14px", background: "#10B981", color: "#fff", fontWeight: 600, fontSize: "0.9rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Step indicator */}
      <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "28px", flexWrap: "wrap" }}>
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = idx === step;
          const isComplete = idx < step;
          return (
            <button
              key={s.key}
              onClick={() => idx <= step && setStep(idx)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "12px", border: "none",
                background: isActive ? colors.accent : isComplete ? "rgba(34,197,94,0.1)" : "transparent",
                color: isActive ? "#000" : isComplete ? "#22C55E" : colors.textMuted,
                fontWeight: isActive ? 700 : 500, fontSize: "0.75rem",
                cursor: idx <= step ? "pointer" : "default",
                opacity: idx > step ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      {stepRenderers[step]()}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", gap: "12px" }}>
        <button
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "12px 24px", borderRadius: "12px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
        >
          <ArrowLeft size={16} /> {step === 0 ? "Cancel" : "Back"}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "12px 28px", borderRadius: "12px", border: "none",
              background: canProceed() ? "linear-gradient(135deg, #FFD600, #E6C200)" : colors.border,
              color: canProceed() ? "#000" : colors.textMuted,
              fontWeight: 700, fontSize: "0.85rem",
              cursor: canProceed() ? "pointer" : "default",
              boxShadow: canProceed() ? "0 4px 14px rgba(255,214,0,0.3)" : "none",
            }}
          >
            Next Step <ArrowRight size={16} />
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
            {/* Legal disclaimer & consent */}
            <div style={{
              padding: "14px 18px", borderRadius: "12px", maxWidth: "480px",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${colors.border}`, fontSize: "0.7rem", color: colors.textMuted, lineHeight: 1.5,
            }}>
              <label style={{ display: "flex", gap: "10px", cursor: "pointer", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{ accentColor: colors.accent, marginTop: "2px", flexShrink: 0 }}
                />
                <span>
                  I understand that this AI-powered resume builder is a <strong>supportive tool</strong> designed to assist in creating professional documents.
                  It does not guarantee employment or specific outcomes. Street Voices and its affiliates are not liable for hiring decisions made by employers.
                  By proceeding, I agree to these terms and accept responsibility for reviewing and verifying all generated content.
                </span>
              </label>
            </div>
            <button
              onClick={handleSave}
              disabled={!agreedToTerms}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "14px 32px", borderRadius: "14px", border: "none",
                background: agreedToTerms ? "linear-gradient(135deg, #22C55E, #16A34A)" : colors.border,
                color: agreedToTerms ? "#fff" : colors.textMuted,
                fontWeight: 700, fontSize: "0.95rem",
                cursor: agreedToTerms ? "pointer" : "default",
                boxShadow: agreedToTerms ? "0 4px 20px rgba(34,197,94,0.35)" : "none",
                opacity: agreedToTerms ? 1 : 0.6,
              }}
            >
              <Save size={18} /> Generate Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
