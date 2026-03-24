"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Task } from "@/lib/api/tasks";

interface RealtimeEvent {
  type:
    | "task_created"
    | "task_updated"
    | "task_deleted"
    | "task_moved"
    | "comment_added"
    | "status_changed"
    | "assignee_changed";
  taskId: string;
  projectId?: string;
  data?: Partial<Task>;
  userId?: string;
  timestamp: string;
}

interface UseTasksRealtimeConfig {
  projectId?: string;
  userId?: string;
  onTaskCreated?: (task: Partial<Task>) => void;
  onTaskUpdated?: (taskId: string, changes: Partial<Task>) => void;
  onTaskDeleted?: (taskId: string) => void;
  onTaskMoved?: (taskId: string, newProjectId: string) => void;
  onCommentAdded?: (taskId: string, commentCount: number) => void;
  enabled?: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/tasks";

export function useTasksRealtime(config: UseTasksRealtimeConfig) {
  const {
    projectId,
    userId,
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onTaskMoved,
    onCommentAdded,
    enabled = true,
  } = config;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data);

        // Only process events for the current project
        if (projectId && data.projectId && data.projectId !== projectId) {
          return;
        }

        // Don't process events from the same user (they already have local state)
        if (userId && data.userId === userId) {
          return;
        }

        switch (data.type) {
          case "task_created":
            if (onTaskCreated && data.data) {
              onTaskCreated(data.data);
            }
            break;

          case "task_updated":
          case "status_changed":
          case "assignee_changed":
            if (onTaskUpdated && data.data) {
              onTaskUpdated(data.taskId, data.data);
            }
            break;

          case "task_deleted":
            if (onTaskDeleted) {
              onTaskDeleted(data.taskId);
            }
            break;

          case "task_moved":
            if (onTaskMoved && data.data?.projectId) {
              onTaskMoved(data.taskId, data.data.projectId);
            }
            break;

          case "comment_added":
            if (onCommentAdded && data.data?.commentCount !== undefined) {
              onCommentAdded(data.taskId, data.data.commentCount);
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    },
    [projectId, userId, onTaskCreated, onTaskUpdated, onTaskDeleted, onTaskMoved, onCommentAdded]
  );

  // Use a ref to store the connect function for self-referencing in reconnect
  const connectRef = useRef<(() => void) | undefined>(undefined);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const params = new URLSearchParams();
      if (projectId) params.append("project_id", projectId);
      if (userId) params.append("user_id", userId);

      const wsUrl = `${WS_URL}?${params}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Tasks WebSocket connected");
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("Tasks WebSocket error:", error);
        setConnectionError("Connection error");
      };

      ws.onclose = (event) => {
        console.log("Tasks WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connectRef.current?.();
          }, 5000);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to connect to WebSocket:", err);
      setConnectionError("Failed to connect");
    }
  }, [enabled, projectId, userId, handleMessage]);

  // Keep connectRef in sync with connect using useEffect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Send event to server
  const sendEvent = useCallback(
    (event: Omit<RealtimeEvent, "timestamp">) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            ...event,
            timestamp: new Date().toISOString(),
            userId,
            projectId,
          })
        );
      }
    },
    [userId, projectId]
  );

  // Broadcast task created
  const broadcastTaskCreated = useCallback(
    (task: Partial<Task>) => {
      sendEvent({
        type: "task_created",
        taskId: task.id || "",
        data: task,
      });
    },
    [sendEvent]
  );

  // Broadcast task updated
  const broadcastTaskUpdated = useCallback(
    (taskId: string, changes: Partial<Task>) => {
      sendEvent({
        type: "task_updated",
        taskId,
        data: changes,
      });
    },
    [sendEvent]
  );

  // Broadcast task deleted
  const broadcastTaskDeleted = useCallback(
    (taskId: string) => {
      sendEvent({
        type: "task_deleted",
        taskId,
      });
    },
    [sendEvent]
  );

  // Broadcast comment added
  const broadcastCommentAdded = useCallback(
    (taskId: string, commentCount: number) => {
      sendEvent({
        type: "comment_added",
        taskId,
        data: { commentCount } as Partial<Task>,
      });
    },
    [sendEvent]
  );

  // Connect on mount, disconnect on unmount
  // eslint-disable-next-line react-hooks/set-state-in-effect -- WebSocket connection management
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Reconnect when project changes
  // eslint-disable-next-line react-hooks/set-state-in-effect -- WebSocket reconnection
  useEffect(() => {
    if (enabled && isConnected) {
      disconnect();
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return {
    isConnected,
    connectionError,
    broadcastTaskCreated,
    broadcastTaskUpdated,
    broadcastTaskDeleted,
    broadcastCommentAdded,
    disconnect,
    reconnect: connect,
  };
}

// Simplified polling-based realtime for environments without WebSocket support
export function useTasksPolling(config: {
  projectId?: string;
  userId?: string;
  onUpdate?: () => void;
  pollInterval?: number;
  enabled?: boolean;
}) {
  const { projectId, userId, onUpdate, pollInterval = 30000, enabled = true } = config;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    if (!enabled || !projectId) return;

    const poll = async () => {
      try {
        const response = await fetch(
          `/sbapi/api/projects/${projectId}/tasks/updates?since=${lastUpdateRef.current}&user_id=${userId}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.hasUpdates) {
            lastUpdateRef.current = new Date().toISOString();
            onUpdate?.();
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    intervalRef.current = setInterval(poll, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, projectId, userId, pollInterval, onUpdate]);

  return {
    forceRefresh: () => {
      lastUpdateRef.current = new Date(0).toISOString();
    },
  };
}
