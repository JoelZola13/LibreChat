import React from "react";
import { Upload, Sparkles, FileText, ArrowRight } from "lucide-react";

type Props = {
  onChooseUpload: () => void;
  onChooseBuilder: () => void;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
  kind: "resume" | "cover_letter";
};

export default function ResumePathChooser({ onChooseUpload, onChooseBuilder, colors, isDark, glassCard, kind }: Props) {
  const isResume = kind === "resume";
  const docLabel = isResume ? "Resume" : "Cover Letter";

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
          {isResume ? "Build Your Professional Resume" : "Craft Your Cover Letter"}
        </h2>
        <p style={{ fontSize: "0.95rem", color: colors.textSecondary, margin: 0, lineHeight: 1.5, maxWidth: "500px", marginLeft: "auto", marginRight: "auto" }}>
          {isResume
            ? "Choose how you'd like to get started. Upload an existing resume or let us help you create a polished, professional one."
            : "Upload your own cover letter or let us generate a tailored one that highlights your strengths."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "700px", margin: "0 auto" }}>
        {/* Upload Card */}
        <button
          onClick={onChooseUpload}
          style={{
            ...glassCard,
            padding: "32px 24px",
            borderRadius: "24px",
            border: `2px solid transparent`,
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.3s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
            (e.currentTarget as HTMLElement).style.borderColor = "#3B82F6";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px rgba(59,130,246,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "none";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <div style={{
            width: "64px", height: "64px", borderRadius: "20px",
            background: "rgba(59,130,246,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={28} color="#3B82F6" />
          </div>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>
              Upload Your {docLabel}
            </h3>
            <p style={{ fontSize: "0.8rem", color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Already have a {docLabel.toLowerCase()}? Upload your PDF or Word document and label it for easy access.
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "0.8rem", fontWeight: 600, color: "#3B82F6",
            marginTop: "4px",
          }}>
            Upload File <ArrowRight size={14} />
          </div>
        </button>

        {/* Builder Card */}
        <button
          onClick={onChooseBuilder}
          style={{
            ...glassCard,
            padding: "32px 24px",
            borderRadius: "24px",
            border: `2px solid transparent`,
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.3s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            background: isDark
              ? "linear-gradient(135deg, rgba(255,214,0,0.06), rgba(255,255,255,0.04))"
              : "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(255,255,255,0.7))",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
            (e.currentTarget as HTMLElement).style.borderColor = "#FFD600";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px rgba(255,214,0,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "none";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <div style={{
            width: "64px", height: "64px", borderRadius: "20px",
            background: "rgba(255,214,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={28} color="#FFD600" />
          </div>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px" }}>
              Create {docLabel} With Us
            </h3>
            <p style={{ fontSize: "0.8rem", color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
              {isResume
                ? "Our guided builder will help you craft a professional resume with smart suggestions and elevated language."
                : "We'll generate a tailored cover letter using your experience and the job you're targeting."}
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "0.8rem", fontWeight: 600, color: "#B8960F",
            marginTop: "4px",
          }}>
            Get Started <ArrowRight size={14} />
          </div>
        </button>
      </div>
    </div>
  );
}
