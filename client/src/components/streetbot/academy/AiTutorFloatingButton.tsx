/**
 * Academy Agent — floating button + chat panel.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiTutorChat } from './AiTutorChat';

interface AiTutorFloatingButtonProps {
  courseId?: string;
  lessonId?: string;
  position?: string;
  initialMessage?: string;
  showPulse?: boolean;
}

export function AiTutorFloatingButton({
  courseId,
  lessonId,
  position = 'bottom-6 right-6',
  initialMessage,
  showPulse = false,
}: AiTutorFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${position} z-50 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center group`}
        style={{
          background: isOpen ? '#333' : '#FFD60A',
          boxShadow: isOpen ? 'none' : '0 4px 24px rgba(255,214,10,0.3)',
        }}
        title="Academy Agent"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      >
        {isOpen ? (
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <span className="text-xl group-hover:scale-110 transition-transform">🎓</span>
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-4 h-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400" />
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] h-[540px] rounded-2xl overflow-hidden"
            style={{
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <AiTutorChat
              courseId={courseId}
              lessonId={lessonId}
              initialMessage={initialMessage}
              onClose={() => setIsOpen(false)}
              className="h-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
