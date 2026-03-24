/**
 * WebSocket hook for real-time messaging features.
 *
 * Provides:
 * - Auto-connect/reconnect WebSocket
 * - Conversation subscriptions
 * - Typing indicators
 * - Presence tracking
 * - Real-time message/reaction/thread updates
 */
import { useEffect, useRef, useCallback, useState } from "react";

// WebSocket connects through the same host/port as the page, via /sbapi proxy
const getWebSocketBase = () => {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/sbapi`;
  }
  return "ws://localhost:8002";
};

const WS_BASE = getWebSocketBase();

export type MessageEvent = {
  type: "message.created" | "message.updated" | "message.deleted" | "reaction.updated" | "reaction.added" | "reaction.removed" | "thread.updated" | "message.pinned" | "message.unpinned";
  conversation_id: number | string;
  message_id?: number | string;
  parent_message_id?: number | string;
  data: any;
  timestamp: string;
};

export type TypingEvent = {
  type: "typing.update";
  conversation_id: number | string;
  user_id: string;
  user_name: string;
  is_typing: boolean;
  timestamp: string;
};

export type PresenceEvent = {
  type: "presence.update";
  user_id: string;
  status: "online" | "offline" | "away";
  timestamp: string;
};

export type WebSocketEvent = MessageEvent | TypingEvent | PresenceEvent | { type: string; [key: string]: any };

interface UseMessagingWebSocketOptions {
  userId: string;
  onMessage?: (event: MessageEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (event: PresenceEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useMessagingWebSocket({
  userId,
  onMessage,
  onTyping,
  onPresence,
  onConnect,
  onDisconnect,
  autoReconnect = true,
  reconnectInterval = 3000,
}: UseMessagingWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(reconnectInterval);
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedConversations, setSubscribedConversations] = useState<Set<number | string>>(new Set());

  // Ping interval to keep connection alive
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(function connectFn() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `${WS_BASE}/api/messaging/ws/${encodeURIComponent(userId)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected");
        setIsConnected(true);
        reconnectDelayRef.current = reconnectInterval;
        onConnect?.();

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));
          }
        }, 30000);

        // Resubscribe to conversations
        subscribedConversations.forEach((convId) => {
          ws.send(JSON.stringify({ action: "subscribe", conversation_id: convId }));
        });
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected");
        setIsConnected(false);
        onDisconnect?.();

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Auto reconnect with exponential backoff (max 60s)
        if (autoReconnect) {
          const delay = reconnectDelayRef.current;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[WS] Attempting reconnect (next delay: ${Math.min(delay * 2, 60000)}ms)...`);
            connectFn();
          }, delay);
          reconnectDelayRef.current = Math.min(delay * 2, 60000);
        }
      };

      ws.onerror = () => {
        // WebSocket errors are intentionally vague for security reasons
        // The onclose handler will fire after this with more context
        console.warn("[WS] Connection error (will attempt reconnect)");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketEvent;

          switch (data.type) {
            case "message.created":
            case "message.updated":
            case "message.deleted":
            case "reaction.updated":
            case "reaction.added":
            case "reaction.removed":
            case "thread.updated":
            case "message.pinned":
            case "message.unpinned":
              onMessage?.(data as MessageEvent);
              break;

            case "typing.update":
              onTyping?.(data as TypingEvent);
              break;

            case "presence.update":
              onPresence?.(data as PresenceEvent);
              break;

            case "pong":
              // Connection is alive
              break;

            case "subscribed":
              console.log(`[WS] Subscribed to conversation ${data.conversation_id}`);
              break;

            default:
              console.log("[WS] Unknown event:", data);
          }
        } catch (e) {
          console.error("[WS] Failed to parse message:", e);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("[WS] Failed to connect:", e);
    }
  }, [userId, onMessage, onTyping, onPresence, onConnect, onDisconnect, autoReconnect, reconnectInterval, subscribedConversations]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((conversationId: number | string) => {
    setSubscribedConversations((prev) => new Set([...prev, conversationId]));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "subscribe",
        conversation_id: conversationId,
      }));
    }
  }, []);

  const unsubscribe = useCallback((conversationId: number | string) => {
    setSubscribedConversations((prev) => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "unsubscribe",
        conversation_id: conversationId,
      }));
    }
  }, []);

  const sendTyping = useCallback((conversationId: number | string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "typing",
        conversation_id: conversationId,
        is_typing: isTyping,
      }));
    }
  }, []);

  const getPresence = useCallback((userIds: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "get_presence",
        user_ids: userIds,
      }));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    sendTyping,
    getPresence,
    disconnect,
    reconnect: connect,
  };
}

export default useMessagingWebSocket;
