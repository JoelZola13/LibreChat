import React, { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Check, AlertCircle } from "lucide-react";
import { saveUploadedDocument, getStorageUsage } from "./jobsStorage";
import type { UploadedDocument } from "./types";

type Props = {
  userId: string;
  kind: "resume" | "cover_letter";
  onComplete: () => void;
  onCancel: () => void;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

export default function ResumeUploader({ userId, kind, onComplete, onCancel, colors, isDark, glassCard }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState<string>("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docLabel = kind === "resume" ? "Resume" : "Cover Letter";

  const handleFile = useCallback((f: File) => {
    setError("");
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Please upload a PDF or Word document (.pdf, .docx)");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1048576}MB.`);
      return;
    }
    const storage = getStorageUsage();
    if (storage.percentage > 80) {
      setError("Storage is nearly full. Please delete some documents before uploading.");
      return;
    }
    setFile(f);
    setLabel(f.name.replace(/\.[^.]+$/, "")); // Default label = filename without extension

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setBase64Data(e.target.result as string);
      }
    };
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSave = () => {
    if (!file || !base64Data) return;
    if (!label.trim()) {
      setError("Please provide a label for your document.");
      return;
    }

    const doc: UploadedDocument = {
      id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      kind,
      label: label.trim(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      base64Data,
      keywords: extractBasicKeywords(label.trim()),
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveUploadedDocument(doc);
    onComplete();
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
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 6px", textAlign: "center" }}>
        Upload Your {docLabel}
      </h3>
      <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 24px", textAlign: "center" }}>
        Accepted formats: PDF, Word (.docx). Maximum size: 3MB.
      </p>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...glassCard,
            padding: "48px 24px",
            borderRadius: "20px",
            border: `2px dashed ${isDragging ? "#FFD600" : colors.border}`,
            background: isDragging
              ? (isDark ? "rgba(255,214,0,0.06)" : "rgba(255,214,0,0.05)")
              : (isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.4)"),
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.2s",
            marginBottom: "20px",
          }}
        >
          <Upload size={36} color={isDragging ? "#FFD600" : colors.textMuted} style={{ marginBottom: "12px" }} />
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, margin: "0 0 6px" }}>
            {isDragging ? "Drop your file here" : "Drag & drop your file here"}
          </p>
          <p style={{ fontSize: "0.8rem", color: colors.textMuted, margin: 0 }}>
            or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* File selected */}
      {file && (
        <div style={{ ...glassCard, padding: "20px", borderRadius: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={22} color="#3B82F6" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                {(file.size / 1024).toFixed(1)} KB • {file.type.includes("pdf") ? "PDF" : "Word Document"}
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setBase64Data(""); setLabel(""); }}
              style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Label input */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: colors.textSecondary, marginBottom: "6px" }}>
              Label / Nickname *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`e.g. My General ${docLabel}, ${docLabel} for Tech Jobs`}
              style={inputStyle}
            />
            <p style={{ fontSize: "0.7rem", color: colors.textMuted, margin: "6px 0 0" }}>
              Give it a memorable name so you can easily find it when applying to jobs.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: "16px" }}>
          <AlertCircle size={16} color="#EF4444" />
          <span style={{ fontSize: "0.8rem", color: "#EF4444" }}>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <button
          onClick={onCancel}
          style={{ padding: "12px 24px", borderRadius: "12px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
        >
          Cancel
        </button>
        {file && (
          <button
            onClick={handleSave}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "12px 28px", borderRadius: "12px", border: "none",
              background: "linear-gradient(135deg, #FFD600, #E6C200)",
              color: "#000", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255,214,0,0.3)",
            }}
          >
            <Check size={16} /> Save {docLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function extractBasicKeywords(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s\-_,.]+/)
    .filter((w) => w.length > 2);
}
