"use client";

/**
 * Accessible Modal Component
 * Provides focus trapping, keyboard navigation, and screen reader support.
 */

import React, { useEffect, useId, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap, useLiveRegion, useReducedMotion } from "@/hooks/useAccessibility";

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
}: AccessibleModalProps) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();

  const { containerRef, containerProps } = useFocusTrap({
    isActive: isOpen,
    onEscape: closeOnEscape ? onClose : undefined,
    autoFocus: true,
    returnFocus: true,
  });

  const { announce, LiveRegion } = useLiveRegion("polite");

  useEffect(() => {
    if (isOpen) {
      announce(`${title} dialog opened${description ? `. ${description}` : ""}`);
    }
  }, [isOpen, title, description, announce]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
  };

  return (
    <>
      <LiveRegion />
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleOverlayClick}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              ref={containerRef as React.RefObject<HTMLDivElement | null>}
              onKeyDown={containerProps.onKeyDown}
              role={containerProps.role}
              aria-modal={containerProps["aria-modal"]}
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              className={`relative z-10 w-full ${sizeClasses[size]} bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl ${className}`}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-white">{title}</h2>
                  {description && <p id={descriptionId} className="mt-1 text-sm text-gray-400">{description}</p>}
                </div>
                {showCloseButton && (
                  <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10" aria-label="Close">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="px-6 py-4">{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ModalFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 ${className}`}>{children}</div>;
}

export function ConfirmationModal({
  isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", confirmVariant = "primary", isLoading = false,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmText?: string; cancelText?: string; confirmVariant?: "primary" | "danger"; isLoading?: boolean;
}) {
  const btnClass = confirmVariant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700";
  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title={title} description={message} size="sm">
      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onClose} disabled={isLoading} className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">{cancelText}</button>
        <button onClick={onConfirm} disabled={isLoading} className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${btnClass}`}>{isLoading ? "Loading..." : confirmText}</button>
      </div>
    </AccessibleModal>
  );
}

export default AccessibleModal;
