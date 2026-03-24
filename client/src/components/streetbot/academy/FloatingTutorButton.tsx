/**
 * Floating AI Tutor Button Component.
 * Shows a floating button that opens the AI tutor chat.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Sparkles } from 'lucide-react';
import { AiTutorChat } from './AiTutorChat';

interface FloatingTutorButtonProps {
  courseId?: string;
  lessonId?: string;
  initialMessage?: string;
}

export function FloatingTutorButton({
  courseId,
  lessonId,
  initialMessage,
}: FloatingTutorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Show hint after 30 seconds on first visit
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setHasNewMessage(true);
        setTimeout(() => setHasNewMessage(false), 5000);
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #EC4899, #A855F7)',
              boxShadow: '0 8px 32px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Brain className="w-6 h-6 text-white" />
            <span className="text-white font-medium hidden sm:inline">AI Tutor</span>

            {/* New message indicator */}
            {hasNewMessage && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: '#10B981' }}
              >
                <Sparkles className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Hint tooltip */}
      <AnimatePresence>
        {hasNewMessage && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-20 right-6 z-50 px-4 py-2 rounded-xl max-w-[200px]"
            style={{
              background: 'rgba(30, 30, 45, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Need help? Ask the AI Tutor!
            </p>
            <div
              className="absolute bottom-0 right-8 w-3 h-3 rotate-45 translate-y-1/2"
              style={{ background: 'rgba(30, 30, 45, 0.95)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)]"
            style={{
              maxHeight: 'calc(100vh - 100px)',
            }}
          >
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/20"
                style={{
                  background: 'rgba(30, 30, 45, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <X className="w-4 h-4" style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
              </button>

              {/* Chat component */}
              <AiTutorChat
                courseId={courseId}
                lessonId={lessonId}
                initialMessage={initialMessage}
                onClose={() => setIsOpen(false)}
                className="shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingTutorButton;
