"use client";

import React, { useState, useEffect, useRef } from "react";
import { AtSign } from "lucide-react";

type User = {
  id: string;
  name: string;
  avatar?: string;
};

type MentionsAutocompleteProps = {
  inputValue: string;
  cursorPosition: number;
  users: User[];
  onSelect: (user: User) => void;
  onClose: () => void;
  colors: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    surfaceHover: string;
    accent: string;
  };
};

export function MentionsAutocomplete({
  inputValue,
  cursorPosition,
  users,
  onSelect,
  onClose,
  colors,
}: MentionsAutocompleteProps) {
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we're in a mention context
    const textBeforeCursor = inputValue.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      setShowPicker(true);

      const filtered = users.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.id.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered.slice(0, 5));
      setSelectedIndex(0);
    } else {
      setShowPicker(false);
    }
  }, [inputValue, cursorPosition, users]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPicker || filteredUsers.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          onSelect(filteredUsers[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPicker, filteredUsers, selectedIndex, onSelect, onClose]);

  if (!showPicker || filteredUsers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: "8px",
        background: colors.surface,
        backdropFilter: "blur(20px)",
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        padding: "8px",
        minWidth: "200px",
        maxWidth: "300px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        zIndex: 100,
      }}
    >
      <div style={{
        fontSize: "0.75rem",
        color: colors.textSecondary,
        padding: "4px 8px",
        marginBottom: "4px",
      }}>
        People matching @{mentionQuery}
      </div>
      {filteredUsers.map((user, index) => (
        <div
          key={user.id}
          onClick={() => onSelect(user)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            background: index === selectedIndex ? colors.surfaceHover : "transparent",
            transition: "background 0.15s",
          }}
        >
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: user.avatar || colors.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#000",
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: colors.text }}>{user.name}</div>
            <div style={{ fontSize: "0.75rem", color: colors.textSecondary }}>@{user.id}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default MentionsAutocomplete;
