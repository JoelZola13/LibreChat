/**
 * Notification Sounds Manager
 * Handles audio playback with user preferences and DND support.
 */

export type SoundType = "message_received" | "message_sent" | "call_incoming" | "call_outgoing" | "mention" | "reaction" | "error" | "success";

export interface NotificationPreferences {
  soundEnabled: boolean;
  volume: number;
  dndEnabled: boolean;
  dndSchedule?: { enabled: boolean; startTime: string; endTime: string; days: number[] };
  mutedConversations: string[];
  soundOverrides: Partial<Record<SoundType, boolean>>;
  vibrationEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  volume: 0.7,
  dndEnabled: false,
  dndSchedule: { enabled: false, startTime: "22:00", endTime: "07:00", days: [0, 1, 2, 3, 4, 5, 6] },
  mutedConversations: [],
  soundOverrides: {},
  vibrationEnabled: true,
};

const FALLBACK_FREQUENCIES: Record<SoundType, number[]> = {
  message_received: [800, 1000],
  message_sent: [600],
  call_incoming: [800, 1000, 800, 1000],
  call_outgoing: [440, 550],
  mention: [1000, 1200, 1000],
  reaction: [880],
  error: [200, 150],
  success: [500, 700, 900],
};

class NotificationSoundsManager {
  private audioContext: AudioContext | null = null;
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
  private storageKey = "notification_preferences";

  constructor() {
    if (typeof window !== "undefined") this.loadPreferences();
  }

  async initialize(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === "suspended") await this.audioContext.resume();
    } catch (e) { console.warn("Audio context init failed:", e); }
  }

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    } catch (e) {}
  }

  private savePreferences(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.preferences)); } catch (e) {}
  }

  private shouldPlaySound(type: SoundType, conversationId?: string): boolean {
    if (!this.preferences.soundEnabled) return false;
    if (this.preferences.soundOverrides[type] === false) return false;
    if (conversationId && this.preferences.mutedConversations.includes(conversationId)) return false;
    if (this.isDndActive()) return false;
    return true;
  }

  isDndActive(): boolean {
    if (!this.preferences.dndEnabled) return false;
    const schedule = this.preferences.dndSchedule;
    if (!schedule?.enabled) return this.preferences.dndEnabled;

    const now = new Date();
    if (!schedule.days.includes(now.getDay())) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = schedule.startTime.split(":").map(Number);
    const [endHour, endMin] = schedule.endTime.split(":").map(Number);
    const start = startHour * 60 + startMin, end = endHour * 60 + endMin;

    return start > end ? (currentTime >= start || currentTime < end) : (currentTime >= start && currentTime < end);
  }

  async playSound(type: SoundType, options?: { conversationId?: string }): Promise<void> {
    if (!this.shouldPlaySound(type, options?.conversationId)) return;
    await this.playTone(type);
  }

  private async playTone(type: SoundType): Promise<void> {
    if (!this.audioContext) await this.initialize();
    if (!this.audioContext) return;

    const frequencies = FALLBACK_FREQUENCIES[type];
    frequencies.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = this.preferences.volume * 0.3;
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.15 * (i + 1));
      osc.start(this.audioContext!.currentTime + 0.15 * i);
      osc.stop(this.audioContext!.currentTime + 0.15 * (i + 1));
    });
  }

  vibrate(pattern: number | number[] = 200): void {
    if (!this.preferences.vibrationEnabled || this.isDndActive()) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  }

  getPreferences(): NotificationPreferences { return { ...this.preferences }; }
  updatePreferences(updates: Partial<NotificationPreferences>): void { this.preferences = { ...this.preferences, ...updates }; this.savePreferences(); }
  setVolume(v: number): void { this.updatePreferences({ volume: Math.max(0, Math.min(1, v)) }); }
  setSoundEnabled(e: boolean): void { this.updatePreferences({ soundEnabled: e }); }
  setDndEnabled(e: boolean): void { this.updatePreferences({ dndEnabled: e }); }
  setDndSchedule(s: NotificationPreferences["dndSchedule"]): void { this.updatePreferences({ dndSchedule: s }); }
  muteConversation(id: string): void { if (!this.preferences.mutedConversations.includes(id)) this.updatePreferences({ mutedConversations: [...this.preferences.mutedConversations, id] }); }
  unmuteConversation(id: string): void { this.updatePreferences({ mutedConversations: this.preferences.mutedConversations.filter((c) => c !== id) }); }
  isConversationMuted(id: string): boolean { return this.preferences.mutedConversations.includes(id); }
  setSoundOverride(type: SoundType, enabled: boolean): void { this.updatePreferences({ soundOverrides: { ...this.preferences.soundOverrides, [type]: enabled } }); }
}

let manager: NotificationSoundsManager | null = null;
export function getNotificationSounds(): NotificationSoundsManager { if (!manager) manager = new NotificationSoundsManager(); return manager; }
export function useNotificationSounds() { return getNotificationSounds(); }
export default NotificationSoundsManager;
