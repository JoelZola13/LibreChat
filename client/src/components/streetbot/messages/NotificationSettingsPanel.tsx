import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Bell,
  BellOff,
  Smartphone,
  Monitor,
  Volume2,
  VolumeX,
  Clock,
  AtSign,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type NotificationSettings = {
  muted: boolean;
  muted_until: string | null;
  notify_mentions_only: boolean;
  desktop_notifications: boolean;
  mobile_notifications: boolean;
  sound_enabled: boolean;
};

interface NotificationSettingsPanelProps {
  conversationId: number | string;
  conversationName: string;
  userId: string;
  onClose: () => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    danger: string;
  };
  apiUrl?: string;
}

const MUTE_OPTIONS = [
  { label: "15 minutes", value: 15 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "8 hours", value: 8 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "Until I turn it back on", value: null },
];

export function NotificationSettingsPanel({
  conversationId,
  conversationName,
  userId,
  onClose,
  colors,
  apiUrl = "/api/messaging",
}: NotificationSettingsPanelProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    muted: false,
    muted_until: null,
    notify_mentions_only: false,
    desktop_notifications: true,
    mobile_notifications: true,
    sound_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      // Also fetch conversation-level settings
      const [notifResponse, convResponse] = await Promise.all([
        sbFetch(
          `${apiUrl}/notifications/settings/${conversationId}?user_id=${encodeURIComponent(userId)}`
        ),
        sbFetch(
          `${apiUrl}/conversations/${conversationId}/settings?user_id=${encodeURIComponent(userId)}`
        ),
      ]);
      if (notifResponse.ok) {
        const data = await notifResponse.json();
        setSettings(data);
      }
      // convResponse can be used for additional channel-level settings in the future
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId, apiUrl]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    setSaving(true);

    try {
      // Update both notification settings and conversation settings in parallel
      await Promise.all([
        sbFetch(`${apiUrl}/notifications/settings/${conversationId}?user_id=${encodeURIComponent(userId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }),
        // Sync muted state to conversation settings
        updates.muted !== undefined
          ? sbFetch(`${apiUrl}/conversations/${conversationId}/settings`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: userId,
                muted: updates.muted,
                notification_level: updates.muted ? "none" : (updates.notify_mentions_only ? "mentions" : "all"),
              }),
            })
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Failed to update notification settings:", error);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleMute = (duration: number | null) => {
    if (duration === null) {
      updateSettings({ muted: true, muted_until: null });
    } else {
      const until = new Date(Date.now() + duration).toISOString();
      updateSettings({ muted: true, muted_until: until });
    }
    setShowMuteOptions(false);
  };

  const handleUnmute = () => {
    updateSettings({ muted: false, muted_until: null });
  };

  const formatMutedUntil = (until: string | null): string => {
    if (!until) return "Until you turn it back on";
    const date = new Date(until);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return "Expired";
    if (diff < 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 1000))} minutes`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 60 * 1000))} hours`;
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const ToggleSwitch = ({
    enabled,
    onChange,
    disabled,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        background: enabled ? colors.accent : colors.surfaceHover,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: "2px",
          left: enabled ? "22px" : "2px",
          transition: "left 0.2s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );

  return (
    <div
      style={{
        width: "350px",
        height: "100%",
        background: colors.surface,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell size={18} color={colors.accent} />
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
            Notifications
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textSecondary,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100px",
              color: colors.textSecondary,
            }}
          >
            Loading...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Conversation name */}
            <div
              style={{
                padding: "12px",
                background: colors.surfaceHover,
                borderRadius: "8px",
                fontSize: "0.875rem",
                color: colors.textSecondary,
              }}
            >
              Settings for <strong style={{ color: colors.text }}>{conversationName}</strong>
            </div>

            {/* Mute toggle */}
            <div
              style={{
                background: colors.surfaceHover,
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: settings.muted ? "12px" : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {settings.muted ? (
                    <BellOff size={20} color={colors.danger} />
                  ) : (
                    <Bell size={20} color={colors.accent} />
                  )}
                  <div>
                    <div style={{ fontWeight: 500, color: colors.text }}>
                      {settings.muted ? "Muted" : "Notifications On"}
                    </div>
                    {settings.muted && (
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                        {formatMutedUntil(settings.muted_until)}
                      </div>
                    )}
                  </div>
                </div>

                {settings.muted ? (
                  <button
                    onClick={handleUnmute}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: colors.accent,
                      color: "#000",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}
                  >
                    Unmute
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMuteOptions(!showMuteOptions)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: colors.textSecondary,
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    Mute
                  </button>
                )}
              </div>

              {/* Mute options */}
              {showMuteOptions && !settings.muted && (
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: `1px solid ${colors.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginBottom: "4px" }}>
                    Mute for:
                  </div>
                  {MUTE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleMute(option.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "transparent",
                        color: colors.text,
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.surface;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Clock size={16} color={colors.textMuted} />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mentions only */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: colors.surfaceHover,
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <AtSign size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Mentions only</div>
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                    Only notify when @mentioned
                  </div>
                </div>
              </div>
              <ToggleSwitch
                enabled={settings.notify_mentions_only}
                onChange={(value) => updateSettings({ notify_mentions_only: value })}
                disabled={settings.muted}
              />
            </div>

            {/* Desktop notifications */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: colors.surfaceHover,
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Monitor size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Desktop</div>
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                    Show desktop notifications
                  </div>
                </div>
              </div>
              <ToggleSwitch
                enabled={settings.desktop_notifications}
                onChange={(value) => updateSettings({ desktop_notifications: value })}
                disabled={settings.muted}
              />
            </div>

            {/* Mobile notifications */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: colors.surfaceHover,
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Smartphone size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Mobile</div>
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                    Send push notifications
                  </div>
                </div>
              </div>
              <ToggleSwitch
                enabled={settings.mobile_notifications}
                onChange={(value) => updateSettings({ mobile_notifications: value })}
                disabled={settings.muted}
              />
            </div>

            {/* Sound */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: colors.surfaceHover,
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {settings.sound_enabled ? (
                  <Volume2 size={20} color={colors.textSecondary} />
                ) : (
                  <VolumeX size={20} color={colors.textSecondary} />
                )}
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Sound</div>
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                    Play notification sounds
                  </div>
                </div>
              </div>
              <ToggleSwitch
                enabled={settings.sound_enabled}
                onChange={(value) => updateSettings({ sound_enabled: value })}
                disabled={settings.muted}
              />
            </div>
          </div>
        )}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div
          style={{
            padding: "8px 16px",
            background: colors.surfaceHover,
            textAlign: "center",
            fontSize: "0.75rem",
            color: colors.textMuted,
          }}
        >
          Saving...
        </div>
      )}
    </div>
  );
}

export default NotificationSettingsPanel;
