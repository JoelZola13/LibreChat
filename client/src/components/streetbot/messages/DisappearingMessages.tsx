/**
 * Disappearing Messages Components
 * UI for configuring and displaying message expiration.
 */

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Timer, Eye, EyeOff, AlertTriangle, Check, X, Info } from "lucide-react";

export const TTL_OPTIONS = {
  "5_seconds": { label: "5 seconds", seconds: 5 },
  "30_seconds": { label: "30 seconds", seconds: 30 },
  "1_minute": { label: "1 minute", seconds: 60 },
  "5_minutes": { label: "5 minutes", seconds: 300 },
  "1_hour": { label: "1 hour", seconds: 3600 },
  "24_hours": { label: "24 hours", seconds: 86400 },
  "7_days": { label: "7 days", seconds: 604800 },
};

export type TtlOption = keyof typeof TTL_OPTIONS;

export interface DisappearingMessagesConfig {
  enabled: boolean;
  mode: "off" | "after_view" | "timed";
  ttlOption?: TtlOption;
  ttlSeconds?: number;
}

interface DisappearingMessagesSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: DisappearingMessagesConfig;
  onSave: (config: DisappearingMessagesConfig) => Promise<void>;
  conversationName?: string;
}

export function DisappearingMessagesSettings({ isOpen, onClose, currentConfig, onSave, conversationName }: DisappearingMessagesSettingsProps) {
  const [config, setConfig] = useState<DisappearingMessagesConfig>(currentConfig);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setConfig(currentConfig); }, [currentConfig, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try { await onSave(config); onClose(); } finally { setIsSaving(false); }
  };

  const handleModeChange = (mode: DisappearingMessagesConfig["mode"]) => {
    setConfig({ ...config, mode, enabled: mode !== "off", ttlOption: mode === "timed" ? config.ttlOption || "24_hours" : undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-md bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Disappearing Messages</h2>
              {conversationName && <p className="text-sm text-gray-400">{conversationName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-200">New messages will automatically disappear after the set time.</p>
          </div>
          <div className="space-y-3">
            {(["off", "after_view", "timed"] as const).map((mode) => (
              <button key={mode} onClick={() => handleModeChange(mode)} className={`w-full flex items-center gap-4 p-4 rounded-lg border ${config.mode === mode ? "border-purple-500 bg-purple-500/10" : "border-white/10 hover:border-white/20"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.mode === mode ? "bg-purple-500" : "bg-gray-700"}`}>
                  {mode === "off" ? <EyeOff className="w-5 h-5 text-white" /> : mode === "after_view" ? <Eye className="w-5 h-5 text-white" /> : <Clock className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">{mode === "off" ? "Off" : mode === "after_view" ? "After Viewing" : "Timed"}</p>
                  <p className="text-sm text-gray-400">{mode === "off" ? "Messages don't expire" : mode === "after_view" ? "Disappear after viewed" : "Disappear after set time"}</p>
                </div>
                {config.mode === mode && <Check className="w-5 h-5 text-purple-400" />}
              </button>
            ))}
          </div>
          {config.mode === "timed" && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TTL_OPTIONS).map(([key, { label }]) => (
                <button key={key} onClick={() => setConfig({ ...config, ttlOption: key as TtlOption, ttlSeconds: TTL_OPTIONS[key as TtlOption].seconds })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${config.ttlOption === key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>{label}</button>
              ))}
            </div>
          )}
          {config.mode !== "off" && (
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-yellow-200">Only new messages will use this setting.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">{isSaving ? "Saving..." : "Save"}</button>
        </div>
      </motion.div>
    </div>
  );
}

export function MessageExpirationTimer({ expiresAt, onExpired, className = "" }: { expiresAt: Date; onExpired?: () => void; className?: string }) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, (expiresAt.getTime() - Date.now()) / 1000);
      setTimeRemaining(Math.floor(remaining));
      if (remaining <= 0) onExpired?.();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const format = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
  const color = timeRemaining < 10 ? "text-red-400" : timeRemaining < 60 ? "text-yellow-400" : "text-gray-400";
  if (timeRemaining <= 0) return null;

  return <div className={`flex items-center gap-1 text-xs ${color} ${className}`}><Timer className="w-3 h-3" /><span>{format(timeRemaining)}</span></div>;
}

export function DisappearingBadge({ mode, ttlSeconds, className = "" }: { mode: "after_view" | "timed"; ttlSeconds?: number; className?: string }) {
  const label = mode === "after_view" ? "View once" : ttlSeconds ? (Object.entries(TTL_OPTIONS).find(([_, v]) => v.seconds === ttlSeconds)?.[1].label || `${ttlSeconds}s`) : "Disappearing";
  return <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 ${className}`}><Timer className="w-3 h-3" /><span>{label}</span></div>;
}

export function ConversationExpirationIndicator({ enabled, ttlOption, onClick }: { enabled: boolean; ttlOption?: TtlOption; onClick?: () => void }) {
  if (!enabled) return null;
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300 hover:bg-purple-500/20">
      <Timer className="w-4 h-4" /><span className="text-sm">{ttlOption ? TTL_OPTIONS[ttlOption].label : "Enabled"}</span>
    </button>
  );
}

export function ExpiringMessageWrapper({ children, expiresAt, onExpired }: { children: React.ReactNode; expiresAt?: Date; onExpired?: () => void }) {
  const [opacity, setOpacity] = useState(1);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const remaining = (expiresAt.getTime() - Date.now()) / 1000;
      if (remaining <= 0) { setIsExpired(true); onExpired?.(); return; }
      if (remaining < 10) setOpacity(remaining / 10);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (isExpired) return <motion.div initial={{ opacity: 1, height: "auto" }} animate={{ opacity: 0, height: 0 }} className="overflow-hidden" />;
  return <motion.div style={{ opacity }}>{children}</motion.div>;
}

export default DisappearingMessagesSettings;
