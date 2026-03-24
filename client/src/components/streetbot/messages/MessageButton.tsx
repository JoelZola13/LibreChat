"use client";

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { getOrCreateUserId } from "@/lib/userId";
import { sbFetch } from "../shared/sbFetch";

const MESSAGING_API_URL = "/api/messaging";

interface MessageButtonProps {
  /** The user ID of the recipient */
  recipientId: string;
  /** Optional display name for context in the message */
  recipientName?: string;
  /** Optional context message to pre-fill (e.g., "I saw your artwork...") */
  contextMessage?: string;
  /** Button variant */
  variant?: "primary" | "secondary" | "icon" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Custom label text */
  label?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Dark mode */
  isDark?: boolean;
  /** Callback when conversation is created/found */
  onConversationStart?: (conversationId: number) => void;
}

/**
 * Reusable message button component that creates or finds a conversation
 * with the specified recipient and navigates to the messages page.
 */
export function MessageButton({
  recipientId,
  recipientName,
  contextMessage,
  variant = "secondary",
  size = "md",
  className = "",
  disabled = false,
  label = "Message",
  showIcon = true,
  isDark = true,
  onConversationStart,
}: MessageButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (loading || disabled) return;

      setLoading(true);

      try {
        const userId = getOrCreateUserId();

        // Don't message yourself
        if (userId === recipientId) {
          console.warn("Cannot message yourself");
          setLoading(false);
          return;
        }

        // Create or find conversation with the recipient via unified messaging API
        const resp = await sbFetch(`${MESSAGING_API_URL}/conversations/group?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
          body: JSON.stringify({
            participant_ids: [userId, recipientId],
          }),
        });

        if (resp.ok) {
          const conv = await resp.json();
          onConversationStart?.(conv.id);

          // Navigate to messages with conversation selected
          // Store context message in sessionStorage for the messages page to pick up
          if (contextMessage) {
            sessionStorage.setItem(
              "messaging_context",
              JSON.stringify({
                conversationId: conv.id,
                recipientName,
                contextMessage,
              })
            );
          }

          navigate(`/messages?conversation=${conv.id}`);
        } else {
          console.error("Failed to create conversation:", await resp.text());
        }
      } catch (error) {
        console.error("Failed to start conversation:", error);
      } finally {
        setLoading(false);
      }
    },
    [recipientId, recipientName, contextMessage, loading, disabled, router, onConversationStart]
  );

  // Size styles
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-2.5 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // Variant styles
  const variantStyles = {
    primary: isDark
      ? "bg-[#FFD600] text-black hover:bg-[#E6C200] font-medium"
      : "bg-[#FFD600] text-black hover:bg-[#E6C200] font-medium",
    secondary: isDark
      ? "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700"
      : "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200",
    icon: isDark
      ? "p-2 bg-zinc-800 text-white hover:bg-zinc-700 rounded-lg"
      : "p-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-lg",
    ghost: isDark
      ? "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`
          ${variantStyles.icon}
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center
          ${className}
        `}
        title={`Message ${recipientName || "user"}`}
        aria-label={`Message ${recipientName || "user"}`}
      >
        {loading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <MessageCircle className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        rounded-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        ${className}
      `}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <>
          {showIcon && <MessageCircle className={iconSizes[size]} />}
          {label}
        </>
      )}
    </button>
  );
}

export default MessageButton;
