/**
 * Bottom Sheet Component
 * Mobile-friendly slide-up panel for actions.
 */

"use client";

import React, { useEffect, ReactNode, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { useFocusTrap, useLiveRegion, useReducedMotion } from "@/hooks/useAccessibility";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showDragHandle?: boolean;
  className?: string;
}

export function BottomSheet({ isOpen, onClose, title, children, showDragHandle = true, className = "" }: BottomSheetProps) {
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();

  const { containerProps } = useFocusTrap({ isActive: isOpen, onEscape: onClose, autoFocus: true, returnFocus: true });
  const { announce, LiveRegion } = useLiveRegion("polite");

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.velocity.y > 500 || info.offset.y > 100) onClose();
  }, [onClose]);

  useEffect(() => { if (isOpen) announce(`${title || "Bottom sheet"} opened`); }, [isOpen, title, announce]);
  useEffect(() => { if (isOpen) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; } }, [isOpen]);

  return (
    <>
      <LiveRegion />
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
            <motion.div
              {...containerProps}
              role="dialog"
              aria-modal="true"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: reducedMotion ? "tween" : "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragControls={dragControls}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.1, bottom: 0.5 }}
              onDragEnd={handleDragEnd}
              className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl border-t border-white/10 shadow-2xl ${className}`}
            >
              {showDragHandle && (
                <div className="flex justify-center pt-3 pb-2" onPointerDown={(e) => dragControls.start(e)}>
                  <div className="w-10 h-1.5 rounded-full bg-gray-600" />
                </div>
              )}
              {title && <div className="px-4 py-3 border-b border-white/10"><h2 className="text-lg font-semibold text-white text-center">{title}</h2></div>}
              <div className="overflow-y-auto max-h-96">{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function BottomSheetAction({ icon, label, description, onClick, variant = "default", disabled = false }: {
  icon: ReactNode; label: string; description?: string; onClick: () => void; variant?: "default" | "danger"; disabled?: boolean;
}) {
  const color = variant === "danger" ? "text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:bg-white/5";
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-4 px-4 py-3 ${color} transition-colors disabled:opacity-50`}>
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 text-left">
        <div className="font-medium">{label}</div>
        {description && <div className="text-sm text-gray-500">{description}</div>}
      </div>
    </button>
  );
}

export function BottomSheetDivider() {
  return <div className="h-px bg-white/10 my-2" />;
}

export function MessageActionsSheet({ isOpen, onClose, message, onReply, onEdit, onDelete, onForward, onPin, onSave, onCopy }: {
  isOpen: boolean; onClose: () => void;
  message?: { id: string; content: string; isOwn: boolean; isPinned: boolean; isSaved: boolean };
  onReply?: () => void; onEdit?: () => void; onDelete?: () => void; onForward?: () => void; onPin?: () => void; onSave?: () => void; onCopy?: () => void;
}) {
  const handleAction = (action?: () => void) => { action?.(); onClose(); };
  if (!message) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Message Actions">
      <div className="py-2">
        {onReply && <BottomSheetAction icon={<span>↩</span>} label="Reply" onClick={() => handleAction(onReply)} />}
        {onForward && <BottomSheetAction icon={<span>→</span>} label="Forward" onClick={() => handleAction(onForward)} />}
        {onCopy && <BottomSheetAction icon={<span>📋</span>} label="Copy Text" onClick={() => handleAction(onCopy)} />}
        {onPin && <BottomSheetAction icon={<span>📌</span>} label={message.isPinned ? "Unpin" : "Pin"} onClick={() => handleAction(onPin)} />}
        {onSave && <BottomSheetAction icon={<span>⭐</span>} label={message.isSaved ? "Unsave" : "Save"} onClick={() => handleAction(onSave)} />}
        {message.isOwn && onEdit && <><BottomSheetDivider /><BottomSheetAction icon={<span>✏️</span>} label="Edit" onClick={() => handleAction(onEdit)} /></>}
        {message.isOwn && onDelete && <BottomSheetAction icon={<span>🗑</span>} label="Delete" variant="danger" onClick={() => handleAction(onDelete)} />}
      </div>
    </BottomSheet>
  );
}

export default BottomSheet;
