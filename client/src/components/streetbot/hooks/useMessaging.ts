/**
 * Custom hook for messaging functionality with Supabase Realtime support.
 *
 * This hook provides:
 * - Real-time message updates
 * - Typing indicators
 * - Online presence
 * - Optimistic updates for immediate feedback
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createConversationSubscriptions,
  isRealtimeAvailable,
  Message as RealtimeMessage,
  TypingUser,
} from "@/lib/supabaseRealtime";

const MESSAGES_API_URL = "/api/messages";

export type Message = {
  id: number;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  isPinned?: boolean;
  reactions: { emoji: string; count: number; hasReacted: boolean }[];
  threadCount?: number;
  threadLastReply?: string;
  attachments?: any[];
};

export type Conversation = {
  id: number;
  type: "dm" | "group_dm" | "channel";
  name: string;
  avatar?: string;
  isBot?: boolean;
  unreadCount: number;
  hasMention: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  memberCount?: number;
  participantIds?: string[];
};

// Sample users for display
const SAMPLE_USERS: Record<string, { name: string; avatar: string; isBot?: boolean }> = {
  streetbot: { name: "Street Voices", avatar: "#FFD700", isBot: true },
  "sarah-chen": { name: "Sarah Chen", avatar: "#00FFDD" },
  "marcus-lee": { name: "Marcus Lee", avatar: "#FF0055" },
  "alex-rivera": { name: "Alex Rivera", avatar: "#7700FF" },
  "jordan-kim": { name: "Jordan Kim", avatar: "#FFD700" },
  "maya-patel": { name: "Maya Patel", avatar: "#00FF88" },
};

function formatMessage(msg: any): Message {
  const user = SAMPLE_USERS[msg.sender_id] || { name: msg.sender_id, avatar: "#666" };
  return {
    id: msg.id,
    senderId: msg.sender_id,
    senderName: msg.sender_name || user.name,
    senderAvatar: user.avatar,
    content: msg.content,
    createdAt: msg.created_at,
    isEdited: !!msg.is_edited || !!msg.updated_at,
    isPinned: msg.is_pinned || false,
    reactions: [],
    threadCount: 0,
    attachments: msg.attachments,
  };
}

export function useMessaging(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const subscriptionRef = useRef<{ sendTyping: () => void; unsubscribe: () => void } | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${MESSAGES_API_URL}/conversations?user_id=${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        const formatted: Conversation[] = data.map((conv: any) => ({
          id: conv.id,
          type: conv.is_group ? "group_dm" : "dm",
          name: conv.participant_names?.join(", ") || "Unknown",
          avatar: conv.participant_avatars?.[0],
          isBot: conv.participant_ids?.includes("streetbot"),
          unreadCount: conv.unread_count || 0,
          hasMention: false,
          lastMessage: conv.last_message_preview,
          lastMessageAt: conv.last_message_at,
          participantIds: conv.participant_ids,
        }));
        setConversations(formatted);

        // Auto-select first conversation if none selected
        if (!selectedConversation && formatted.length > 0) {
          setSelectedConversation(formatted[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedConversation]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async () => {
    if (!selectedConversation) return;

    try {
      const url = `${MESSAGES_API_URL}/conversations/${selectedConversation.id}/messages?user_id=${encodeURIComponent(userId)}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setMessages(data.map(formatMessage));

        // Mark as read
        fetch(`${MESSAGES_API_URL}/conversations/${selectedConversation.id}/read?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
        });
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [selectedConversation, userId]);

  // Set up realtime subscriptions when conversation changes
  useEffect(() => {
    // Cleanup previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    if (!selectedConversation || selectedConversation.type === "channel") {
      return;
    }

    const userName = SAMPLE_USERS[userId]?.name || userId;

    subscriptionRef.current = createConversationSubscriptions(
      selectedConversation.id,
      userId,
      userName,
      {
        onNewMessage: (msg: RealtimeMessage) => {
          // Only add if not from current user (we handle that optimistically)
          if (msg.sender_id !== userId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, formatMessage(msg)];
            });
          }
        },
        onMessageUpdate: (msg: RealtimeMessage) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? formatMessage(msg) : m))
          );
        },
        onMessageDelete: (messageId: number) => {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        },
        onPresenceChange: setOnlineUsers,
        onTypingChange: setTypingUsers,
      }
    );

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [selectedConversation, userId]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, attachments?: any[]) => {
      if (!content.trim() || !selectedConversation) return null;

      // Optimistic update
      const tempId = Date.now();
      const user = SAMPLE_USERS[userId] || { name: "You", avatar: "#666" };
      const optimisticMessage: Message = {
        id: tempId,
        senderId: userId,
        senderName: user.name,
        senderAvatar: user.avatar,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        reactions: [],
        attachments,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const resp = await fetch(`${MESSAGES_API_URL}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            sender_id: userId,
            content: content.trim(),
            attachments,
          }),
        });

        if (resp.ok) {
          const newMessage = await resp.json();
          // Replace optimistic message with real one
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? formatMessage(newMessage) : m))
          );
          loadConversations(); // Refresh conversation list for last message
          return newMessage;
        } else {
          // Remove optimistic message on failure
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return null;
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return null;
      }
    },
    [selectedConversation, userId, loadConversations]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: number, newContent: string) => {
      try {
        const resp = await fetch(`${MESSAGES_API_URL}/${messageId}?user_id=${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent }),
        });

        if (resp.ok) {
          const updated = await resp.json();
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? formatMessage(updated) : m))
          );
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to edit message:", error);
        return false;
      }
    },
    [userId]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: number) => {
      try {
        const resp = await fetch(`${MESSAGES_API_URL}/${messageId}?user_id=${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });

        if (resp.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to delete message:", error);
        return false;
      }
    },
    [userId]
  );

  // Pin/unpin message
  const togglePin = useCallback(
    async (messageId: number, pinned: boolean) => {
      try {
        const resp = await fetch(`${MESSAGES_API_URL}/${messageId}/pin?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned }),
        });

        if (resp.ok) {
          const updated = await resp.json();
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? formatMessage(updated) : m))
          );
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to toggle pin:", error);
        return false;
      }
    },
    [userId]
  );

  // Add reaction
  const addReaction = useCallback(
    async (messageId: number, emoji: string) => {
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...m.reactions, { emoji, count: 1, hasReacted: true }],
          };
        })
      );

      try {
        await fetch(`${MESSAGES_API_URL}/${messageId}/reactions?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      } catch (error) {
        console.error("Failed to add reaction:", error);
        // Revert optimistic update on error
        loadMessages();
      }
    },
    [userId, loadMessages]
  );

  // Remove reaction
  const removeReaction = useCallback(
    async (messageId: number, emoji: string) => {
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing && existing.hasReacted) {
            if (existing.count === 1) {
              return {
                ...m,
                reactions: m.reactions.filter((r) => r.emoji !== emoji),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r
              ),
            };
          }
          return m;
        })
      );

      try {
        await fetch(`${MESSAGES_API_URL}/${messageId}/reactions/${encodeURIComponent(emoji)}?user_id=${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to remove reaction:", error);
        loadMessages();
      }
    },
    [userId, loadMessages]
  );

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.sendTyping();
    }
  }, []);

  // Create or find conversation
  const findOrCreateConversation = useCallback(
    async (participantIds: string[]) => {
      try {
        const resp = await fetch(`${MESSAGES_API_URL}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participant_ids: participantIds }),
        });

        if (resp.ok) {
          const conv = await resp.json();
          await loadConversations();
          const formatted: Conversation = {
            id: conv.id,
            type: participantIds.length > 2 ? "group_dm" : "dm",
            name: participantIds.filter((id) => id !== userId).join(", "),
            unreadCount: 0,
            hasMention: false,
            participantIds,
          };
          setSelectedConversation(formatted);
          return formatted;
        }
        return null;
      } catch (error) {
        console.error("Failed to create conversation:", error);
        return null;
      }
    },
    [userId, loadConversations]
  );

  return {
    // State
    conversations,
    selectedConversation,
    messages,
    loading,
    typingUsers,
    onlineUsers,
    isRealtimeEnabled: isRealtimeAvailable(),

    // Actions
    setSelectedConversation,
    loadConversations,
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    togglePin,
    addReaction,
    removeReaction,
    sendTyping,
    findOrCreateConversation,
  };
}
