"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ExternalLink,
  X,
  Eye,
  Clock,
  MessageSquare,
} from "lucide-react";
import { DocumentPicker } from "@/components/documents";
import {
  type Document,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
} from "@/lib/api/documents";

interface DocumentAttachmentProps {
  document: Document;
  isDark?: boolean;
  onRemove?: () => void;
  compact?: boolean;
}

/**
 * Display a document attachment in a message
 */
export function DocumentAttachment({
  document,
  isDark = true,
  onRemove,
  compact = false,
}: DocumentAttachmentProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    return DOCUMENT_STATUSES.find((s) => s.value === status)?.color || "#6B7280";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const statusColor = getStatusColor(document.status);
  const statusLabel = DOCUMENT_STATUSES.find((s) => s.value === document.status)?.label;
  const typeLabel = DOCUMENT_TYPES.find((t) => t.value === document.documentType)?.label;

  const colors = {
    bg: isDark ? "rgba(255, 255, 255, 0.05)" : "#f5f5f5",
    border: isDark ? "rgba(255, 255, 255, 0.1)" : "#e5e5e5",
    text: isDark ? "#fff" : "#111",
    textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#666",
    accent: "#FFD600",
  };

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <FileText className="w-4 h-4" style={{ color: statusColor }} />
        <span
          className="text-sm font-medium truncate max-w-[150px]"
          style={{ color: colors.text }}
        >
          {document.title}
        </span>
        <button
          onClick={() => navigate(`/documents/${document.id}`)}
          className="p-1 rounded transition-colors hover:bg-white/10"
        >
          <ExternalLink className="w-3 h-3" style={{ color: colors.textMuted }} />
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded transition-colors hover:bg-red-500/20"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="group rounded-xl overflow-hidden transition-all hover:shadow-lg"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        maxWidth: "320px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          <FileText className="w-5 h-5" style={{ color: statusColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4
            className="font-medium truncate"
            style={{ color: colors.text, fontSize: "14px" }}
          >
            {document.title}
          </h4>
          <div className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
            <span>{typeLabel}</span>
          </div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all hover:bg-red-500/20"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>

      {/* Stats */}
      <div
        className="flex items-center gap-4 px-3 py-2 text-xs"
        style={{ color: colors.textMuted }}
      >
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(document.updatedAt)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {document.viewCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {document.commentCount}
        </span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 p-2"
        style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)" }}
      >
        <button
          onClick={() => navigate(`/documents/${document.id}`)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: colors.accent,
            color: "#000",
          }}
        >
          <ExternalLink className="w-4 h-4" />
          Open Document
        </button>
      </div>
    </div>
  );
}

interface DocumentAttachButtonForMessagesProps {
  userId: string;
  isDark?: boolean;
  onSelect: (document: Document) => void;
  disabled?: boolean;
}

/**
 * Button to attach a document to a message
 */
export function DocumentAttachButtonForMessages({
  userId,
  isDark = true,
  onSelect,
  disabled = false,
}: DocumentAttachButtonForMessagesProps) {
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPicker(true)}
        disabled={disabled}
        className="p-2 rounded-lg transition-colors disabled:opacity-50"
        style={{
          color: isDark ? "rgba(255, 255, 255, 0.5)" : "#666",
        }}
        title="Attach document"
      >
        <FileText className="w-5 h-5" />
      </button>

      <DocumentPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(doc) => {
          onSelect(doc);
          setShowPicker(false);
        }}
        userId={userId}
        isDark={isDark}
        title="Share Document"
        subtitle="Choose a document to share in this conversation"
        showCreateNew={true}
        onCreateNew={() => {
          navigate("/documents/new?returnTo=/messages");
        }}
      />
    </>
  );
}
