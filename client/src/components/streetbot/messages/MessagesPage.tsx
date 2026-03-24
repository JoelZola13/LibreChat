"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  Plus,
  Send,
  Smile,
  Hash,
  Users,
  MessageCircle,
  MoreHorizontal,
  X,
  ChevronDown,
  ChevronRight,
  AtSign,
  Bookmark,
  Pin,
  Edit3,
  Trash2,
  Reply,
  Copy,
  Link,
  Flag,
  Paperclip,
  Image,
  File,
  MessageSquare,
  Wifi,
  WifiOff,
  ExternalLink,
  Forward,
  Bell,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/app/providers/theme-provider";
import { ChevronLeft } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";
import { UnifiedLayout } from "../shared/UnifiedLayout";
import { getOrCreateUserId } from "@/lib/userId";
import { useAuthContext } from "~/hooks/AuthContext";
import { useMessagingWebSocket, MessageEvent, TypingEvent, PresenceEvent } from "../hooks/useMessagingWebSocket";
import { sbFetch, sbGet, sbPost, sbPatch, sbDelete } from "../shared/sbFetch";
import {
  ThreadPanel,
  SearchPanel,
  SavedItemsPanel,
  PinnedMessagesPanel,
  NotificationSettingsPanel,
  EmojiPicker,
  ReactionsDetailModal,
  GroupDMCreationModal,
  ImageGalleryModal,
  ForwardMessageModal,
  EditMessageModal,
  InlineEditMessage,
  MessageContextMenu,
  RichTextToolbar,
  MentionsAutocomplete,
  VoiceRecorder,
  DragDropZone,
  FilePreviewList,
  TypingIndicator,
  ReadReceiptIndicator,
  ReadReceiptsList,
} from "./index";
import LinkPreview, { extractUrls } from "./LinkPreview";

// Import glassmorphism styles
import "@/styles/glassmorphism.css";

// Legacy endpoints (used as fallback for groups/channels)
const GROUPS_API_URL = "/api/groups";
// Unified messaging endpoint (Mattermost-bridged)
const MESSAGING_API_URL = "/api/messaging";

// Common emojis for quick reactions
const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉", "👀"];

// Extended emoji list for picker
const ALL_EMOJIS = [
  "👍", "❤️", "🔥", "😂", "🎉", "👀", "😍", "🙌", "💯", "✅",
  "👎", "😢", "😮", "🤔", "💪", "🚀", "⭐", "💡", "🎨", "🎵",
];

// Sample users
const SAMPLE_USERS: Record<string, { name: string; avatar: string; isBot?: boolean }> = {
  "streetbot": { name: "Street Voices", avatar: "#FFD700", isBot: true },
  "sarah-chen": { name: "Sarah Chen", avatar: "#00FFDD" },
  "marcus-lee": { name: "Marcus Lee", avatar: "#FF0055" },
  "alex-rivera": { name: "Alex Rivera", avatar: "#7700FF" },
  "jordan-kim": { name: "Jordan Kim", avatar: "#FFD700" },
  "maya-patel": { name: "Maya Patel", avatar: "#00FF88" },
};

type Channel = {
  id: number | string;  // string for Mattermost channel IDs, number for in-memory
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

type Attachment = {
  id: string;
  type: "image" | "file";
  name: string;
  size: number;
  url: string;
  mimeType: string;
};

type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  favicon?: string;
};

type Message = {
  id: number | string;  // string for Mattermost post IDs, number for in-memory
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  isPinned?: boolean;
  isSaved?: boolean;
  isDeleted?: boolean;
  reactions: { emoji: string; count: number; hasReacted: boolean }[];
  threadCount?: number;
  threadLastReply?: string;
  threadLastRepliers?: string[];
  attachments?: Attachment[];
  linkPreviews?: LinkPreview[];
};

