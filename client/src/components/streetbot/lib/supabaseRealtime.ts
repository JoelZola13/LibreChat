/**
 * Supabase Realtime utilities for live messaging.
 *
 * This module provides hooks and utilities for:
 * - Subscribing to new messages in real-time
 * - Presence tracking (online status)
 * - Typing indicators
 *
 * Uses lazy loading to avoid HMR issues with Turbopack.
 */

import { getSupabaseAsync, isSupabaseConfigured, SupabaseClient } from "./supabase";

// Local type definitions to avoid importing from @supabase/supabase-js
type RealtimeChannel = {
  on: (type: string, filter: any, callback: (payload: any) => void) => RealtimeChannel;
  subscribe: (callback?: (status: string) => void) => RealtimeChannel;
  track: (payload: any) => Promise<void>;
  send: (payload: any) => void;
  presenceState: <T>() => Record<string, T[]>;
};

type RealtimePostgresChangesPayload<T> = {
  new: T;
  old: T;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  message_type: string;
  attachments: any[];
  is_edited: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type TypingUser = {
  userId: string;
  userName: string;
  timestamp: number;
};

export type PresenceState = {
  [userId: string]: {
    online_at: string;
    user_name?: string;
  }[];
};

// Module-level cache for the client
let cachedClient: SupabaseClient | null = null;

async function getClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  cachedClient = await getSupabaseAsync();
  return cachedClient;
}

/**
 * Subscribe to new messages in a conversation.
 *
 * @param conversationId - The ID of the conversation to subscribe to
 * @param onNewMessage - Callback when a new message arrives
 * @param onMessageUpdate - Callback when a message is updated (edited/pinned)
 * @param onMessageDelete - Callback when a message is deleted
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToConversation(
  conversationId: number,
  onNewMessage: (message: Message) => void,
  onMessageUpdate?: (message: Message) => void,
  onMessageDelete?: (messageId: number) => void
): () => void {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured - realtime disabled");
    return () => {};
  }

  let channel: RealtimeChannel | null = null;
  let client: SupabaseClient | null = null;

  // Async initialization
  getClient().then((supabase) => {
    if (!supabase) {
      console.warn("Supabase client not initialized - realtime disabled");
      return;
    }
    client = supabase;

    channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          if (payload.new && "id" in payload.new) {
            onNewMessage(payload.new as Message);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          if (payload.new && "id" in payload.new) {
            const message = payload.new as Message;
            if (message.deleted_at && onMessageDelete) {
              onMessageDelete(message.id);
            } else if (onMessageUpdate) {
              onMessageUpdate(message);
            }
          }
        }
      )
      .subscribe();
  });

  return () => {
    if (channel && client) {
      client.removeChannel(channel);
    }
  };
}

/**
 * Subscribe to presence (online status) for a conversation.
 *
 * @param conversationId - The ID of the conversation
 * @param userId - The current user's ID
 * @param userName - The current user's display name
 * @param onPresenceChange - Callback when presence state changes
 * @returns Object with track function and cleanup
 */
export function subscribeToPresence(
  conversationId: number,
  userId: string,
  userName: string,
  onPresenceChange: (onlineUsers: string[]) => void
): { track: () => void; unsubscribe: () => void } {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured - presence disabled");
    return { track: () => {}, unsubscribe: () => {} };
  }

  let channel: RealtimeChannel | null = null;
  let client: SupabaseClient | null = null;

  getClient().then((supabase) => {
    if (!supabase) {
      console.warn("Supabase client not initialized - presence disabled");
      return;
    }
    client = supabase;

    channel = supabase.channel(`presence:${conversationId}`, {
      config: {
        presence: { key: userId },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel!.presenceState<{ user_name: string }>();
        const onlineUsers = Object.keys(state);
        onPresenceChange(onlineUsers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel!.track({
            online_at: new Date().toISOString(),
            user_name: userName,
          });
        }
      });
  });

  return {
    track: async () => {
      if (channel) {
        await channel.track({
          online_at: new Date().toISOString(),
          user_name: userName,
        });
      }
    },
    unsubscribe: () => {
      if (channel && client) {
        client.removeChannel(channel);
      }
    },
  };
}

