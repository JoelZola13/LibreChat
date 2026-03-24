/**
 * Swipe Actions Component
 * Touch-based swipe gestures for message and conversation actions on mobile.
 */

"use client";

import React, { useRef, useState, useCallback, ReactNode } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Archive, Bell, BellOff, Pin, Trash2, Reply, Forward, Star } from "lucide-react";

export interface SwipeAction {
  id: string;
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onAction: () => void;
}

export interface SwipeActionsProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  swipeThreshold?: number;
  maxSwipe?: number;
  disabled?: boolean;
  className?: string;
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  swipeThreshold = 80,
  maxSwipe = 160,
  disabled = false,
  className = "",
}: SwipeActionsProps) {
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [0, swipeThreshold], [0, 1]);
  const rightOpacity = useTransform(x, [-swipeThreshold, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled) return;
      const currentX = x.get();
      if (currentX > swipeThreshold && leftActions.length > 0) leftActions[0].onAction();
      else if (currentX < -swipeThreshold && rightActions.length > 0) rightActions[0].onAction();
      x.set(0);
    },
    [disabled, leftActions, rightActions, swipeThreshold, x]
  );

  const renderActions = (actions: SwipeAction[], side: "left" | "right") => (
    <motion.div
      className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} flex items-center gap-2 px-4`}
      style={{ opacity: side === "left" ? leftOpacity : rightOpacity }}
    >
      {actions.map((action) => (
        <button key={action.id} onClick={action.onAction} className={`flex flex-col items-center p-3 rounded-lg ${action.bgColor}`}>
          <span className={action.color}>{action.icon}</span>
          <span className={`text-xs mt-1 ${action.color}`}>{action.label}</span>
        </button>
      ))}
    </motion.div>
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {renderActions(leftActions, "left")}
      {renderActions(rightActions, "right")}
      <motion.div drag={disabled ? false : "x"} dragConstraints={{ left: -maxSwipe, right: maxSwipe }} dragElastic={0.1} onDragEnd={handleDragEnd} style={{ x }} className="relative z-10 bg-gray-900">
        {children}
      </motion.div>
    </div>
  );
}

export function useConversationSwipeActions(options: { onArchive: () => void; onMute: () => void; onPin: () => void; onDelete: () => void; isMuted?: boolean; isPinned?: boolean }) {
  return {
    leftActions: [
      { id: "archive", icon: <Archive className="w-5 h-5" />, label: "Archive", color: "text-blue-400", bgColor: "bg-blue-600/20", onAction: options.onArchive },
      { id: "mute", icon: options.isMuted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />, label: options.isMuted ? "Unmute" : "Mute", color: "text-yellow-400", bgColor: "bg-yellow-600/20", onAction: options.onMute },
    ],
    rightActions: [
      { id: "pin", icon: <Pin className="w-5 h-5" />, label: options.isPinned ? "Unpin" : "Pin", color: "text-purple-400", bgColor: "bg-purple-600/20", onAction: options.onPin },
      { id: "delete", icon: <Trash2 className="w-5 h-5" />, label: "Delete", color: "text-red-400", bgColor: "bg-red-600/20", onAction: options.onDelete },
    ],
  };
}

export function useMessageSwipeActions(options: { onReply: () => void; onForward: () => void; onSave: () => void; onDelete: () => void; isSaved?: boolean }) {
  return {
    leftActions: [{ id: "reply", icon: <Reply className="w-5 h-5" />, label: "Reply", color: "text-blue-400", bgColor: "bg-blue-600/20", onAction: options.onReply }],
    rightActions: [
      { id: "forward", icon: <Forward className="w-5 h-5" />, label: "Forward", color: "text-purple-400", bgColor: "bg-purple-600/20", onAction: options.onForward },
      { id: "save", icon: <Star className="w-5 h-5" fill={options.isSaved ? "currentColor" : "none"} />, label: options.isSaved ? "Unsave" : "Save", color: "text-yellow-400", bgColor: "bg-yellow-600/20", onAction: options.onSave },
    ],
  };
}

export default SwipeActions;