// Render markdown-style formatting
const renderFormattedContent = (content: string): React.ReactNode => {
  if (!content) return null;

  // Process markdown patterns
  let processed = content;

  // Split by code blocks first to avoid processing inside them
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  const processInlineFormatting = (text: string, key: string): React.ReactNode => {
    // Process inline code first
    const inlineCodeRegex = /`([^`]+)`/g;
    const inlineParts: React.ReactNode[] = [];
    let inlineLastIndex = 0;
    let inlineMatch;

    while ((inlineMatch = inlineCodeRegex.exec(text)) !== null) {
      if (inlineMatch.index > inlineLastIndex) {
        inlineParts.push(processOtherFormatting(text.slice(inlineLastIndex, inlineMatch.index), `${key}-pre-${inlineMatch.index}`));
      }
      inlineParts.push(
        <code key={`${key}-code-${inlineMatch.index}`} style={{
          background: "rgba(255,255,255,0.1)",
          padding: "2px 6px",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "0.9em",
        }}>
          {inlineMatch[1]}
        </code>
      );
      inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
    }

    if (inlineLastIndex < text.length) {
      inlineParts.push(processOtherFormatting(text.slice(inlineLastIndex), `${key}-post`));
    }

    return inlineParts.length > 0 ? inlineParts : processOtherFormatting(text, key);
  };

  const processOtherFormatting = (text: string, key: string): React.ReactNode => {
    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough: ~~text~~
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#FFD700;text-decoration:underline">$1</a>');

    // Mentions: @username
    text = text.replace(/@(\w+)/g, '<span style="background:rgba(255,214,0,0.2);padding:0 4px;border-radius:3px;color:#FFD700">@$1</span>');

    // Auto-link URLs
    text = text.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
      if (match.includes('href=')) return match; // Already a link
      return `<a href="${match}" target="_blank" rel="noopener noreferrer" style="color:#FFD700;text-decoration:underline">${match}</a>`;
    });

    return <span key={key} dangerouslySetInnerHTML={{ __html: text }} />;
  };

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(processInlineFormatting(content.slice(lastIndex, match.index), `text-${lastIndex}`));
    }
    parts.push(
      <pre key={`codeblock-${match.index}`} style={{
        background: "rgba(0,0,0,0.3)",
        padding: "12px",
        borderRadius: "8px",
        overflow: "auto",
        fontFamily: "monospace",
        fontSize: "0.9em",
        margin: "8px 0",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {match[1].trim()}
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(processInlineFormatting(content.slice(lastIndex), `text-${lastIndex}`));
  }

  return parts.length > 0 ? parts : content;
};

type TypingUser = {
  user_id: string;
  user_name: string;
};

type GroupedMessages = {
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: string;
  messages: Message[];
};

export default function SlackStyleMessaging() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { isMobile } = useResponsive();

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | string | null>(null);
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<number | string | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<number | string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    channels: true,
  });
  const [showChannelBrowser, setShowChannelBrowser] = useState(false);
  const [allBrowseChannels, setAllBrowseChannels] = useState<Channel[]>([]);
  const [channelBrowseFilter, setChannelBrowseFilter] = useState<"all" | "public" | "private" | "group">("all");
  const [channelBrowseSearch, setChannelBrowseSearch] = useState("");
  // New state for enhanced features
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [userPresence, setUserPresence] = useState<Record<string, string>>({});
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [threadParentMessage, setThreadParentMessage] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New messages divider and infinite scroll
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<number | string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [savedItems, setSavedItems] = useState<any[]>([]);

  // New modal and panel states for advanced features
  const [showGroupDMModal, setShowGroupDMModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; name?: string; message_id?: number | string }[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [showReactionsDetail, setShowReactionsDetail] = useState(false);
  const [reactionsDetailMessage, setReactionsDetailMessage] = useState<Message | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; avatar: string; isOnline: boolean }[]>([]);
  const [pinnedMessagesWithContent, setPinnedMessagesWithContent] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  // URL query params for deep-linking to conversations
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (event.conversation_id !== selectedChannel?.id) return;

    if (event.type === "message.created") {
      const newMsg = event.data;
      const user = SAMPLE_USERS[newMsg.sender_id] || { name: newMsg.sender_id, avatar: "#666" };
      const formattedMsg = {
        id: newMsg.id,
        senderId: newMsg.sender_id,
        senderName: newMsg.sender_name || user.name,
        senderAvatar: user.avatar,
        content: newMsg.content,
        createdAt: newMsg.created_at,
        reactions: [],
        attachments: newMsg.attachments,
      };
      setMessages((prev) => [...prev, formattedMsg]);

      // Track new messages if scrolled up
      if (isScrolledUp && newMsg.sender_id !== userId) {
        setHasNewMessages(true);
        setNewMessageCount((prev) => prev + 1);
      }
    } else if (event.type === "message.updated") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.message_id ? { ...msg, ...event.data } : msg
        )
      );
    } else if (event.type === "message.deleted") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.message_id ? { ...msg, content: "This message was deleted.", isDeleted: true } : msg
        )
      );
    } else if (event.type === "reaction.added" || event.type === "reaction.removed") {
      // Update reaction in place from WebSocket event data
      const { message_id, emoji, user_id: reactUserId } = event as any;
      const isAdding = event.type === "reaction.added";

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;

          const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
          if (isAdding) {
            if (existingReaction) {
              return {
                ...msg,
                reactions: msg.reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count + 1, hasReacted: r.hasReacted || reactUserId === userId }
                    : r
                ),
              };
            } else {
              return {
                ...msg,
                reactions: [...msg.reactions, { emoji, count: 1, hasReacted: reactUserId === userId }],
              };
            }
          } else {
            if (existingReaction && existingReaction.count <= 1) {
              return {
                ...msg,
                reactions: msg.reactions.filter((r) => r.emoji !== emoji),
              };
            } else if (existingReaction) {
              return {
                ...msg,
                reactions: msg.reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count - 1, hasReacted: reactUserId === userId ? false : r.hasReacted }
                    : r
                ),
              };
            }
          }
          return msg;
        })
      );
    } else if (event.type === "message.pinned") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.message_id ? { ...msg, isPinned: true } : msg
        )
      );
    } else if (event.type === "message.unpinned") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.message_id ? { ...msg, isPinned: false } : msg
        )
      );
    } else if (event.type === "thread.updated") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.parent_message_id
            ? {
                ...msg,
                threadCount: event.data.reply_count,
                threadLastReply: event.data.last_reply_at,
                threadLastRepliers: event.data.last_repliers,
              }
            : msg
        )
      );
    }
  }, [selectedChannel?.id, isScrolledUp, userId]);

  const handleTypingEvent = useCallback((event: TypingEvent) => {
    if (event.conversation_id !== selectedChannel?.id) return;

    setTypingUsers((prev) => {
      if (event.is_typing) {
        // Add user if not already in list
        if (!prev.some((u) => u.user_id === event.user_id)) {
          return [...prev, { user_id: event.user_id, user_name: event.user_name }];
        }
        return prev;
      } else {
        // Remove user
        return prev.filter((u) => u.user_id !== event.user_id);
      }
    });
  }, [selectedChannel?.id]);

  const handlePresenceEvent = useCallback((event: PresenceEvent) => {
    setUserPresence((prev) => ({
      ...prev,
      [event.user_id]: event.status,
    }));
  }, []);

  const { isConnected, subscribe, unsubscribe, sendTyping } = useMessagingWebSocket({
    userId,
    onMessage: handleWebSocketMessage,
    onTyping: handleTypingEvent,
    onPresence: handlePresenceEvent,
  });

  // Subscribe to conversation when it changes
  useEffect(() => {
    if (selectedChannel) {
      subscribe(selectedChannel.id);
      setTypingUsers([]); // Clear typing indicators when switching
    }
    return () => {
      if (selectedChannel) {
        unsubscribe(selectedChannel.id);
      }
    };
  }, [selectedChannel?.id, subscribe, unsubscribe]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    // Send typing indicator
    if (selectedChannel && !isTyping) {
      setIsTyping(true);
      sendTyping(selectedChannel.id, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedChannel) {
        sendTyping(selectedChannel.id, false);
      }
      setIsTyping(false);
    }, 2000);
  };

  // Theme colors - TRUE GLASSMORPHISM
  const colors = useMemo(
    () => ({
      bg: isDark ? "var(--sb-color-background)" : "var(--sb-color-background)",
      // Glass surfaces - VERY translucent so background shows through
      sidebar: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.2)",
      surface: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)",
      surfaceHover: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.35)",
      // Glass borders - subtle white edge to catch light
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.5)",
      borderHover: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.7)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD700",
      accentText: isDark ? "#FFD700" : "#000",
      accentHover: "#e6c200",
      unread: "#FFD700",
      mention: "#FF0055",
      online: "#00FF88",
      success: "#00FF88",
      danger: "#ef4444",
      // Glass card - very translucent
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.3)",
      messageBg: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.15)",
      messageHover: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)",
      myMessage: isDark ? "rgba(255, 214, 0, 0.1)" : "rgba(255, 214, 0, 0.15)",
      reaction: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.4)",
      reactionActive: isDark ? "rgba(255, 214, 0, 0.2)" : "rgba(255, 214, 0, 0.3)",
      // Glass shadow - soft and subtle
      glassShadow: isDark
        ? "0 8px 32px rgba(0, 0, 0, 0.3)"
        : "0 8px 32px rgba(31, 38, 135, 0.15)",
    }),
    [isDark]
  );

  // Load channels (DMs + Groups) from unified /api/messaging/conversations endpoint
  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch conversations from the Mattermost-bridged endpoint
      const convResp = await sbFetch(`${MESSAGING_API_URL}/conversations?user_id=${encodeURIComponent(userId)}`);
      const convData = convResp.ok ? await convResp.json() : { conversations: [] };
      const conversations = convData.conversations || [];

      const allChannels: Channel[] = conversations.map((conv: any) => ({
        id: conv.id,
        type: conv.type === "channel" ? "channel" : conv.type === "group_dm" ? "group_dm" : "dm",
        name: conv.name || "Unknown",
        avatar: conv.avatar,
        isBot: false,
        unreadCount: conv.unread_count || 0,
        hasMention: false,
        lastMessage: conv.last_message_preview,
        lastMessageAt: conv.last_message_at,
        memberCount: conv.participant_count,
        participantIds: conv.participant_ids,
      }));

      // If no conversations found, add a default StreetBot conversation
      if (allChannels.length === 0) {
        const streetBotChannel: Channel = {
          id: 1,
          type: "dm",
          name: "Street Voices",
          avatar: "#FFD700",
          isBot: true,
          unreadCount: 0,
          hasMention: false,
          lastMessage: "Hi! I'm Street Voices, your AI assistant. How can I help you today?",
          participantIds: [userId, "streetbot"],
        };
        allChannels.push(streetBotChannel);
      }

      setChannels(allChannels);

      if (!selectedChannel && allChannels.length > 0) {
        setSelectedChannel(allChannels[0]);
      }
    } catch (error) {
      console.error("Failed to load channels:", error);
      // On error, still show StreetBot as fallback
      const fallbackChannel: Channel = {
        id: 1,
        type: "dm",
        name: "Street Voices",
        avatar: "#FFD700",
        isBot: true,
        unreadCount: 0,
        hasMention: false,
        lastMessage: "Hi! I'm Street Voices. How can I help you?",
        participantIds: [userId, "streetbot"],
      };
      setChannels([fallbackChannel]);
      if (!selectedChannel) {
        setSelectedChannel(fallbackChannel);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, selectedChannel]);

  // Load messages with enhanced data (reactions, threads, pins)
  const loadMessages = useCallback(async () => {
    if (!selectedChannel) return;
    try {
      // Use enhanced endpoint for all conversation types (Mattermost-bridged)
      const enhancedUrl = `${MESSAGING_API_URL}/messages/${selectedChannel.id}/enhanced?user_id=${encodeURIComponent(userId)}&limit=50`;
      const enhancedResp = await sbFetch(enhancedUrl);

      if (enhancedResp.ok) {
        const data = await enhancedResp.json();
        const formatted: Message[] = data.messages.map((msg: any) => {
          const user = SAMPLE_USERS[msg.sender_id] || { name: msg.sender_id, avatar: "#666" };
          return {
            id: msg.id,
            senderId: msg.sender_id,
            senderName: msg.sender_name || user.name,
            senderAvatar: msg.sender_avatar || user.avatar,
            content: msg.content,
            createdAt: msg.created_at,
            isEdited: msg.is_edited || false,
            isDeleted: msg.is_deleted || false,
            isPinned: msg.is_pinned || false,
            reactions: (msg.reactions || []).map((r: any) => ({
              emoji: r.emoji,
              count: r.count,
              hasReacted: r.has_reacted || false,
            })),
            threadCount: msg.thread?.reply_count || 0,
            threadLastReply: msg.thread?.last_reply_at,
            threadLastRepliers: msg.thread?.last_repliers || [],
            attachments: msg.attachments || [],
          };
        });
        setMessages(formatted);
        setHasMoreMessages(data.has_more || false);
        setOldestMessageId(data.oldest_id || null);

        // Mark as read
        if (formatted.length > 0) {
          const lastMsgId = formatted[formatted.length - 1].id;
          sbFetch(`${MESSAGING_API_URL}/read/${selectedChannel.id}?last_message_id=${lastMsgId}&user_id=${encodeURIComponent(userId)}`, {
            method: "POST",
          });
        }
        return;
      }

      // Enhanced endpoint returned non-OK — show fallback for StreetBot
      if (selectedChannel?.isBot) {
        setMessages([{
          id: 1,
          senderId: "streetbot",
          senderName: "Street Voices",
          senderAvatar: "#FFD700",
          content: "Hi! I'm Street Voices, your AI assistant for the Street Voices community. I can help you find resources, connect with services, and navigate the platform. How can I help you today?",
          createdAt: new Date().toISOString(),
          reactions: [],
        }]);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      // On error, show welcome message for StreetBot
      if (selectedChannel?.isBot) {
        setMessages([{
          id: 1,
          senderId: "streetbot",
          senderName: "Street Voices",
          senderAvatar: "#FFD700",
          content: "Hi! I'm Street Voices, your AI assistant. I can help you find resources, services, and support. What would you like help with?",
          createdAt: new Date().toISOString(),
          reactions: [],
        }]);
      }
    }
  }, [selectedChannel, userId]);

  // Load more messages (infinite scroll)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedChannel || isLoadingMore || !hasMoreMessages || !oldestMessageId) return;

    setIsLoadingMore(true);
    try {
      const enhancedUrl = `${MESSAGING_API_URL}/messages/${selectedChannel.id}/enhanced?user_id=${encodeURIComponent(userId)}&limit=50&before_id=${oldestMessageId}`;
      const resp = await sbFetch(enhancedUrl);

      if (resp.ok) {
        const data = await resp.json();
        const formatted: Message[] = data.messages.map((msg: any) => {
          const user = SAMPLE_USERS[msg.sender_id] || { name: msg.sender_id, avatar: "#666" };
          return {
            id: msg.id,
            senderId: msg.sender_id,
            senderName: msg.sender_name || user.name,
            senderAvatar: msg.sender_avatar || user.avatar,
            content: msg.content,
            createdAt: msg.created_at,
            isEdited: msg.is_edited || false,
            isDeleted: msg.is_deleted || false,
            isPinned: msg.is_pinned || false,
            reactions: (msg.reactions || []).map((r: any) => ({
              emoji: r.emoji,
              count: r.count,
              hasReacted: r.has_reacted || false,
            })),
            threadCount: msg.thread?.reply_count || 0,
            threadLastReply: msg.thread?.last_reply_at,
            threadLastRepliers: msg.thread?.last_repliers || [],
            attachments: msg.attachments || [],
          };
        });

        // Prepend older messages
        setMessages(prev => [...formatted, ...prev]);
        setHasMoreMessages(data.has_more || false);
        setOldestMessageId(data.oldest_id || null);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedChannel, userId, isLoadingMore, hasMoreMessages, oldestMessageId]);

  // Load saved items
  const loadSavedItems = useCallback(async () => {
    try {
      const resp = await sbFetch(`${MESSAGING_API_URL}/saved?user_id=${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSavedItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to load saved items:", error);
    }
  }, [userId]);

  // Handle scroll for infinite scroll and new messages divider
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Check if scrolled up from bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledUp(!isAtBottom);

    // Clear new messages indicator when at bottom
    if (isAtBottom) {
      setHasNewMessages(false);
      setNewMessageCount(0);
    }

    // Load more when scrolled to top
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages]);

  // Jump to latest messages
  const jumpToLatest = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessages(false);
    setNewMessageCount(0);
  };

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Load all channels for the channel browser
  const loadBrowseChannels = useCallback(async () => {
    try {
      const resp = await sbFetch(`${MESSAGING_API_URL}/conversations?user_id=${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        const convs = data.conversations || data || [];
        const mapped: Channel[] = convs.map((c: any) => ({
          id: c.id,
          type: c.type === "direct" ? "dm" as const : c.type === "group_dm" ? "group_dm" as const : "channel" as const,
          name: c.name || c.participant_names?.join(", ") || "Unknown",
          unreadCount: c.unread_count || 0,
          hasMention: false,
          lastMessage: c.purpose || c.header || "",
          lastMessageAt: c.last_message_at,
          memberCount: c.participant_count,
        }));
        setAllBrowseChannels(mapped);
      }
    } catch (error) {
      console.error("Failed to load browse channels:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (showChannelBrowser) {
      loadBrowseChannels();
    }
  }, [showChannelBrowser, loadBrowseChannels]);

  // Handle deep-link to specific conversation via URL query param
  useEffect(() => {
    if (conversationParam && channels.length > 0) {
      // Support both numeric and string (Mattermost) conversation IDs
      const target = channels.find(c => String(c.id) === conversationParam);
      if (target) {
        setSelectedChannel(target);
      }
    }
  }, [conversationParam, channels]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Send message — uses POST /api/messaging/send (Mattermost-bridged)
  const sendMessage = async () => {
    if ((!messageText.trim() && pendingAttachments.length === 0) || !selectedChannel) return;

    const content = replyingTo
      ? `> ${replyingTo.senderName}: ${replyingTo.content.slice(0, 50)}${replyingTo.content.length > 50 ? "..." : ""}\n\n${messageText.trim()}`
      : messageText.trim();

    try {
      const conversationId = selectedChannel.id;

      // All messages go through the unified /api/messaging/send endpoint
      const body: Record<string, any> = {
        conversation_id: String(conversationId),
        content,
        attachments: pendingAttachments.length > 0
          ? pendingAttachments.map(a => ({ id: a.id, type: a.type, name: a.name, url: a.url }))
          : undefined,
      };

      // If replying in a thread, pass root_id
      if (replyingTo) {
        body.root_id = String(replyingTo.id);
      }

      const resp = await sbFetch(`${MESSAGING_API_URL}/send?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const sentMsg = await resp.json();
        // Add message locally for immediate feedback
        const user = SAMPLE_USERS[userId] || { name: "You", avatar: "#666" };
        const newMsg: Message = {
          id: sentMsg.id || Date.now(),
          senderId: userId,
          senderName: user.name,
          senderAvatar: user.avatar,
          content: content,
          createdAt: sentMsg.created_at || new Date().toISOString(),
          reactions: [],
          attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
        };
        setMessages(prev => [...prev, newMsg]);

        setMessageText("");
        setReplyingTo(null);
        setPendingAttachments([]);
        loadChannels();
      } else {
        console.error("Failed to send message:", await resp.text());
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Toggle reaction - persisted to backend
  const toggleReaction = async (messageId: number | string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const existing = msg.reactions.find(r => r.emoji === emoji);
    const hasReacted = existing?.hasReacted || false;

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      if (existing) {
        if (hasReacted) {
          return {
            ...m,
            reactions: existing.count === 1
              ? m.reactions.filter(r => r.emoji !== emoji)
              : m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r)
          };
        } else {
          return {
            ...m,
            reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r)
          };
        }
      } else {
        return { ...m, reactions: [...m.reactions, { emoji, count: 1, hasReacted: true }] };
      }
    }));
    setShowEmojiPicker(null);

    // Persist to backend
    try {
      if (hasReacted) {
        await sbFetch(`${MESSAGING_API_URL}/reactions?message_id=${messageId}&message_type=dm&emoji=${encodeURIComponent(emoji)}&user_id=${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });
      } else {
        await sbFetch(`${MESSAGING_API_URL}/reactions?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
          body: JSON.stringify({ message_id: messageId, message_type: "dm", emoji }),
        });
      }
    } catch (error) {
      console.error("Failed to persist reaction:", error);
      // Revert optimistic update on error
      loadMessages();
    }
  };

  // Pin/unpin message - persisted to backend
  const togglePin = async (messageId: number | string) => {
    if (!selectedChannel) return;

    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const wasPinned = msg.isPinned;

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isPinned: !wasPinned } : m
    ));
    setShowMessageMenu(null);

    // Persist to backend
    try {
      if (wasPinned) {
        await sbFetch(`${MESSAGING_API_URL}/pins?message_id=${messageId}&conversation_id=${selectedChannel.id}&conversation_type=${selectedChannel.type}&user_id=${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });
      } else {
        await sbFetch(`${MESSAGING_API_URL}/pins?user_id=${encodeURIComponent(userId)}`, {
          method: "POST",
          body: JSON.stringify({
            message_id: messageId,
            conversation_id: selectedChannel.id,
            conversation_type: selectedChannel.type,
          }),
        });
      }
    } catch (error) {
      console.error("Failed to persist pin:", error);
      // Revert optimistic update on error
      loadMessages();
    }
  };

  // Delete message - persisted to backend
  const deleteMessage = async (messageId: number | string) => {
    if (!selectedChannel) return;

    // Optimistic update - show deleted placeholder
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: "This message was deleted.", isDeleted: true } : msg
    ));
    setShowMessageMenu(null);

    // Persist to backend via unified messaging API
    try {
      await sbFetch(`${MESSAGING_API_URL}/messages/${messageId}?conversation_id=${selectedChannel.id}&user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete message:", error);
      loadMessages();
    }
  };

  // Copy message text
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    setShowMessageMenu(null);
  };

  // Copy message link
  const copyMessageLink = (messageId: number | string) => {
    const url = `${window.location.origin}/messages?channel=${selectedChannel?.type}-${selectedChannel?.id}&msg=${messageId}`;
    navigator.clipboard.writeText(url);
    setShowMessageMenu(null);
  };

  // Start editing
  const startEdit = (msg: Message) => {
    setEditingMessage(msg);
    setEditText(msg.content);
    setShowMessageMenu(null);
  };

  // Save edit - persisted to backend
  const saveEdit = async () => {
    if (!editingMessage || !editText.trim() || !selectedChannel) return;

    const newContent = editText.trim();
    const messageId = editingMessage.id;

    // Optimistic update
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent, isEdited: true } : msg
    ));
    setEditingMessage(null);
    setEditText("");

    // Persist to backend via unified messaging API
    try {
      await sbFetch(`${MESSAGING_API_URL}/messages/${messageId}?conversation_id=${selectedChannel.id}&user_id=${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: JSON.stringify({ content: newContent }),
      });
    } catch (error) {
      console.error("Failed to save edit:", error);
      loadMessages();
    }
  };

  // Insert mention
  const insertMention = (userName: string) => {
    setMessageText(prev => prev + `@${userName} `);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  // Insert emoji into composer
  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowComposerEmoji(false);
    inputRef.current?.focus();
  };

  // Handle file selection - upload to server
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedChannel) return;

    setUploadingFile(true);

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Upload to server via sbFetch (no Content-Type header — FormData sets it automatically)
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversation_id", selectedChannel.id.toString());
        formData.append("user_id", userId);

        const response = await sbFetch(`${MESSAGING_API_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const uploadResult = await response.json();
          newAttachments.push({
            id: uploadResult.id,
            type: uploadResult.type,
            name: uploadResult.name,
            size: uploadResult.size,
            url: uploadResult.url,
            mimeType: uploadResult.mime_type,
          });
        } else {
          console.error("Failed to upload file:", file.name);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setUploadingFile(false);

    // Reset the file input
    e.target.value = "";
  };

  // Fetch link preview
  const fetchLinkPreview = async (url: string): Promise<LinkPreview | null> => {
    try {
      const response = await sbFetch(`${MESSAGING_API_URL}/unfurl?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Failed to fetch link preview:", error);
    }
    return null;
  };

  // Save/bookmark a message
  const saveMessage = async (message: Message) => {
    if (!selectedChannel) return;

    try {
      const response = await sbFetch(`${MESSAGING_API_URL}/saved?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify({
          message_id: message.id,
          conversation_id: selectedChannel.id,
          conversation_type: selectedChannel.type,
        }),
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg =>
          msg.id === message.id ? { ...msg, isSaved: true } : msg
        ));
      }
    } catch (error) {
      console.error("Failed to save message:", error);
    }
    setShowMessageMenu(null);
  };

  // Open thread panel
  const openThread = (message: Message) => {
    setThreadParentMessage(message);
    setShowThreadPanel(true);
    setShowSearchPanel(false);
    setShowMembersPanel(false);
    setShowPinnedPanel(false);
    setShowMessageMenu(null);
  };

  // Handle search result click
  const handleSearchResultClick = (result: any) => {
    // Find the message in current messages or scroll to it
    const targetMsg = messages.find(m => m.id === result.id);
    if (targetMsg) {
      // Highlight and scroll to message
      const msgElement = document.getElementById(`message-${result.id}`);
      if (msgElement) {
        msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
        msgElement.classList.add("search-highlight");
        setTimeout(() => msgElement.classList.remove("search-highlight"), 2000);
      }
    }
  };

  // Open image gallery for all images in the conversation
  const openImageGallery = (imageUrl: string, messageId: number | string) => {
    // Collect all images from messages
    const allImages: { id: string; url: string; name?: string; message_id?: number | string }[] = [];
    messages.forEach(msg => {
      if (msg.attachments) {
        msg.attachments
          .filter(att => att.type === "image")
          .forEach(att => {
            allImages.push({ id: att.id, url: att.url, name: att.name, message_id: msg.id });
          });
      }
    });
    setGalleryImages(allImages);
    const startIndex = allImages.findIndex(img => img.url === imageUrl);
    setGalleryStartIndex(startIndex >= 0 ? startIndex : 0);
    setShowImageGallery(true);
  };

  // Forward message to other conversations
  const openForwardModal = (message: Message) => {
    setMessageToForward(message);
    setShowForwardModal(true);
    setShowMessageMenu(null);
    setShowContextMenu(false);
  };

  const handleForwardMessage = async (messageId: number | string, targetConversationIds: (number | string)[]) => {
    if (!selectedChannel) return;

    try {
      await sbFetch(`${MESSAGING_API_URL}/forward`, {
        method: "POST",
        body: JSON.stringify({
          source_message_id: messageId,
          source_conversation_id: selectedChannel.id,
          target_conversation_ids: targetConversationIds,
          user_id: userId,
        }),
      });
    } catch (error) {
      console.error("Failed to forward message:", error);
    }
  };

  // Show reactions detail modal
  const openReactionsDetail = (message: Message) => {
    setReactionsDetailMessage(message);
    setShowReactionsDetail(true);
  };

  // Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenuMessage(message);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleContextMenuAction = async (action: string, message: Message) => {
    setShowContextMenu(false);

    switch (action) {
      case "reply":
        setReplyingTo(message);
        inputRef.current?.focus();
        break;
      case "edit":
        startEdit(message);
        break;
      case "delete":
        deleteMessage(message.id);
        break;
      case "pin":
        togglePin(message.id);
        break;
      case "save":
        saveMessage(message);
        break;
      case "copy":
        copyMessage(message.content);
        break;
      case "forward":
        openForwardModal(message);
        break;
      case "thread":
        openThread(message);
        break;
      case "report":
        alert("Message reported");
        break;
    }
  };

  // Create group DM via POST /api/messaging/conversations/group
  const handleCreateGroupDM = async (participantIds: string[], name?: string) => {
    try {
      const groupName = name || `Group (${participantIds.length + 1})`;
      const response = await sbFetch(`${MESSAGING_API_URL}/conversations/group?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify({
          participant_ids: [userId, ...participantIds],
          name: groupName,
          created_by: userId,
        }),
      });

      if (response.ok) {
        const conv = await response.json();
        await loadChannels();
        const newChannel: Channel = {
          id: conv.id,
          type: "group_dm",
          name: groupName,
          unreadCount: 0,
          hasMention: false,
          memberCount: participantIds.length + 1,
        };
        setSelectedChannel(newChannel);
      }
    } catch (error) {
      console.error("Failed to create group DM:", error);
    }
  };

  // Load pinned messages with content
  const loadPinnedMessagesWithContent = useCallback(async () => {
    if (!selectedChannel) return;

    try {
      const response = await sbFetch(
        `${MESSAGING_API_URL}/pins/${selectedChannel.id}/content?user_id=${encodeURIComponent(userId)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPinnedMessagesWithContent(data.pinned_messages || []);
      }
    } catch (error) {
      console.error("Failed to load pinned messages:", error);
    }
  }, [selectedChannel, userId]);

  // Navigate to pinned message
  const navigateToPinnedMessage = (messageId: number | string) => {
    setShowPinnedPanel(false);
    const msgElement = document.getElementById(`message-${messageId}`);
    if (msgElement) {
      msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
      msgElement.classList.add("search-highlight");
      setTimeout(() => msgElement.classList.remove("search-highlight"), 2000);
    }
  };

  // Handle voice message recording
  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    if (!selectedChannel) return;
    setShowVoiceRecorder(false);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice-message.webm");
      formData.append("conversation_id", selectedChannel.id.toString());
      formData.append("duration", "0");
      formData.append("user_id", userId);

      const response = await sbFetch(`${MESSAGING_API_URL}/upload/voice`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Voice message created; transcription is null until Whisper is integrated
        if (data.transcription) {
          console.log("Voice transcription:", data.transcription);
        }
      }
    } catch (error) {
      console.error("Failed to send voice message:", error);
    }
  };

  // Handle file drop from DragDropZone
  const handleFileDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      const url = URL.createObjectURL(file);
      const isImage = file.type.startsWith("image/");

      setPendingAttachments(prev => [...prev, {
        id,
        type: isImage ? "image" : "file",
        name: file.name,
        size: file.size,
        url,
        mimeType: file.type,
      }]);
    }
  }, []);

  // Load available users for group DM creation
  useEffect(() => {
    const users = Object.entries(SAMPLE_USERS).map(([id, user]) => ({
      id,
      name: user.name,
      avatar: user.avatar,
      isOnline: userPresence[id] === "online",
    }));
    setAvailableUsers(users);
  }, [userPresence]);

  // Load pinned messages when channel changes or panel opens
  useEffect(() => {
    if (showPinnedPanel && selectedChannel) {
      loadPinnedMessagesWithContent();
    }
  }, [showPinnedPanel, selectedChannel, loadPinnedMessagesWithContent]);

  // Remove pending attachment
  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment) {
        URL.revokeObjectURL(attachment.url); // Clean up the object URL
      }
      return prev.filter(a => a.id !== id);
    });
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle paste for images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setPendingAttachments(prev => [...prev, {
            id: `paste-${Date.now()}`,
            type: "image",
            name: `pasted-image-${Date.now()}.png`,
            size: file.size,
            url: url,
            mimeType: file.type,
          }]);
        }
      }
    }
  };

  // Create new channel
  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const resp = await sbFetch(`${GROUPS_API_URL}?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDescription.trim() || null,
          owner_id: userId,
          is_public: true,
          tags: [],
        }),
      });

      if (resp.ok) {
        const newGroup = await resp.json();
        setShowCreateChannelModal(false);
        setNewChannelName("");
        setNewChannelDescription("");
        await loadChannels();
        // Select the new channel
        setSelectedChannel({
          id: newGroup.id,
          type: "channel",
          name: newGroup.name,
          avatar: newGroup.avatar_url,
          unreadCount: 0,
          hasMention: false,
          memberCount: 1,
        });
      }
    } catch (error) {
      console.error("Failed to create channel:", error);
    }
  };

  // Group messages
  const groupMessages = (messages: Message[]): GroupedMessages[] => {
    const groups: GroupedMessages[] = [];
    let currentGroup: GroupedMessages | null = null;

    messages.forEach((msg, idx) => {
      const prevMsg = messages[idx - 1];
      const timeDiff = prevMsg
        ? (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) / 1000 / 60
        : Infinity;

      if (currentGroup && currentGroup.senderId === msg.senderId && timeDiff < 5) {
        currentGroup.messages.push(msg);
      } else {
        currentGroup = {
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          timestamp: msg.createdAt,
          messages: [msg],
        };
        groups.push(currentGroup);
      }
    });
    return groups;
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const dmChannels = channels.filter(c => c.type === "dm" || c.type === "group_dm");
  const groupChannels = channels.filter(c => c.type === "channel");
  const groupedMessages = groupMessages(messages);
  const pinnedMessages = messages.filter(m => m.isPinned);

  // Click outside handler
  useEffect(() => {
    const handleClick = () => {
      setShowEmojiPicker(null);
      setShowMessageMenu(null);
      setShowComposerEmoji(false);
      setShowMentionPicker(false);
      setShowAttachmentMenu(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <UnifiedLayout variant="full">
      {/* GLASSMORPHISM Background - Vivid colors that show through glass */}
      {/* Primary gradient orb - top center (purple/violet) */}
      <div
        style={{
          position: "fixed",
          top: "-30%",
          left: "30%",
          width: "800px",
          height: "800px",
          background: isDark
            ? "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(40px)",
        }}
        aria-hidden="true"
      />
      {/* Secondary gradient orb - right (pink/magenta) */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          background: isDark
            ? "radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0.15) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0.08) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />
      {/* Tertiary gradient orb - bottom left (cyan/teal) */}
      <div
        style={{
          position: "fixed",
          bottom: "-10%",
          left: "-10%",
          width: "700px",
          height: "700px",
          background: isDark
            ? "radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 30%, transparent 60%)"
            : "radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.05) 30%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(50px)",
        }}
        aria-hidden="true"
      />
      {/* Accent gradient orb - center right (yellow/gold) */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          right: "20%",
          width: "400px",
          height: "400px",
          background: isDark
            ? "radial-gradient(circle, rgba(255, 214, 0, 0.25) 0%, transparent 50%)"
            : "radial-gradient(circle, rgba(255, 214, 0, 0.15) 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(40px)",
        }}
        aria-hidden="true"
      />

      <div style={{
        display: "flex",
        height: isMobile ? "calc(100vh - 60px)" : "calc(100vh - 80px)",
        background: colors.cardBg,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRadius: isMobile ? "12px" : "24px",
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
        position: "relative",
        zIndex: 1,
      }}>
        {/* Sidebar — full-width on mobile when no channel selected, hidden when channel selected */}
        <aside style={{
          width: isMobile ? "100%" : "280px",
          background: colors.sidebar,
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRight: isMobile ? "none" : `1px solid ${colors.border}`,
          display: isMobile && selectedChannel ? "none" : "flex",
          flexDirection: "column",
        }}>
          {/* Workspace Header */}
          <div style={{
            padding: "16px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: colors.text }}>
              Street Voices
            </h2>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => setShowGroupDMModal(true)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: colors.surfaceHover,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Create group"
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => setShowNewMessageModal(true)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="New message"
              >
                <Edit3 size={16} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: "12px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: colors.surfaceHover,
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
            }}>
              <Search size={14} color={colors.textMuted} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: colors.text,
                  fontSize: "0.85rem",
                }}
              />
            </div>
          </div>

          {/* Channels List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
            {/* Channels Section */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
                <button
                  onClick={() => setExpandedSections(s => ({ ...s, channels: !s.channels }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "none",
                    border: "none",
                    color: colors.textSecondary,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                  }}
                >
                  {expandedSections.channels ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Channels
                </button>
                <button
                  onClick={() => setShowCreateChannelModal(true)}
                  title="Create channel"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    background: "none",
                    border: "none",
                    color: colors.textSecondary,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {expandedSections.channels && groupChannels.map(channel => (
                <button
                  key={`channel-${channel.id}`}
                  onClick={() => setSelectedChannel(channel)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "12px",
                    border: "none",
                    background: selectedChannel?.id === channel.id && selectedChannel?.type === "channel"
                      ? colors.surfaceHover : "transparent",
                    color: channel.unreadCount > 0 ? colors.text : colors.textSecondary,
                    fontWeight: channel.unreadCount > 0 ? 600 : 400,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!(selectedChannel?.id === channel.id && selectedChannel?.type === "channel")) {
                      e.currentTarget.style.background = colors.surface;
                      e.currentTarget.style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(selectedChannel?.id === channel.id && selectedChannel?.type === "channel")) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.transform = "translateX(0)";
                    }
                  }}
                >
                  <Hash size={16} color={colors.textMuted} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {channel.name}
                  </span>
                </button>
              ))}

              {/* Browse Channels Button */}
              {expandedSections.channels && (
                <button
                  onClick={() => setShowChannelBrowser(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "12px",
                    border: "none",
                    background: "transparent",
                    color: colors.textMuted,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surface;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = colors.textMuted;
                  }}
                >
                  <Search size={14} />
                  Browse channels
                </button>
              )}
            </div>

            {/* Saved Items Button */}
            <button
              onClick={() => {
                setShowSavedPanel(true);
                setShowThreadPanel(false);
                setShowSearchPanel(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 10px",
                marginBottom: "8px",
                borderRadius: "12px",
                border: "none",
                background: showSavedPanel ? colors.surfaceHover : "transparent",
                color: colors.textSecondary,
                fontSize: "0.9rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!showSavedPanel) {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.transform = "translateX(4px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!showSavedPanel) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateX(0)";
                }
              }}
            >
              <Bookmark size={16} color={colors.accent} />
              Saved Items
            </button>

            {/* DMs Section */}
            <div>
              <button
                onClick={() => setExpandedSections(s => ({ ...s, dms: !s.dms }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 8px",
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                }}
              >
                {expandedSections.dms ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Direct Messages
              </button>

              {expandedSections.dms && dmChannels.map(channel => (
                <button
                  key={`dm-${channel.id}`}
                  onClick={() => setSelectedChannel(channel)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "12px",
                    border: "none",
                    background: selectedChannel?.id === channel.id && selectedChannel?.type !== "channel"
                      ? colors.surfaceHover : "transparent",
                    color: channel.unreadCount > 0 ? colors.text : colors.textSecondary,
                    fontWeight: channel.unreadCount > 0 ? 600 : 400,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!(selectedChannel?.id === channel.id && selectedChannel?.type !== "channel")) {
                      e.currentTarget.style.background = colors.surface;
                      e.currentTarget.style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(selectedChannel?.id === channel.id && selectedChannel?.type !== "channel")) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.transform = "translateX(0)";
                    }
                  }}
                >
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    background: channel.avatar || "#666",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    position: "relative",
                  }}>
                    {channel.name.charAt(0).toUpperCase()}
                    {channel.isBot && (
                      <span style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        background: colors.accent,
                        borderRadius: "2px",
                        padding: "0 2px",
                        fontSize: "0.4rem",
                        color: "#000",
                        fontWeight: 700,
                      }}>AI</span>
                    )}
                  </div>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {channel.name}
                  </span>
                  {channel.unreadCount > 0 && (
                    <span style={{
                      background: colors.unread,
                      color: "#000",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "10px",
                    }}>
                      {channel.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Chat Area — full-width on mobile, hidden when no channel */}
        <main style={{
          flex: 1,
          display: isMobile && !selectedChannel ? "none" : "flex",
          flexDirection: "column",
          background: colors.messageBg,
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          width: isMobile ? "100%" : undefined,
        }}>
          {/* Channel Header */}
          <header style={{
            padding: isMobile ? "10px 12px" : "12px 20px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: colors.surface,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Mobile back button */}
              {isMobile && (
                <button
                  onClick={() => setSelectedChannel(null)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "transparent",
                    border: "none",
                    color: colors.textSecondary,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "4px",
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              {selectedChannel?.type === "channel" ? (
                <Hash size={20} color={colors.textSecondary} />
              ) : (
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: selectedChannel?.avatar || "#666",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                }}>
                  {selectedChannel?.name.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
                  {selectedChannel?.name || "Select a conversation"}
                </h3>
                {selectedChannel?.memberCount && (
                  <span style={{ fontSize: "0.75rem", color: colors.textSecondary }}>
                    {selectedChannel.memberCount} members
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                title="View members"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: showMembersPanel ? colors.surfaceHover : "none",
                  border: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={18} />
              </button>
              <button
                onClick={() => setShowPinnedPanel(!showPinnedPanel)}
                title="Pinned messages"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: showPinnedPanel ? colors.surfaceHover : "none",
                  border: "none",
                  color: pinnedMessages.length > 0 ? colors.accent : colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pin size={18} />
              </button>
              <button
                onClick={() => setShowSearchPanel(!showSearchPanel)}
                title="Search in conversation"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: showSearchPanel ? colors.surfaceHover : "none",
                  border: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Search size={18} />
              </button>
              <button
                onClick={() => setShowNotificationSettings(true)}
                title="Notification settings"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: showNotificationSettings ? colors.surfaceHover : "none",
                  border: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={18} />
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: "auto", padding: isMobile ? "10px 12px" : "16px 20px", position: "relative" }}
          >
            {/* Loading more indicator */}
            {isLoadingMore && (
              <div style={{ textAlign: "center", padding: "12px", color: colors.textSecondary }}>
                Loading older messages...
              </div>
            )}

            {/* Load more button */}
            {hasMoreMessages && !isLoadingMore && (
              <div style={{ textAlign: "center", padding: "12px" }}>
                <button
                  onClick={loadMoreMessages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: colors.surfaceHover,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Load older messages
                </button>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", color: colors.textSecondary, padding: "40px" }}>
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", color: colors.textSecondary, padding: "40px" }}>
                <MessageCircle size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              groupedMessages.map((group, groupIdx) => (
                <div key={groupIdx} style={{ marginBottom: "16px" }}>
                  {/* Date separator */}
                  {groupIdx === 0 || formatDate(group.timestamp) !== formatDate(groupedMessages[groupIdx - 1].timestamp) ? (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      margin: "24px 0",
                    }}>
                      <div style={{ flex: 1, height: "1px", background: colors.border }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.textSecondary }}>
                        {formatDate(group.timestamp)}
                      </span>
                      <div style={{ flex: 1, height: "1px", background: colors.border }} />
                    </div>
                  ) : null}

                  {/* Message Group */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: group.senderAvatar,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                      onClick={() => alert(`Profile: ${group.senderName}`)}
                    >
                      {group.senderName.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{ fontWeight: 700, color: colors.text, fontSize: "0.9rem", cursor: "pointer" }}
                          onClick={() => alert(`Profile: ${group.senderName}`)}
                        >
                          {group.senderName}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                          {formatTime(group.timestamp)}
                        </span>
                      </div>

                      {group.messages.map((msg) => (
                        <div
                          key={msg.id}
                          id={`message-${msg.id}`}
                          onMouseEnter={() => setHoveredMessage(msg.id)}
                          onMouseLeave={() => setHoveredMessage(null)}
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                          style={{
                            position: "relative",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: hoveredMessage === msg.id ? colors.messageHover : "transparent",
                            margin: "0 -8px",
                          }}
                        >
                          {/* Pinned indicator */}
                          {msg.isPinned && (
                            <div style={{ fontSize: "0.7rem", color: colors.accentText, marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Pin size={12} /> Pinned
                            </div>
                          )}

                          {/* Editing mode */}
                          {editingMessage?.id === msg.id ? (
                            <div>
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") { setEditingMessage(null); setEditText(""); }
                                }}
                                autoFocus
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  borderRadius: "6px",
                                  border: `1px solid ${colors.accent}`,
                                  background: colors.surface,
                                  color: colors.text,
                                  outline: "none",
                                }}
                              />
                              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                <button onClick={saveEdit} style={{ padding: "4px 12px", borderRadius: "4px", background: colors.accent, color: "#000", border: "none", cursor: "pointer", fontWeight: 600 }}>
                                  Save
                                </button>
                                <button onClick={() => { setEditingMessage(null); setEditText(""); }} style={{ padding: "4px 12px", borderRadius: "4px", background: colors.surfaceHover, color: colors.text, border: "none", cursor: "pointer" }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content && (
                                <div style={{ margin: 0, color: msg.isDeleted ? colors.textMuted : colors.text, lineHeight: 1.5, fontSize: "0.9rem", wordBreak: "break-word", fontStyle: msg.isDeleted ? "italic" : "normal" }}>
                                  {msg.isDeleted ? msg.content : renderFormattedContent(msg.content)}
                                  {msg.isEdited && !msg.isDeleted && (
                                    <span style={{ fontSize: "0.7rem", color: colors.textMuted, marginLeft: "6px" }}>(edited)</span>
                                  )}
                                </div>
                              )}

                              {/* Link Previews */}
                              {msg.content && !msg.isDeleted && extractUrls(msg.content).slice(0, 2).map((url) => (
                                <LinkPreview key={url} url={url} colors={colors} />
                              ))}

                              {/* Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div style={{ marginTop: msg.content ? "8px" : 0, display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  {msg.attachments.map((attachment) => (
                                    attachment.type === "image" ? (
                                      <div
                                        key={attachment.id}
                                        style={{
                                          position: "relative",
                                          maxWidth: "300px",
                                          borderRadius: "8px",
                                          overflow: "hidden",
                                          border: `1px solid ${colors.border}`,
                                          cursor: "pointer",
                                        }}
                                        onClick={() => openImageGallery(attachment.url, msg.id)}
                                      >
                                        <img loading="lazy" decoding="async"
                                          src={attachment.url}
                                          alt={attachment.name}
                                          style={{
                                            maxWidth: "100%",
                                            maxHeight: "200px",
                                            display: "block",
                                            objectFit: "cover",
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <a
                                        key={attachment.id}
                                        href={attachment.url}
                                        download={attachment.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "10px",
                                          padding: "10px 14px",
                                          borderRadius: "8px",
                                          background: colors.surfaceHover,
                                          border: `1px solid ${colors.border}`,
                                          textDecoration: "none",
                                          color: colors.text,
                                          maxWidth: "300px",
                                        }}
                                      >
                                        <File size={24} color={colors.accent} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontWeight: 500, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {attachment.name}
                                          </div>
                                          <div style={{ fontSize: "0.75rem", color: colors.textSecondary }}>
                                            {formatFileSize(attachment.size)}
                                          </div>
                                        </div>
                                      </a>
                                    )
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* Reactions */}
                          {msg.reactions.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                              {msg.reactions.map((reaction, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, reaction.emoji); }}
                                  onDoubleClick={(e) => { e.stopPropagation(); openReactionsDetail(msg); }}
                                  title="Click to react, double-click to see who reacted"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    background: reaction.hasReacted ? colors.reactionActive : colors.reaction,
                                    border: reaction.hasReacted ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                    color: colors.text,
                                  }}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span style={{ fontSize: "0.75rem" }}>{reaction.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Hover actions */}
                          {hoveredMessage === msg.id && editingMessage?.id !== msg.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "-12px",
                                right: "8px",
                                display: "flex",
                                gap: "2px",
                                background: colors.surface,
                                backdropFilter: "blur(20px) saturate(180%)",
                                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                                border: `1px solid ${colors.border}`,
                                borderRadius: "12px",
                                padding: "4px",
                                boxShadow: colors.glassShadow,
                              }}
                            >
                              {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "4px",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <div style={{ width: "1px", background: colors.border, margin: "4px 2px" }} />
                              <button
                                onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                                title="Add reaction"
                                style={{ width: "28px", height: "28px", borderRadius: "4px", background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Smile size={16} />
                              </button>
                              <button
                                onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }}
                                title="Reply"
                                style={{ width: "28px", height: "28px", borderRadius: "4px", background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Reply size={16} />
                              </button>
                              <button
                                onClick={() => openThread(msg)}
                                title="Start thread"
                                style={{ width: "28px", height: "28px", borderRadius: "4px", background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <MessageSquare size={16} />
                              </button>
                              <button
                                onClick={() => setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id)}
                                title="More actions"
                                style={{ width: "28px", height: "28px", borderRadius: "4px", background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            </div>
                          )}

                          {/* Emoji picker */}
                          {showEmojiPicker === msg.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "30px",
                                right: "8px",
                                zIndex: 100,
                              }}
                            >
                              <EmojiPicker
                                onSelect={(emoji) => {
                                  toggleReaction(msg.id, emoji);
                                  setShowEmojiPicker(null);
                                }}
                                onClose={() => setShowEmojiPicker(null)}
                                colors={colors}
                              />
                            </div>
                          )}

                          {/* Message menu */}
                          {showMessageMenu === msg.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "30px",
                                right: "8px",
                                background: colors.surface,
                                backdropFilter: "blur(20px) saturate(180%)",
                                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                                border: `1px solid ${colors.border}`,
                                borderRadius: "16px",
                                padding: "6px",
                                boxShadow: colors.glassShadow,
                                zIndex: 100,
                                minWidth: "160px",
                              }}
                            >
                              {[
                                { icon: Reply, label: "Reply", action: () => { setReplyingTo(msg); inputRef.current?.focus(); setShowMessageMenu(null); } },
                                { icon: MessageSquare, label: "Thread", action: () => openThread(msg) },
                                { icon: Forward, label: "Forward", action: () => openForwardModal(msg) },
                                { icon: Pin, label: msg.isPinned ? "Unpin" : "Pin", action: () => togglePin(msg.id) },
                                { icon: Copy, label: "Copy text", action: () => copyMessage(msg.content) },
                                { icon: Link, label: "Copy link", action: () => copyMessageLink(msg.id) },
                                { icon: Bookmark, label: msg.isSaved ? "Saved" : "Save", action: () => saveMessage(msg) },
                                ...(msg.senderId === userId ? [
                                  { icon: Edit3, label: "Edit", action: () => startEdit(msg) },
                                  { icon: Trash2, label: "Delete", action: () => deleteMessage(msg.id), danger: true },
                                ] : [
                                  { icon: Flag, label: "Report", action: () => { alert("Message reported"); setShowMessageMenu(null); } },
                                ]),
                              ].map((item, i) => (
                                <button
                                  key={i}
                                  onClick={item.action}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    width: "100%",
                                    padding: "8px 12px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: "none",
                                    color: (item as any).danger ? colors.danger : colors.text,
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    textAlign: "left",
                                  }}
                                >
                                  <item.icon size={16} />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />

            {/* New Messages Jump Button */}
            {hasNewMessages && isScrolledUp && (
              <button
                onClick={jumpToLatest}
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  zIndex: 50,
                }}
              >
                <ChevronDown size={16} />
                {newMessageCount} new message{newMessageCount !== 1 ? "s" : ""}
              </button>
            )}

            {/* Scroll to bottom button (when scrolled up without new messages) */}
            {isScrolledUp && !hasNewMessages && (
              <button
                onClick={jumpToLatest}
                style={{
                  position: "absolute",
                  bottom: "20px",
                  right: "20px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: colors.surface,
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  zIndex: 50,
                }}
                title="Jump to latest"
              >
                <ChevronDown size={20} />
              </button>
            )}
          </div>

          {/* Reply indicator */}
          {replyingTo && (
            <div style={{
              padding: "8px 20px",
              background: colors.surfaceHover,
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ fontSize: "0.85rem", color: colors.textSecondary }}>
                <Reply size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                Replying to <strong style={{ color: colors.text }}>{replyingTo.senderName}</strong>
              </div>
              <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Pending Attachments Preview */}
          {pendingAttachments.length > 0 && (
            <div style={{
              padding: "12px 20px",
              borderTop: `1px solid ${colors.border}`,
              background: colors.surfaceHover,
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}>
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  style={{
                    position: "relative",
                    background: colors.surface,
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    overflow: "hidden",
                  }}
                >
                  {attachment.type === "image" ? (
                    <div style={{ position: "relative" }}>
                      <img loading="lazy" decoding="async"
                        src={attachment.url}
                        alt={attachment.name}
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.7)",
                          border: "none",
                          color: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      paddingRight: "32px",
                    }}>
                      <File size={20} color={colors.accent} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 500, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                          {attachment.name}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: colors.textSecondary }}>
                          {formatFileSize(attachment.size)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: colors.border,
                          border: "none",
                          color: colors.text,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {uploadingFile && (
                <div style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textSecondary,
                  fontSize: "0.75rem",
                }}>
                  Uploading...
                </div>
              )}
            </div>
          )}

          {/* Typing Indicators */}
          {typingUsers.length > 0 && (
            <div style={{
              padding: "8px 20px",
              background: colors.surface,
              borderTop: `1px solid ${colors.border}`,
            }}>
              <TypingIndicator
                users={typingUsers.map(u => ({ id: u.user_id, name: u.user_name }))}
                colors={colors}
              />
            </div>
          )}

          {/* Connection Status */}
          {!isConnected && (
            <div style={{
              padding: "6px 20px",
              background: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.75rem",
              color: colors.danger,
            }}>
              <WifiOff size={14} />
              <span>Reconnecting...</span>
            </div>
          )}

          {/* Message Composer */}
          <div style={{
            padding: isMobile ? "10px 12px" : "16px 20px",
            borderTop: pendingAttachments.length === 0 && typingUsers.length === 0 ? `1px solid ${colors.border}` : "none",
            background: colors.surface,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: colors.surfaceHover,
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              borderRadius: "16px",
              border: `1px solid ${colors.border}`,
              boxShadow: colors.glassShadow,
              padding: "10px 14px",
              position: "relative",
              transition: "all 0.2s ease",
            }}>
              {/* Attachment button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAttachmentMenu(!showAttachmentMenu); }}
                  title="Add attachment"
                  style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Plus size={20} />
                </button>
                {showAttachmentMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: "40px",
                      left: 0,
                      background: colors.surface,
                      backdropFilter: "blur(20px) saturate(180%)",
                      WebkitBackdropFilter: "blur(20px) saturate(180%)",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "16px",
                      padding: "6px",
                      boxShadow: colors.glassShadow,
                      zIndex: 100,
                      minWidth: "160px",
                    }}
                  >
                    {[
                      { icon: Image, label: "Upload image", action: () => { fileInputRef.current?.click(); setShowAttachmentMenu(false); } },
                      { icon: File, label: "Upload file", action: () => { fileInputRef.current?.click(); setShowAttachmentMenu(false); } },
                      { icon: Paperclip, label: "From clipboard", action: () => { alert("Paste from clipboard"); setShowAttachmentMenu(false); } },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={item.action}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          border: "none",
                          background: "none",
                          color: colors.text,
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          textAlign: "left",
                        }}
                      >
                        <item.icon size={16} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                onChange={handleFileSelect}
              />

              <input
                ref={inputRef}
                type="text"
                placeholder={`Message ${selectedChannel?.type === "channel" ? "#" : ""}${selectedChannel?.name || "..."}`}
                value={messageText}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                onPaste={handlePaste}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: colors.text, fontSize: "0.95rem" }}
              />

              {/* Emoji button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowComposerEmoji(!showComposerEmoji); }}
                  title="Add emoji"
                  style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Smile size={20} />
                </button>
                {showComposerEmoji && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: "40px",
                      right: 0,
                      zIndex: 100,
                    }}
                  >
                    <EmojiPicker
                      onSelect={(emoji) => {
                        insertEmoji(emoji);
                        setShowComposerEmoji(false);
                      }}
                      onClose={() => setShowComposerEmoji(false)}
                      colors={colors}
                    />
                  </div>
                )}
              </div>

              {/* Mention button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMentionPicker(!showMentionPicker); }}
                  title="Mention someone"
                  style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <AtSign size={20} />
                </button>
                {showMentionPicker && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: "40px",
                      right: 0,
                      background: colors.surface,
                      backdropFilter: "blur(20px) saturate(180%)",
                      WebkitBackdropFilter: "blur(20px) saturate(180%)",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "16px",
                      padding: "6px",
                      boxShadow: colors.glassShadow,
                      zIndex: 100,
                      minWidth: "200px",
                    }}
                  >
                    {Object.entries(SAMPLE_USERS).map(([id, user]) => (
                      <button
                        key={id}
                        onClick={() => insertMention(user.name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          border: "none",
                          background: "none",
                          color: colors.text,
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: user.avatar, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>
                          {user.name.charAt(0)}
                        </div>
                        {user.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send button */}
              {(messageText.trim() || pendingAttachments.length > 0) && (
                <button
                  onClick={sendMessage}
                  style={{
                    background: colors.accent,
                    border: "none",
                    borderRadius: "12px",
                    color: "#000",
                    cursor: "pointer",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)";
                  }}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Side Panels */}
        {showMembersPanel && (
          <aside style={{
            width: isMobile ? "100%" : "280px",
            position: isMobile ? "absolute" : undefined,
            top: isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            bottom: isMobile ? 0 : undefined,
            zIndex: isMobile ? 50 : undefined,
            background: colors.sidebar,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderLeft: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ padding: "16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1rem" }}>Members</h3>
              <button onClick={() => setShowMembersPanel(false)} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {Object.entries(SAMPLE_USERS).map(([id, user]) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", borderRadius: "6px", cursor: "pointer" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: user.avatar, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>
                    {user.name.charAt(0)}
                  </div>
                  <span style={{ color: colors.text, fontSize: "0.9rem" }}>{user.name}</span>
                  {user.isBot && <span style={{ fontSize: "0.7rem", color: colors.accentText, background: `${colors.accent}22`, padding: "2px 6px", borderRadius: "4px" }}>Bot</span>}
                </div>
              ))}
            </div>
          </aside>
        )}

        {showPinnedPanel && selectedChannel && (
          <PinnedMessagesPanel
            conversationId={selectedChannel.id}
            userId={userId}
            onClose={() => setShowPinnedPanel(false)}
            onNavigateToMessage={navigateToPinnedMessage}
            colors={{
              surface: colors.surface,
              surfaceHover: colors.surfaceHover,
              border: colors.border,
              text: colors.text,
              textSecondary: colors.textSecondary,
              textMuted: colors.textMuted,
              accent: colors.accent,
              danger: colors.danger,
            }}
          />
        )}

        {/* Enhanced Search Panel */}
        {showSearchPanel && (
          <SearchPanel
            userId={userId}
            conversationId={selectedChannel?.id}
            onClose={() => setShowSearchPanel(false)}
            onResultClick={handleSearchResultClick}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* Thread Panel */}
        {showThreadPanel && threadParentMessage && selectedChannel && (
          <ThreadPanel
            parentMessage={threadParentMessage}
            conversationId={selectedChannel.id}
            userId={userId}
            onClose={() => {
              setShowThreadPanel(false);
              setThreadParentMessage(null);
            }}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* Saved Items Panel */}
        {showSavedPanel && (
          <SavedItemsPanel
            userId={userId}
            onClose={() => setShowSavedPanel(false)}
            onNavigateToMessage={(convId, msgId) => {
              // Find and select the conversation
              const conv = channels.find(c => c.id === convId);
              if (conv) {
                setSelectedChannel(conv);
              }
              setShowSavedPanel(false);
              // Scroll to message after loading
              setTimeout(() => {
                const msgElement = document.getElementById(`message-${msgId}`);
                if (msgElement) {
                  msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
                  msgElement.classList.add("search-highlight");
                  setTimeout(() => msgElement.classList.remove("search-highlight"), 2000);
                }
              }, 500);
            }}
            colors={colors}
          />
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setShowNewMessageModal(false)}
        >
          <div
            style={{
              background: colors.surface,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "24px",
              boxShadow: colors.glassShadow,
              width: "100%",
              maxWidth: "500px",
              maxHeight: "70vh",
              overflow: "hidden",
              transform: "translateY(0)",
              transition: "transform 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${colors.border}` }}>
              <h3 style={{ margin: 0, color: colors.text }}>New Message</h3>
              <button onClick={() => setShowNewMessageModal(false)} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "16px", maxHeight: "400px", overflowY: "auto" }}>
              {Object.entries(SAMPLE_USERS).map(([id, user]) => (
                <button
                  key={id}
                  onClick={async () => {
                    const resp = await sbFetch(`${MESSAGING_API_URL}/conversations/group?user_id=${encodeURIComponent(userId)}`, {
                      method: "POST",
                      body: JSON.stringify({ participant_ids: [userId, id], name: user.name }),
                    });
                    if (resp.ok) {
                      const conv = await resp.json();
                      setShowNewMessageModal(false);
                      await loadChannels();
                      setSelectedChannel({ id: conv.id, type: "dm", name: user.name, avatar: user.avatar, isBot: user.isBot, unreadCount: 0, hasMention: false });
                    }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: user.avatar, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: colors.text }}>{user.name}</div>
                    {user.isBot && <span style={{ fontSize: "0.75rem", color: colors.accentText }}>AI Assistant</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setShowCreateChannelModal(false)}
        >
          <div
            style={{
              background: colors.surface,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${colors.border}`,
              borderRadius: "24px",
              boxShadow: colors.glassShadow,
              width: "100%",
              maxWidth: "450px",
              overflow: "hidden",
              transform: "translateY(0)",
              transition: "transform 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${colors.border}` }}>
              <h3 style={{ margin: 0, color: colors.text }}>Create Channel</h3>
              <button onClick={() => setShowCreateChannelModal(false)} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>
                  Channel name
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Hash size={18} color={colors.textMuted} />
                  <input
                    type="text"
                    placeholder="e.g. general, announcements"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: colors.surfaceHover,
                      color: colors.text,
                      outline: "none",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 600, color: colors.text }}>
                  Description <span style={{ fontWeight: 400, color: colors.textSecondary }}>(optional)</span>
                </label>
                <textarea
                  placeholder="What's this channel about?"
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: colors.surfaceHover,
                    color: colors.text,
                    outline: "none",
                    fontSize: "0.95rem",
                    resize: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => setShowCreateChannelModal(false)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    background: "none",
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  disabled={!newChannelName.trim()}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "6px",
                    border: "none",
                    background: newChannelName.trim() ? colors.accent : colors.border,
                    color: newChannelName.trim() ? "#000" : colors.textMuted,
                    cursor: newChannelName.trim() ? "pointer" : "not-allowed",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && contextMenuMessage && (
        <MessageContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          messageId={contextMenuMessage.id}
          isOwnMessage={contextMenuMessage.senderId === userId}
          isPinned={contextMenuMessage.isPinned || false}
          isSaved={contextMenuMessage.isSaved || false}
          onClose={() => setShowContextMenu(false)}
          onAction={(action, msgId) => handleContextMenuAction(action, contextMenuMessage)}
          colors={{
            surface: colors.surface,
            surfaceHover: colors.surfaceHover,
            border: colors.border,
            text: colors.text,
            textSecondary: colors.textSecondary,
            accent: colors.accent,
            danger: colors.danger,
          }}
        />
      )}

      {/* Image Gallery Modal */}
      {showImageGallery && galleryImages.length > 0 && (
        <ImageGalleryModal
          images={galleryImages}
          initialIndex={galleryStartIndex}
          onClose={() => setShowImageGallery(false)}
          colors={{
            surface: colors.surface,
            surfaceHover: colors.surfaceHover,
            border: colors.border,
            text: colors.text,
            textSecondary: colors.textSecondary,
            textMuted: colors.textMuted,
            accent: colors.accent,
          }}
        />
      )}

      {/* Forward Message Modal */}
      {showForwardModal && messageToForward && (
        <ForwardMessageModal
          message={{
            id: messageToForward.id,
            content: messageToForward.content,
            senderName: messageToForward.senderName,
            createdAt: messageToForward.createdAt,
            attachments: messageToForward.attachments,
          }}
          conversations={channels.map(ch => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            avatar: ch.avatar,
            lastMessageAt: ch.lastMessageAt,
          }))}
          onClose={() => {
            setShowForwardModal(false);
            setMessageToForward(null);
          }}
          onForward={handleForwardMessage}
          colors={colors}
        />
      )}

      {/* Reactions Detail Modal */}
      {showReactionsDetail && reactionsDetailMessage && selectedChannel && (
        <ReactionsDetailModal
          messageId={reactionsDetailMessage.id}
          reactions={reactionsDetailMessage.reactions.map(r => ({
            emoji: r.emoji,
            count: r.count,
            users: [], // Would be populated from API
          }))}
          onClose={() => {
            setShowReactionsDetail(false);
            setReactionsDetailMessage(null);
          }}
          onRemoveReaction={(emoji) => toggleReaction(reactionsDetailMessage.id, emoji)}
          currentUserId={userId}
          colors={{
            surface: colors.surface,
            surfaceHover: colors.surfaceHover,
            border: colors.border,
            text: colors.text,
            textSecondary: colors.textSecondary,
            textMuted: colors.textMuted,
            accent: colors.accent,
          }}
        />
      )}

      {/* Group DM Creation Modal */}
      {showGroupDMModal && (
        <GroupDMCreationModal
          currentUserId={userId}
          availableUsers={availableUsers}
          onClose={() => setShowGroupDMModal(false)}
          onCreate={(participantIds, name) => {
            handleCreateGroupDM(participantIds, name);
            setShowGroupDMModal(false);
          }}
          colors={{
            surface: colors.surface,
            surfaceHover: colors.surfaceHover,
            border: colors.border,
            text: colors.text,
            textSecondary: colors.textSecondary,
            textMuted: colors.textMuted,
            accent: colors.accent,
            success: colors.success,
          }}
        />
      )}

      {/* Notification Settings Panel */}
      {showNotificationSettings && selectedChannel && (
        <NotificationSettingsPanel
          conversationId={selectedChannel.id}
          conversationName={selectedChannel.name}
          onClose={() => setShowNotificationSettings(false)}
          colors={colors}
          userId={userId}
        />
      )}

      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <div
          style={{
            position: "fixed",
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={() => setShowVoiceRecorder(false)}
            colors={colors}
          />
        </div>
      )}
      {/* Channel Browser Modal */}
      {showChannelBrowser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowChannelBrowser(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "480px",
              maxHeight: "600px",
              background: colors.surface,
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderRadius: "16px",
              border: `1px solid ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: colors.text }}>
                Browse Channels
              </h3>
              <button
                onClick={() => setShowChannelBrowser(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textSecondary,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.border}` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: colors.surfaceHover,
                  borderRadius: "8px",
                }}
              >
                <Search size={16} color={colors.textMuted} />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={channelBrowseSearch}
                  onChange={(e) => setChannelBrowseSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: colors.text,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Filter Tabs */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                {(["all", "public", "private", "group"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setChannelBrowseFilter(filter)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      border: channelBrowseFilter === filter ? "none" : `1px solid ${colors.border}`,
                      background: channelBrowseFilter === filter ? colors.accent : "transparent",
                      color: channelBrowseFilter === filter ? "#000" : colors.textSecondary,
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {(() => {
                const filtered = allBrowseChannels
                  .filter((c) => {
                    if (channelBrowseFilter === "public") return c.type === "channel";
                    if (channelBrowseFilter === "private") return c.type === "dm";
                    if (channelBrowseFilter === "group") return c.type === "group_dm";
                    return true;
                  })
                  .filter((c) =>
                    channelBrowseSearch
                      ? c.name.toLowerCase().includes(channelBrowseSearch.toLowerCase())
                      : true
                  );

                if (filtered.length === 0) {
                  return (
                    <div
                      style={{
                        padding: "40px 20px",
                        textAlign: "center",
                        color: colors.textMuted,
                        fontSize: "0.9rem",
                      }}
                    >
                      {allBrowseChannels.length === 0
                        ? "Loading channels..."
                        : "No channels match your filter."}
                    </div>
                  );
                }

                return filtered.map((channel) => {
                  const isJoined = channels.some((c) => c.id === channel.id);
                  return (
                    <button
                      key={`browse-${channel.id}`}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setShowChannelBrowser(false);
                        // If the channel isn't in the sidebar yet, add it
                        if (!isJoined) {
                          setChannels((prev) => [...prev, channel]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "transparent",
                        color: colors.text,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {channel.type === "channel" ? (
                        <Hash size={18} color={colors.textMuted} />
                      ) : channel.type === "group_dm" ? (
                        <Users size={18} color={colors.textMuted} />
                      ) : (
                        <MessageCircle size={18} color={colors.textMuted} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {channel.name}
                        </div>
                        {channel.lastMessage && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: colors.textMuted,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {channel.lastMessage}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {channel.memberCount !== undefined && (
                          <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                            {channel.memberCount} members
                          </span>
                        )}
                        {isJoined && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: colors.accent,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: `${colors.accent}22`,
                            }}
                          >
                            Joined
                          </span>
                        )}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </UnifiedLayout>
  );
}
