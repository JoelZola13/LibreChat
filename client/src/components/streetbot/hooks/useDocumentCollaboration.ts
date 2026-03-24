"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { from: number; to: number } | null;
}

export interface UseDocumentCollaborationOptions {
  documentId: string;
  userId: string;
  userName: string;
  userColor?: string;
  onMessage?: (message: any) => void;
}

export interface UseDocumentCollaborationReturn {
  isConnected: boolean;
  collaborators: Collaborator[];
  sendUpdate: (data: Uint8Array) => void;
  sendAwareness: (state: any) => void;
  reconnect: () => void;
}

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useDocumentCollaboration({
  documentId,
  userId,
  userName,
  userColor = "#6366f1",
  onMessage,
}: UseDocumentCollaborationOptions): UseDocumentCollaborationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const wsHost = backendHost.replace("http://", "ws://").replace("https://", "wss://");

    const params = new URLSearchParams({
      user_id: userId,
      user_name: userName,
      user_color: userColor,
    });

    return `${wsHost}/api/documents/${documentId}/collab?${params.toString()}`;
  }, [documentId, userId, userName, userColor]);

  const connect = useCallback(function connectFn() {
    if (typeof window === "undefined") return;

    const url = getWebSocketUrl();
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[Collab] Connected to document:", documentId);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onclose = () => {
      console.log("[Collab] Disconnected from document:", documentId);
      setIsConnected(false);

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`[Collab] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(connectFn, RECONNECT_DELAY);
      }
    };

    ws.onerror = (error) => {
      console.error("[Collab] WebSocket error:", error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "awareness") {
          // Update collaborators list
          const users = Object.values(message.users || {}) as Collaborator[];
          setCollaborators(users.filter((u) => u.id !== userId));
        } else if (message.type === "sync" || message.type === "update") {
          // Forward to Yjs handler
          onMessage?.(message);
        } else if (message.type === "pong") {
          // Keep-alive response
        }
      } catch (e) {
        console.error("[Collab] Failed to parse message:", e);
      }
    };

    wsRef.current = ws;
  }, [documentId, userId, getWebSocketUrl, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendUpdate = useCallback((data: Uint8Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "update",
        data: Array.from(data),
      }));
    }
  }, []);

  const sendAwareness = useCallback((state: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "awareness",
        state,
      }));
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Keep-alive ping
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    isConnected,
    collaborators,
    sendUpdate,
    sendAwareness,
    reconnect,
  };
}

export default useDocumentCollaboration;