/**
 * Create a typing indicator channel for a conversation.
 *
 * @param conversationId - The ID of the conversation
 * @param userId - The current user's ID
 * @param userName - The current user's display name
 * @param onTypingChange - Callback when typing state changes
 * @returns Object with sendTyping function and cleanup
 */
export function createTypingIndicator(
  conversationId: number,
  userId: string,
  userName: string,
  onTypingChange: (typingUsers: TypingUser[]) => void
): { sendTyping: () => void; unsubscribe: () => void } {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured - typing indicator disabled");
    return { sendTyping: () => {}, unsubscribe: () => {} };
  }

  const typingUsers = new Map<string, TypingUser>();
  let typingTimeout: NodeJS.Timeout | null = null;
  let channel: RealtimeChannel | null = null;
  let client: SupabaseClient | null = null;

  getClient().then((supabase) => {
    if (!supabase) {
      console.warn("Supabase client not initialized - typing indicator disabled");
      return;
    }
    client = supabase;

    channel = supabase.channel(`typing:${conversationId}`);

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId: typingUserId, userName: typingUserName } = payload.payload;

        // Don't show our own typing indicator
        if (typingUserId === userId) return;

        typingUsers.set(typingUserId, {
          userId: typingUserId,
          userName: typingUserName,
          timestamp: Date.now(),
        });

        onTypingChange(Array.from(typingUsers.values()));

        // Remove typing indicator after 3 seconds of inactivity
        setTimeout(() => {
          const user = typingUsers.get(typingUserId);
          if (user && Date.now() - user.timestamp >= 3000) {
            typingUsers.delete(typingUserId);
            onTypingChange(Array.from(typingUsers.values()));
          }
        }, 3500);
      })
      .subscribe();
  });

  const sendTyping = () => {
    // Throttle typing events to once per second
    if (typingTimeout) return;

    if (channel) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, userName },
      });
    }

    typingTimeout = setTimeout(() => {
      typingTimeout = null;
    }, 1000);
  };

  return {
    sendTyping,
    unsubscribe: () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      if (channel && client) {
        client.removeChannel(channel);
      }
    },
  };
}

/**
 * Hook-like function to manage all realtime subscriptions for a conversation.
 * Call this when a conversation is selected and cleanup when it changes.
 */
export function createConversationSubscriptions(
  conversationId: number,
  userId: string,
  userName: string,
  callbacks: {
    onNewMessage: (message: Message) => void;
    onMessageUpdate?: (message: Message) => void;
    onMessageDelete?: (messageId: number) => void;
    onPresenceChange?: (onlineUsers: string[]) => void;
    onTypingChange?: (typingUsers: TypingUser[]) => void;
  }
): {
  sendTyping: () => void;
  unsubscribe: () => void;
} {
  // Subscribe to messages
  const unsubscribeMessages = subscribeToConversation(
    conversationId,
    callbacks.onNewMessage,
    callbacks.onMessageUpdate,
    callbacks.onMessageDelete
  );

  // Subscribe to presence (if callback provided)
  let presenceSub: ReturnType<typeof subscribeToPresence> | null = null;
  if (callbacks.onPresenceChange) {
    presenceSub = subscribeToPresence(
      conversationId,
      userId,
      userName,
      callbacks.onPresenceChange
    );
  }

  // Subscribe to typing (if callback provided)
  let typingSub: ReturnType<typeof createTypingIndicator> | null = null;
  if (callbacks.onTypingChange) {
    typingSub = createTypingIndicator(
      conversationId,
      userId,
      userName,
      callbacks.onTypingChange
    );
  }

  return {
    sendTyping: typingSub?.sendTyping || (() => {}),
    unsubscribe: () => {
      unsubscribeMessages();
      presenceSub?.unsubscribe();
      typingSub?.unsubscribe();
    },
  };
}

/**
 * Check if Supabase Realtime is available.
 */
export function isRealtimeAvailable(): boolean {
  return isSupabaseConfigured();
}

// Legacy export for backwards compatibility (always null, use getSupabaseAsync instead)
export const supabase = null as SupabaseClient | null;
