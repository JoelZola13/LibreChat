import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, FileText, Save, Clock } from "lucide-react";
import { getCoverLetters, saveCoverLetter, deleteCoverLetter } from "./jobsStorage";
import type { CoverLetter } from "./types";

type Props = {
  userId: string;
  colors: Record<string, any>;
  isDark: boolean;
  glassCard: React.CSSProperties;
  glassSurface: React.CSSProperties;
};

export default function CoverLetterEditor({ userId, colors, isDark, glassCard, glassSurface }: Props) {
  const [letters, setLetters] = useState<CoverLetter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [toast, setToast] = useState("");

  const reload = useCallback(() => {
    setLetters(getCoverLetters(userId));
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const activeLetter = useMemo(() => letters.find((l) => l.id === activeId), [letters, activeId]);

  useEffect(() => {
    if (activeLetter) {
      setEditTitle(activeLetter.title);
      setEditContent(activeLetter.content);
    }
  }, [activeLetter]);

  // Auto-save debounce
  useEffect(() => {
    if (!activeId || !editTitle.trim()) return;
    const timer = setTimeout(() => {
      const letter: CoverLetter = {
        id: activeId,
        userId,
        title: editTitle.trim(),
        content: editContent,
        createdAt: activeLetter?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveCoverLetter(letter);
      reload();
    }, 500);
    return () => clearTimeout(timer);
  }, [editTitle, editContent, activeId, userId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleCreate = () => {
    const id = `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const letter: CoverLetter = {
      id,
      userId,
      title: "Untitled Cover Letter",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCoverLetter(letter);
    reload();
    setActiveId(id);
    setEditTitle(letter.title);
    setEditContent("");
  };

  const handleDelete = (letterId: string) => {
    deleteCoverLetter(userId, letterId);
    if (activeId === letterId) {
      setActiveId(null);
      setEditTitle("");
      setEditContent("");
    }
    reload();
    showToast("Cover letter deleted");
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
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
    <div>
      {toast && (
        <div style={{ marginBottom: "16px", padding: "12px 20px", borderRadius: "12px", background: "#10B981", color: "#fff", fontWeight: 600, fontSize: "0.85rem" }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: colors.text, margin: 0 }}>Cover Letters</h2>
        <button
          onClick={handleCreate}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "10px 20px", borderRadius: "12px", border: "none",
            background: colors.accent, color: "#000", fontWeight: 700,
            fontSize: "0.85rem", cursor: "pointer",
          }}
        >
          <Plus size={16} /> New Cover Letter
        </button>
      </div>

      {letters.length === 0 && !activeId ? (
        <div style={{ ...glassSurface, borderRadius: "18px", padding: "48px 24px", textAlign: "center" }}>
          <FileText size={40} color={colors.textMuted} style={{ marginBottom: "12px" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>No Cover Letters</h3>
          <p style={{ color: colors.textSecondary, margin: "0 0 16px", fontSize: "0.85rem" }}>
            Create cover letters to use when applying to jobs.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: activeId ? "250px 1fr" : "1fr", gap: "16px" }}>
          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {letters.map((letter) => (
              <div
                key={letter.id}
                onClick={() => setActiveId(letter.id)}
                style={{
                  ...glassSurface,
                  padding: "14px 16px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  borderLeft: activeId === letter.id ? `3px solid ${colors.accent}` : "3px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {letter.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: colors.textMuted, marginTop: "4px" }}>
                      <Clock size={10} /> {formatDate(letter.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(letter.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#EF4444", opacity: 0.6 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Editor */}
          {activeId && (
            <div style={{ ...glassCard, padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: colors.textSecondary, marginBottom: "6px" }}>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. General Application"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: colors.textSecondary, marginBottom: "6px" }}>Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your cover letter here..."
                  rows={12}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ fontSize: "0.7rem", color: colors.textMuted, marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                <Save size={10} /> Auto-saved
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
