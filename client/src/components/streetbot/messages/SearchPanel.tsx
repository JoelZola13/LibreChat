"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Search, Filter, Calendar, User, Paperclip, Link, Pin } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

// Simple debounce hook (replaces use-debounce dependency)
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay]
  ) as unknown as T;
}

const API_BASE = "/api/messaging";

type SearchResult = {
  id: number | string;
  conversation_id: number | string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  attachments: any[];
};

interface SearchPanelProps {
  userId: string;
  conversationId?: number | string;
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
  colors: Record<string, string>;
  isDark: boolean;
}

export default function SearchPanel({
  userId,
  conversationId,
  onClose,
  onResultClick,
  colors,
  isDark,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [fromUser, setFromUser] = useState("");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [hasLink, setHasLink] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() && !fromUser && !hasAttachment && !hasLink && !isPinned) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      // Build the query with Slack-style filters
      let fullQuery = searchQuery;
      if (fromUser) fullQuery += ` from:${fromUser}`;
      if (hasAttachment) fullQuery += " has:attachment";
      if (hasLink) fullQuery += " has:link";
      if (isPinned) fullQuery += " is:pinned";

      const body: any = {
        query: fullQuery,
        limit: 50,
        offset: 0,
      };

      if (conversationId) {
        body.conversation_id = conversationId;
      }
      if (beforeDate) {
        body.before = new Date(beforeDate).toISOString();
      }
      if (afterDate) {
        body.after = new Date(afterDate).toISOString();
      }

      const resp = await sbFetch(`${API_BASE}/search?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, conversationId, fromUser, hasAttachment, hasLink, isPinned, beforeDate, afterDate]);

  // Debounced search
  const debouncedSearch = useDebouncedCallback((value: string) => {
    performSearch(value);
  }, 300);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const clearFilters = () => {
    setFromUser("");
    setHasAttachment(false);
    setHasLink(false);
    setIsPinned(false);
    setBeforeDate("");
    setAfterDate("");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const highlightText = (text: string, searchTerms: string[]) => {
    if (!searchTerms.length) return text;

    const regex = new RegExp(`(${searchTerms.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      searchTerms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
        <mark
          key={i}
          style={{
            background: isDark ? "rgba(255, 214, 0, 0.3)" : "rgba(255, 214, 0, 0.5)",
            color: "inherit",
            padding: "0 2px",
            borderRadius: "2px",
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Extract search terms for highlighting
  const searchTerms = query
    .split(/\s+/)
    .filter((term) => !term.includes(":") && term.length > 0);

  return (
    <aside
      style={{
        width: "350px",
        background: colors.sidebar,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, color: colors.text, fontSize: "1rem", fontWeight: 600 }}>
          Search Messages
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: colors.textSecondary,
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: colors.surfaceHover,
            borderRadius: "12px",
            border: `1px solid ${colors.border}`,
            padding: "10px 14px",
          }}
        >
          <Search size={16} color={colors.textMuted} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search... (try from:user, has:link)"
            value={query}
            onChange={handleQueryChange}
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.9rem",
            }}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? colors.accent : "none",
              border: "none",
              borderRadius: "4px",
              color: showFilters ? "#000" : colors.textSecondary,
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: colors.cardBg,
              borderRadius: "12px",
              border: `1px solid ${colors.border}`,
            }}
          >
            {/* From User */}
            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.75rem",
                  color: colors.textSecondary,
                  marginBottom: "4px",
                }}
              >
                <User size={12} /> From user
              </label>
              <input
                type="text"
                placeholder="username"
                value={fromUser}
                onChange={(e) => {
                  setFromUser(e.target.value);
                  debouncedSearch(query);
                }}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceHover,
                  color: colors.text,
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Date Range */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.75rem",
                    color: colors.textSecondary,
                    marginBottom: "4px",
                  }}
                >
                  <Calendar size={12} /> After
                </label>
                <input
                  type="date"
                  value={afterDate}
                  onChange={(e) => {
                    setAfterDate(e.target.value);
                    debouncedSearch(query);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surfaceHover,
                    color: colors.text,
                    fontSize: "0.8rem",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.75rem",
                    color: colors.textSecondary,
                    marginBottom: "4px",
                  }}
                >
                  <Calendar size={12} /> Before
                </label>
                <input
                  type="date"
                  value={beforeDate}
                  onChange={(e) => {
                    setBeforeDate(e.target.value);
                    debouncedSearch(query);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surfaceHover,
                    color: colors.text,
                    fontSize: "0.8rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                onClick={() => {
                  setHasAttachment(!hasAttachment);
                  setTimeout(() => debouncedSearch(query), 0);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "16px",
                  border: `1px solid ${hasAttachment ? colors.accent : colors.border}`,
                  background: hasAttachment ? `${colors.accent}22` : "transparent",
                  color: hasAttachment ? colors.accent : colors.textSecondary,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <Paperclip size={12} /> has:file
              </button>
              <button
                onClick={() => {
                  setHasLink(!hasLink);
                  setTimeout(() => debouncedSearch(query), 0);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "16px",
                  border: `1px solid ${hasLink ? colors.accent : colors.border}`,
                  background: hasLink ? `${colors.accent}22` : "transparent",
                  color: hasLink ? colors.accent : colors.textSecondary,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <Link size={12} /> has:link
              </button>
              <button
                onClick={() => {
                  setIsPinned(!isPinned);
                  setTimeout(() => debouncedSearch(query), 0);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "16px",
                  border: `1px solid ${isPinned ? colors.accent : colors.border}`,
                  background: isPinned ? `${colors.accent}22` : "transparent",
                  color: isPinned ? colors.accent : colors.textSecondary,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <Pin size={12} /> is:pinned
              </button>
            </div>

            {/* Clear Filters */}
            {(fromUser || hasAttachment || hasLink || isPinned || beforeDate || afterDate) && (
              <button
                onClick={clearFilters}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  padding: "6px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                  background: "transparent",
                  color: colors.textSecondary,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: colors.textSecondary, padding: "20px" }}>
            Searching...
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", color: colors.textSecondary, padding: "20px" }}>
            {query ? "No results found" : "Enter a search term"}
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: "0.75rem",
                color: colors.textSecondary,
                marginBottom: "8px",
              }}
            >
              {total} result{total !== 1 ? "s" : ""} found
            </div>
            {results.map((result) => (
              <div
                key={result.id}
                onClick={() => onResultClick(result)}
                style={{
                  padding: "12px",
                  background: colors.cardBg,
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  marginBottom: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                  e.currentTarget.style.borderColor = colors.borderHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.cardBg;
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontWeight: 600, color: colors.text, fontSize: "0.85rem" }}>
                    {result.sender_name}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                    {formatDate(result.created_at)}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: colors.text,
                    fontSize: "0.85rem",
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {highlightText(result.content, searchTerms)}
                </p>
                {result.is_pinned && (
                  <div
                    style={{
                      marginTop: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.7rem",
                      color: colors.accent,
                    }}
                  >
                    <Pin size={10} /> Pinned
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
