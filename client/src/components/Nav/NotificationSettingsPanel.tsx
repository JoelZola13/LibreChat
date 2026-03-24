import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

type NotificationSettings = {
  muted: boolean;
  muted_until: string | null;
  notify_mentions_only: boolean;
  desktop_notifications: boolean;
  mobile_notifications: boolean;
  sound_enabled: boolean;
};

type NotificationSettingsPanelProps = {
  onClose: () => void;
};

const STORAGE_KEY = 'streetbot_notification_settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  muted: false,
  muted_until: null,
  notify_mentions_only: false,
  desktop_notifications: true,
  mobile_notifications: true,
  sound_enabled: true,
};

const MUTE_OPTIONS = [
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '8 hours', value: 8 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
  { label: 'Until I turn it back on', value: null },
];

const colors = {
  surface: 'rgba(20, 21, 29, 0.96)',
  surfaceHover: 'rgba(44, 45, 56, 0.85)',
  border: 'rgba(188, 189, 208, 0.12)',
  text: '#E6E7F2',
  textSecondary: '#9C9DB5',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  accent: '#6C8EEF',
  danger: '#EF6C6C',
};

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: enabled ? colors.accent : colors.surfaceHover,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: enabled ? 22 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function formatMutedUntil(until: string | null): string {
  if (!until) return 'Until you turn it back on';
  const date = new Date(until);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';
  if (diff < 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 1000))} minutes`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.ceil(diff / (60 * 60 * 1000))} hours`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationSettingsPanel({ onClose }: NotificationSettingsPanelProps) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [showMuteOptions, setShowMuteOptions] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateSettings = useCallback(
    (updates: Partial<NotificationSettings>) => {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    },
    [settings],
  );

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 130,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '80vh',
          background: colors.surface,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Rubik, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            padding: 16,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: colors.text }}>
              Notifications
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Mute toggle */}
            <div
              style={{
                background: colors.surfaceHover,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: settings.muted ? 12 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {settings.muted ? (
                    <BellOff size={20} color={colors.danger} />
                  ) : (
                    <Bell size={20} color={colors.accent} />
                  )}
                  <div>
                    <div style={{ fontWeight: 500, color: colors.text }}>
                      {settings.muted ? 'Muted' : 'Notifications On'}
                    </div>
                    {settings.muted && (
                      <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                        {formatMutedUntil(settings.muted_until)}
                      </div>
                    )}
                  </div>
                </div>

                {settings.muted ? (
                  <button
                    type="button"
                    onClick={handleUnmute}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: colors.accent,
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Unmute
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMuteOptions(!showMuteOptions)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      background: 'transparent',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
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
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: 4 }}>
                    Mute for:
                  </div>
                  {MUTE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleMute(option.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        color: colors.text,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.surface;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: colors.surfaceHover,
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AtSign size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Mentions only</div>
                  <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: colors.surfaceHover,
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Monitor size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Desktop</div>
                  <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: colors.surfaceHover,
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Smartphone size={20} color={colors.textSecondary} />
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Mobile</div>
                  <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: colors.surfaceHover,
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {settings.sound_enabled ? (
                  <Volume2 size={20} color={colors.textSecondary} />
                ) : (
                  <VolumeX size={20} color={colors.textSecondary} />
                )}
                <div>
                  <div style={{ fontWeight: 500, color: colors.text }}>Sound</div>
                  <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
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
        </div>
      </div>
    </div>
  );
}
