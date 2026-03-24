"use client";

import React from "react";

interface TypingIndicatorProps {
  users: { id: string; name: string }[];
  colors: {
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
  };
}

export function TypingIndicator({ users, colors }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].name} is typing`;
    }
    if (users.length === 2) {
      return `${users[0].name} and ${users[1].name} are typing`;
    }
    if (users.length === 3) {
      return `${users[0].name}, ${users[1].name}, and ${users[2].name} are typing`;
    }
    return `${users[0].name} and ${users.length - 1} others are typing`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        fontSize: "0.75rem",
        color: colors.textMuted,
      }}
    >
      {/* Animated dots */}
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: colors.accent,
              animation: `typingBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span>{getTypingText()}</span>

      {/* Keyframe animation */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default TypingIndicator;
