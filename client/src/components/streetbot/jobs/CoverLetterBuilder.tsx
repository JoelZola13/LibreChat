import React, { useState, useCallback, useMemo } from "react";
import { ArrowLeft, ArrowRight, Save, Briefcase, FileText, Sparkles, User } from "lucide-react";
import { generateCoverLetter, generateCoverLetterSuggestions } from "./coverLetterTemplates";
import { SuggestionGroup } from "./SuggestionCard";
import { saveCoverLetter, getResume, getDefaultResume } from "./jobsStorage";
import type { CoverLetter, Resume, SuggestionItem } from "./types";

type Props = {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
  glassSurface: React.CSSProperties;
};

const STEPS = [
  { key: "details", label: "Job Details", icon: Briefcase },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "review", label: "Review & Save", icon: FileText },
];

export default function CoverLetterBuilder({ userId, onComplete, onCancel, colors, isDark, glassCard, glassSurface }: Props) {
  const [step, setStep] = useState(0);
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [occupation, setOccupation] = useState("");
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [toast, setToast] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const resume = useMemo(() => getDefaultResume(userId) || getResume(userId), [userId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const handleGenerate = () => {
    const generated = generateCoverLetter({
      resume: resume || {},
      occupation,
      targetJobTitle,
      targetCompany,
    });
    setContent(generated);
    const name = resume?.fullName || "";
    setLabel(name ? `Cover Letter - ${name}` : (targetJobTitle ? `Cover Letter — ${targetJobTitle}` : "My Cover Letter"));

    // Generate suggestions
    const sug = generateCoverLetterSuggestions(generated, occupation);
    setSuggestions(sug);
    setStep(2);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const letter: CoverLetter = {
      id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      title: label.trim() || "My Cover Letter",
      content: content.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCoverLetter(letter);
    showToast("Cover letter created successfully!");
    setTimeout(onComplete, 500);
  };

  const handleAcceptSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === "accepted" ? "pending" : "accepted" } : s)));
  };
  const handleRejectSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === "rejected" ? "pending" : "rejected" } : s)));
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

  const renderStepDetails = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>What Position Is This For?</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>
        Tell us about the job you're applying to so we can tailor your cover letter.
      </p>
      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Job Title</label>
          <input style={inputStyle} value={targetJobTitle} onChange={(e) => setTargetJobTitle(e.target.value)} placeholder="e.g. Community Outreach Coordinator" />
        </div>
        <div>
          <label style={labelStyle}>Company / Organization (optional)</label>
          <input style={inputStyle} value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} placeholder="e.g. Street Voices Community Services" />
        </div>
        <div>
          <label style={labelStyle}>Your Occupation / Field</label>
          <input style={inputStyle} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g. Social Services, Customer Service" />
        </div>
      </div>
      {resume && (
        <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(34,197,94,0.06)", fontSize: "0.8rem", color: "#22C55E" }}>
          <User size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
          We'll use your saved resume ({resume.fullName}) to personalize the letter.
        </div>
      )}
    </div>
  );

  const renderStepReview = () => (
    <div style={{ ...glassCard, padding: "24px", borderRadius: "20px" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>Review Your Cover Letter</h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 20px" }}>Edit the generated text below and review our suggestions.</p>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Label / Name</label>
        <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Cover Letter for Tech Jobs" />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Cover Letter Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }}
        />
      </div>

      {suggestions.length > 0 && (
        <SuggestionGroup
          suggestions={suggestions}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          onAcceptAll={() => setSuggestions((prev) => prev.map((s) => ({ ...s, status: "accepted" })))}
          onRejectAll={() => setSuggestions((prev) => prev.map((s) => ({ ...s, status: "rejected" })))}
          title="Suggestions to Strengthen Your Letter"
          colors={colors}
          isDark={isDark}
        />
      )}
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 1000, padding: "14px 24px", borderRadius: "14px", background: "#10B981", color: "#fff", fontWeight: 600, fontSize: "0.9rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Step indicator */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "28px" }}>
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
                padding: "8px 16px", borderRadius: "12px", border: "none",
                background: isActive ? colors.accent : isComplete ? "rgba(34,197,94,0.1)" : "transparent",
                color: isActive ? "#000" : isComplete ? "#22C55E" : colors.textMuted,
                fontWeight: isActive ? 700 : 500, fontSize: "0.8rem",
                cursor: idx <= step ? "pointer" : "default",
                opacity: idx > step ? 0.5 : 1,
              }}
            >
              <Icon size={14} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {step === 0 && renderStepDetails()}
      {step === 2 && renderStepReview()}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
        <button
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "12px 24px", borderRadius: "12px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
        >
          <ArrowLeft size={16} /> {step === 0 ? "Cancel" : "Back"}
        </button>

        {step === 0 && (
          <button
            onClick={handleGenerate}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "12px 28px", borderRadius: "12px", border: "none",
              background: "linear-gradient(135deg, #FFD600, #E6C200)",
              color: "#000", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255,214,0,0.3)",
            }}
          >
            <Sparkles size={16} /> Generate Cover Letter
          </button>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
            <div style={{
              padding: "14px 18px", borderRadius: "12px", maxWidth: "480px",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${colors.border}`, fontSize: "0.7rem", color: colors.textMuted, lineHeight: 1.5,
            }}>
              <label style={{ display: "flex", gap: "10px", cursor: "pointer", alignItems: "flex-start" }}>
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ accentColor: colors.accent, marginTop: "2px", flexShrink: 0 }} />
                <span>
                  I understand that this AI-powered tool is designed to <strong>assist</strong> in creating professional documents.
                  It does not guarantee employment outcomes. Street Voices is not liable for hiring decisions. I agree to review and verify all generated content.
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
              <Save size={18} /> Save Cover Letter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
