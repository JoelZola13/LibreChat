"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, Image, File, X } from "lucide-react";

interface DragDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSize?: number; // in bytes
  children: React.ReactNode;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    accent: string;
    danger: string;
  };
  disabled?: boolean;
}

export function DragDropZone({
  onFilesSelected,
  acceptedTypes = ["image/*", "application/pdf", ".doc", ".docx", ".txt"],
  maxFiles = 10,
  maxSize = 25 * 1024 * 1024, // 25MB
  children,
  colors,
  disabled = false,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      if (files.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { valid: [], errors };
      }

      files.forEach((file) => {
        // Check size
        if (file.size > maxSize) {
          errors.push(`${file.name} exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`);
          return;
        }

        // Check type (simple check)
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.endsWith("/*")) {
            return file.type.startsWith(type.replace("/*", "/"));
          }
          return file.type === type;
        });

        if (!isAccepted) {
          errors.push(`${file.name} is not an accepted file type`);
          return;
        }

        valid.push(file);
      });

      return { valid, errors };
    },
    [acceptedTypes, maxFiles, maxSize]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setError(errors[0]);
        setTimeout(() => setError(null), 5000);
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [disabled, validateFiles, onFilesSelected]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: "relative" }}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `${colors.accent}15`,
            border: `3px dashed ${colors.accent}`,
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(4px)",
          }}
        >
          <Upload size={48} color={colors.accent} style={{ marginBottom: "16px" }} />
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
            Drop files here
          </div>
          <div style={{ fontSize: "0.875rem", color: colors.textSecondary }}>
            Release to upload files to this conversation
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.danger,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 101,
          }}
        >
          <span style={{ fontSize: "0.875rem" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// File preview component for pending uploads
interface PendingFile {
  id: string;
  file: File;
  progress?: number;
  error?: string;
}

interface FilePreviewListProps {
  files: PendingFile[];
  onRemove: (id: string) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    danger: string;
  };
}

export function FilePreviewList({ files, onRemove, colors }: FilePreviewListProps) {
  if (files.length === 0) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (file: File): boolean => file.type.startsWith("image/");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px",
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      {files.map((item) => (
        <div
          key={item.id}
          style={{
            position: "relative",
            background: colors.surfaceHover,
            borderRadius: "8px",
            overflow: "hidden",
            border: item.error ? `1px solid ${colors.danger}` : `1px solid ${colors.border}`,
          }}
        >
          {isImage(item.file) ? (
            // Image preview
            <div style={{ width: "80px", height: "80px", position: "relative" }}>
              <img loading="lazy" decoding="async"
                src={URL.createObjectURL(item.file)}
                alt={item.file.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {item.progress !== undefined && item.progress < 100 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      width: `${item.progress}%`,
                      height: "100%",
                      background: colors.accent,
                      transition: "width 0.2s",
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            // File preview
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                maxWidth: "200px",
              }}
            >
              <File size={20} color={colors.textSecondary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: colors.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.file.name}
                </div>
                <div style={{ fontSize: "0.65rem", color: colors.textMuted }}>
                  {formatSize(item.file.size)}
                </div>
              </div>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemove(item.id)}
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={12} />
          </button>

          {/* Error indicator */}
          {item.error && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "4px",
                background: colors.danger,
                color: "#fff",
                fontSize: "0.65rem",
                textAlign: "center",
              }}
            >
              {item.error}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default DragDropZone;
