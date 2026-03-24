"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  favicon?: string;
};

type LinkPreviewProps = {
  url: string;
  colors: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    surfaceHover: string;
    accent: string;
  };
  apiUrl?: string;
};

export function LinkPreview({ url, colors, apiUrl = "/api/messaging" }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await sbFetch(`${apiUrl}/unfurl?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          setPreview(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch link preview:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url, apiUrl]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px",
        background: colors.surface,
        borderRadius: "8px",
        border: `1px solid ${colors.border}`,
        marginTop: "8px",
      }}>
        <div style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.3)",
          borderTopColor: colors.accent,
          animation: "spin 1s linear infinite",
        }} />
        <span style={{ color: colors.textSecondary, fontSize: "0.875rem" }}>
          Loading preview...
        </span>
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        marginTop: "8px",
        background: colors.surface,
        borderRadius: "12px",
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
        textDecoration: "none",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.surfaceHover;
        e.currentTarget.style.borderColor = colors.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.surface;
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      <div style={{ display: "flex" }}>
        {preview.image && (
          <div style={{
            width: "120px",
            minHeight: "80px",
            background: `url(${preview.image}) center/cover`,
            flexShrink: 0,
          }} />
        )}
        <div style={{ flex: 1, padding: "12px", minWidth: 0 }}>
          {/* Site info */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "6px",
          }}>
            {preview.favicon ? (
              <img loading="lazy" decoding="async"
                src={preview.favicon}
                alt=""
                style={{ width: "14px", height: "14px", borderRadius: "2px" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <Globe size={14} color={colors.textSecondary} />
            )}
            <span style={{
              fontSize: "0.75rem",
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {preview.site_name || new URL(preview.url).hostname}
            </span>
            <ExternalLink size={12} color={colors.textSecondary} />
          </div>

          {/* Title */}
          {preview.title && (
            <div style={{
              fontWeight: 600,
              color: colors.text,
              marginBottom: "4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {preview.title}
            </div>
          )}

          {/* Description */}
          {preview.description && (
            <div style={{
              fontSize: "0.875rem",
              color: colors.textSecondary,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.4,
            }}>
              {preview.description}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<]+/g;
  const matches = text.match(urlRegex) || [];
  // Filter out URLs that are part of markdown links
  return matches.filter((url) => !text.includes(`](${url})`));
}

export default LinkPreview;
