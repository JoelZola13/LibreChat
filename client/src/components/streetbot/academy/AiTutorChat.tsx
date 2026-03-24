/**
 * Academy Agent Chat — the AI tutor that can create courses, generate quizzes,
 * explain concepts, and orchestrate OpenMAIC classrooms.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  chatWithTutor,
  startTutorSession,
  endTutorSession,
  getLearningRecommendations,
  LearningRecommendation,
} from './api/ai-tutor';
import { getOrCreateUserId } from './api/userId';

interface AiTutorChatProps {
  courseId?: string;
  lessonId?: string;
  className?: string;
  initialMessage?: string;
  onClose?: () => void;
}

export function AiTutorChat({
  courseId,
  lessonId,
  className = '',
  initialMessage,
  onClose,
}: AiTutorChatProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialMessage && userId && !sessionId) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage, userId]);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!userId) return;
      try {
        const result = await getLearningRecommendations(userId, courseId);
        setRecommendations(result.recommendations);
      } catch {
        /* silent */
      }
    };
    loadRecommendations();
  }, [userId, courseId]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || !userId) return;

    setInput('');
    setIsLoading(true);
    setSuggestions([]);
    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);

    try {
      const response = await chatWithTutor(
        {
          message: messageText,
          session_id: sessionId || undefined,
          course_id: courseId,
          lesson_id: lessonId,
          session_type: lessonId ? 'lesson_help' : 'general',
        },
        userId,
      );

      if (!sessionId && response.session_id) {
        setSessionId(response.session_id);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);
      if (response.suggestions?.length) {
        setSuggestions(response.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: 'Create a course', icon: '📚', prompt: 'Help me create a new course' },
    { label: 'Generate a quiz', icon: '✏️', prompt: 'Generate a quiz for me' },
    { label: 'Explain a topic', icon: '💡', prompt: 'Explain a concept to me' },
    { label: 'Browse courses', icon: '🔍', prompt: 'What courses are available?' },
  ];

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ background: '#0D0D0D' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FFD60A' }}>
            <span className="text-black text-lg font-bold">A</span>
          </div>
          <div>
            <h3 className="text-white text-[15px] font-semibold tracking-tight">Academy Agent</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/40 text-[11px]">Online</span>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-6 pb-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #FFD60A 0%, #FF9500 100%)' }}
            >
              <span className="text-2xl">🎓</span>
            </div>
            <h4 className="text-white text-[15px] font-semibold mb-1">Academy Agent</h4>
            <p className="text-white/35 text-[13px] text-center max-w-[260px] leading-relaxed">
              I can create courses, generate quizzes, explain topics, and guide your learning.
            </p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 mt-5 w-full">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(action.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="text-white/60 text-[12px] font-medium">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="w-full mt-4 space-y-2">
                <p className="text-white/20 text-[11px] uppercase tracking-wider font-medium px-1">Recommended</p>
                {recommendations.slice(0, 2).map((rec, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(`Tell me about: ${rec.title}`)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all hover:scale-[1.01]"
                    style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <p className="text-white/70 text-[13px] font-medium">{rec.title}</p>
                    <p className="text-white/25 text-[11px] mt-0.5">{rec.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${
                msg.role === 'user'
                  ? 'rounded-br-md'
                  : 'rounded-bl-md'
              }`}
              style={
                msg.role === 'user'
                  ? { background: '#FFD60A', color: '#000' }
                  : { background: '#1A1A1A', color: '#e5e5e5' }
              }
            >
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: '#1A1A1A' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#FFD60A', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#FFD60A', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#FFD60A', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-5 py-2.5 border-t border-white/[0.04]">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(s)}
                className="px-3 py-1.5 text-[11px] rounded-full font-medium transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: 'rgba(255,214,10,0.1)', color: '#FFD60A', border: '1px solid rgba(255,214,10,0.15)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or say 'create a course'..."
            className="flex-1 resize-none bg-transparent text-white/90 text-[13px] placeholder:text-white/20 focus:outline-none"
            rows={1}
            disabled={isLoading}
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
            style={{ background: input.trim() ? '#FFD60A' : 'transparent' }}
          >
            <svg className="w-4 h-4" fill="none" stroke={input.trim() ? '#000' : '#555'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiTutorChat;
