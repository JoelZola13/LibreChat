"use client";

import React, { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import type { PopoverColors } from "../popovers";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ImportTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  colors: PopoverColors;
  onImport: (csvContent: string) => Promise<ImportResult>;
}

/**
 * Modal dialog for importing tasks from CSV
 */
export function ImportTasksModal({
  isOpen,
  onClose,
  projectName,
  colors,
  onImport,
}: ImportTasksModalProps) {
  const [csvContent, setCsvContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleClose = () => {
    setCsvContent("");
    setImportResult(null);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setCsvContent((evt.target?.result as string) || "");
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvContent.trim() || importing) return;

    setImporting(true);
    try {
      const result = await onImport(csvContent);
      setImportResult(result);
    } catch (error) {
      console.error("Import failed:", error);
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Import failed"],
      });
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "95%",
          maxWidth: "600px",
          maxHeight: "80vh",
          background: colors.sidebar,
          border: `1px solid ${colors.border}`,
          borderRadius: "16px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: colors.text }}>
              Import Tasks
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: colors.textMuted }}>
              Import tasks from CSV into {projectName}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textMuted,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflowY: "auto" }}>
          {importResult ? (
            <ImportResultView result={importResult} colors={colors} />
          ) : (
            <CsvInputView
              csvContent={csvContent}
              setCsvContent={setCsvContent}
              onFileUpload={handleFileUpload}
              colors={colors}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,0.1)",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              color: colors.text,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {importResult ? "Close" : "Cancel"}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={!csvContent.trim() || importing}
              style={{
                padding: "10px 20px",
                background:
                  csvContent.trim() && !importing
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "8px",
                color: csvContent.trim() && !importing ? "#fff" : colors.textMuted,
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: csvContent.trim() && !importing ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Import Tasks
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportResultView({
  result,
  colors,
}: {
  result: ImportResult;
  colors: PopoverColors;
}) {
  return (
    <div>
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          background: result.success
            ? "rgba(34, 197, 94, 0.15)"
            : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${result.success ? "#22c55e" : "#ef4444"}`,
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: result.success ? "#22c55e" : "#ef4444",
          }}
        >
          {result.success ? "Import Complete" : "Import Failed"}
        </div>
        <div style={{ fontSize: "0.9rem", color: colors.text, marginTop: "8px" }}>
          Imported: {result.imported} tasks
          {result.skipped > 0 && `, Skipped: ${result.skipped}`}
        </div>
      </div>
      {result.errors.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontWeight: 500, color: colors.text, marginBottom: "8px" }}>
            Errors:
          </div>
          {result.errors.map((err, i) => (
            <div
              key={i}
              style={{ fontSize: "0.85rem", color: "#ef4444", padding: "4px 0" }}
            >
              • {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CsvInputView({
  csvContent,
  setCsvContent,
  onFileUpload,
  colors,
}: {
  csvContent: string;
  setCsvContent: (val: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  colors: PopoverColors;
}) {
  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.85rem",
            color: colors.textSecondary,
            marginBottom: "8px",
          }}
        >
          Paste CSV content or upload a file
        </label>
        <div style={{ marginBottom: "12px" }}>
          <input
            type="file"
            accept=".csv"
            onChange={onFileUpload}
            style={{
              width: "100%",
              padding: "8px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              color: colors.text,
              fontSize: "0.85rem",
            }}
          />
        </div>
        <textarea
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder={`title,description,status,priority,due_at\nTask 1,Description here,todo,high,2025-02-15\nTask 2,Another task,in_progress,medium,2025-02-20`}
          style={{
            width: "100%",
            height: "200px",
            padding: "12px",
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            color: colors.text,
            fontSize: "0.85rem",
            fontFamily: "monospace",
            resize: "vertical",
          }}
        />
      </div>
      <div
        style={{
          padding: "12px",
          background: "rgba(59, 130, 246, 0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(59, 130, 246, 0.3)",
        }}
      >
        <div
          style={{
            fontWeight: 500,
            color: "#3b82f6",
            fontSize: "0.85rem",
            marginBottom: "8px",
          }}
        >
          CSV Format Guide
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: colors.textMuted,
            lineHeight: 1.5,
          }}
        >
          <strong>Required:</strong> title
          <br />
          <strong>Optional:</strong> description, status (todo, in_progress, review,
          done), priority (urgent, high, medium, low, none), due_at (YYYY-MM-DD),
          start_at, assignees (comma-separated), labels, parent_title (for subtasks)
        </div>
      </div>
    </div>
  );
}
