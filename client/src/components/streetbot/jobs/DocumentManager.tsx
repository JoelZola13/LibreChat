import React, { useState, useMemo } from "react";
import { Search, FileText, Upload, Star, Trash2, Pencil, Eye, Clock, HardDrive } from "lucide-react";
import { getUploadedDocuments, deleteUploadedDocument, setDefaultUploadedDocument, getStorageUsage } from "./jobsStorage";
import type { UploadedDocument, ResumeVersion, CoverLetter } from "./types";

type DocumentEntry = {
  id: string;
  label: string;
  source: "uploaded" | "created";
  kind: "resume" | "cover_letter";
  isDefault: boolean;
  updatedAt: string;
  fileSize?: number;
  fileName?: string;
};

type Props = {
  userId: string;
  kind: "resume" | "cover_letter";
  resumeVersions?: ResumeVersion[];
  coverLetters?: CoverLetter[];
  uploadedDocs: UploadedDocument[];
  onEdit?: (id: string) => void;
  onPreview?: (id: string) => void;
  onSetDefault?: (id: string, source: "uploaded" | "created") => void;
  onDelete?: (id: string, source: "uploaded" | "created") => void;
  onAddNew: () => void;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
  glassSurface: React.CSSProperties;
};

export default function DocumentManager({
  userId, kind, resumeVersions, coverLetters, uploadedDocs,
  onEdit, onPreview, onSetDefault, onDelete, onAddNew,
  colors, isDark, glassCard, glassSurface,
}: Props) {
  const [search, setSearch] = useState("");
  const docLabel = kind === "resume" ? "Resume" : "Cover Letter";

  const documents = useMemo(() => {
    const entries: DocumentEntry[] = [];

    // Created documents
    if (kind === "resume" && resumeVersions) {
      for (const v of resumeVersions) {
        entries.push({
          id: v.id,
          label: v.label,
          source: "created",
          kind: "resume",
          isDefault: v.isDefault,
          updatedAt: v.updatedAt,
        });
      }
    }
    if (kind === "cover_letter" && coverLetters) {
      for (const cl of coverLetters) {
        entries.push({
          id: cl.id,
          label: cl.title,
          source: "created",
          kind: "cover_letter",
          isDefault: false,
          updatedAt: cl.updatedAt,
        });
      }
    }

    // Uploaded documents
    for (const doc of uploadedDocs) {
      entries.push({
        id: doc.id,
        label: doc.label,
        source: "uploaded",
        kind: doc.kind,
        isDefault: doc.isDefault,
        updatedAt: doc.updatedAt,
        fileSize: doc.fileSize,
        fileName: doc.fileName,
      });
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      return entries.filter((e) => e.label.toLowerCase().includes(q));
    }

    return entries.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [kind, resumeVersions, coverLetters, uploadedDocs, search]);

  const storage = useMemo(() => getStorageUsage(), [uploadedDocs]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
            Your {docLabel}s ({documents.length})
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.7rem", color: colors.textMuted }}>
            <HardDrive size={12} />
            Storage: {formatSize(storage.used)} / {formatSize(storage.limit)} ({storage.percentage}%)
          </div>
        </div>
        <button
          onClick={onAddNew}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "10px 18px", borderRadius: "12px", border: "none",
            background: "linear-gradient(135deg, #FFD600, #E6C200)",
            color: "#000", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
            boxShadow: "0 2px 12px rgba(255,214,0,0.25)",
          }}
        >
          + Add {docLabel}
        </button>
      </div>

      {/* Search */}
      {documents.length > 3 && (
        <div style={{
          ...glassSurface,
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 16px", borderRadius: "12px", marginBottom: "14px",
        }}>
          <Search size={16} color={colors.textMuted} />
          <input
            type="text"
            placeholder={`Search your ${docLabel.toLowerCase()}s...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, fontSize: "0.85rem", background: "transparent", border: "none", outline: "none", color: colors.text }}
          />
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <div style={{ ...glassSurface, borderRadius: "16px", padding: "40px 20px", textAlign: "center" }}>
          <FileText size={36} color={colors.textMuted} style={{ marginBottom: "12px" }} />
          <p style={{ fontSize: "0.9rem", color: colors.textSecondary, margin: 0 }}>
            No {docLabel.toLowerCase()}s saved yet. Add one to get started!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {documents.map((doc) => (
            <div
              key={`${doc.source}-${doc.id}`}
              style={{
                ...glassSurface,
                padding: "14px 18px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                borderLeft: doc.isDefault ? "3px solid #FFD600" : "3px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {/* Icon */}
              <div style={{
                width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                background: doc.source === "uploaded" ? "rgba(59,130,246,0.1)" : "rgba(255,214,0,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {doc.source === "uploaded" ? (
                  <Upload size={18} color="#3B82F6" />
                ) : (
                  <FileText size={18} color="#FFD600" />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.label}
                  </span>
                  {doc.isDefault && (
                    <span style={{ padding: "1px 8px", borderRadius: "6px", fontSize: "0.6rem", fontWeight: 700, background: "rgba(255,214,0,0.15)", color: "#B8960F" }}>
                      Default
                    </span>
                  )}
                  <span style={{ padding: "1px 8px", borderRadius: "6px", fontSize: "0.6rem", fontWeight: 600, background: doc.source === "uploaded" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)", color: doc.source === "uploaded" ? "#3B82F6" : "#8B5CF6" }}>
                    {doc.source === "uploaded" ? "Uploaded" : "Created"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", color: colors.textMuted, marginTop: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    <Clock size={10} /> {formatDate(doc.updatedAt)}
                  </span>
                  {doc.fileSize && (
                    <span>{formatSize(doc.fileSize)}</span>
                  )}
                  {doc.fileName && (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>{doc.fileName}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                {!doc.isDefault && onSetDefault && (
                  <button
                    onClick={() => onSetDefault(doc.id, doc.source)}
                    title="Set as default"
                    style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(255,214,0,0.08)", color: "#B8960F", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Star size={14} />
                  </button>
                )}
                {doc.source === "created" && onEdit && (
                  <button
                    onClick={() => onEdit(doc.id)}
                    title="Edit"
                    style={{ padding: "6px", borderRadius: "8px", border: "none", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: colors.textMuted, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(doc.id, doc.source)}
                    title="Delete"
                    style={{ padding: "6px", borderRadius: "8px", border: "none", background: "rgba(239,68,68,0.06)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
