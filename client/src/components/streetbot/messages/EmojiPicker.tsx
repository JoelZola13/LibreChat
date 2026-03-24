"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Search, Clock, Smile, Heart, ThumbsUp, Zap, Flag, Coffee, Music, Star } from "lucide-react";

// Comprehensive emoji data organized by category
const EMOJI_CATEGORIES = {
  recent: { icon: Clock, label: "Recent", emojis: [] as string[] },
  smileys: {
    icon: Smile,
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚",
      "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
      "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄",
      "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
      "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳",
      "🥸", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯",
      "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭",
      "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡",
      "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺",
    ],
  },
  gestures: {
    icon: ThumbsUp,
    label: "Gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
      "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝",
      "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂",
      "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅",
      "👄", "💋", "🩸", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨",
    ],
  },
  hearts: {
    icon: Heart,
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️",
      "❤️‍🔥", "❤️‍🩹", "🫶", "🫂", "💑", "👩‍❤️‍👨", "👨‍❤️‍👨", "👩‍❤️‍👩",
    ],
  },
  activities: {
    icon: Zap,
    label: "Activities",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🎄", "🎃", "🎗️", "🎟️", "🎫",
      "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "🏀", "🏈", "⚾",
      "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒",
      "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹",
      "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼",
      "🤺", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣",
    ],
  },
  food: {
    icon: Coffee,
    label: "Food",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑",
      "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅",
      "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳",
      "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔",
      "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗",
      "☕", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷",
    ],
  },
  nature: {
    icon: Star,
    label: "Nature",
    emojis: [
      "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱",
      "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁",
      "🍂", "🍃", "🪺", "🪹", "🐶", "🐱", "🐭", "🐹", "🐰", "🦊",
      "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
      "🙈", "🙉", "🙊", "🐒", "🦍", "🦧", "🐔", "🐧", "🐦", "🐤",
      "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱",
      "🦋", "🐌", "🐛", "🦗", "🐜", "🪰", "🐢", "🐍", "🦎", "🦖",
    ],
  },
  objects: {
    icon: Music,
    label: "Objects",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️",
      "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️",
      "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️",
      "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌",
      "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶",
      "💷", "🪙", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧",
      "🔨", "⚒️", "🛠️", "⛏️", "🪚", "🔩", "⚙️", "🪤", "🧱", "⛓️",
      "🎸", "🎹", "🎺", "🎻", "🪕", "🥁", "🪘", "🎤", "🎧", "🎼",
    ],
  },
  symbols: {
    icon: Flag,
    label: "Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "✨", "⭐",
      "🌟", "💫", "⚡", "🔥", "💥", "☀️", "🌤️", "⛅", "🌥️", "☁️",
      "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄", "🌬️", "💨",
      "🌪️", "🌈", "☔", "💧", "💦", "🌊", "✅", "☑️", "✔️", "❌",
      "❎", "➕", "➖", "➗", "✖️", "♾️", "💲", "💱", "™️", "©️",
      "®️", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔝", "🔜", "✳️",
      "❇️", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〽️", "⚠️", "🚸",
    ],
  },
};

type EmojiCategory = keyof typeof EMOJI_CATEGORIES;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { top?: number; bottom?: number; left?: number; right?: number };
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
  };
}

const RECENT_EMOJIS_KEY = "sv_recent_emojis";

export function EmojiPicker({ onSelect, onClose, position, colors }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>("smileys");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[EmojiPicker] Failed to load recent emojis from localStorage:', error);
    }
  }, []);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleEmojiSelect = (emoji: string) => {
    // Update recent emojis
    const newRecent = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 24);
    setRecentEmojis(newRecent);
    try {
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(newRecent));
    } catch (error) {
      console.error('[EmojiPicker] Failed to save recent emojis to localStorage:', error);
    }

    onSelect(emoji);
    onClose();
  };

  // Filter emojis by search
  const getFilteredEmojis = (): string[] => {
    if (!searchQuery.trim()) {
      if (activeCategory === "recent") {
        return recentEmojis;
      }
      return EMOJI_CATEGORIES[activeCategory].emojis;
    }

    // Search across all categories
    const query = searchQuery.toLowerCase();
    const results: string[] = [];
    Object.values(EMOJI_CATEGORIES).forEach((cat) => {
      cat.emojis.forEach((emoji) => {
        // Simple matching - in production, you'd use emoji names/keywords
        if (emoji.includes(query) || results.length < 50) {
          if (!results.includes(emoji)) {
            results.push(emoji);
          }
        }
      });
    });
    return results.slice(0, 50);
  };

  const filteredEmojis = getFilteredEmojis();
  const categories = Object.keys(EMOJI_CATEGORIES) as EmojiCategory[];

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        ...position,
        width: "340px",
        maxHeight: "400px",
        background: colors.surface,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${colors.border}`,
        borderRadius: "16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
      {/* Header with search */}
      <div
        style={{
          padding: "12px",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: colors.surfaceHover,
            borderRadius: "8px",
            padding: "8px 12px",
          }}
        >
          <Search size={16} color={colors.textMuted} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.875rem",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: "2px",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "8px 12px",
            borderBottom: `1px solid ${colors.border}`,
            overflowX: "auto",
          }}
        >
          {categories.map((cat) => {
            const CategoryIcon = EMOJI_CATEGORIES[cat].icon;
            const isActive = activeCategory === cat;
            const hasEmojis = cat === "recent" ? recentEmojis.length > 0 : true;

            if (!hasEmojis) return null;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                title={EMOJI_CATEGORIES[cat].label}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? colors.accent : "transparent",
                  color: isActive ? "#000" : colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                <CategoryIcon size={18} />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px",
        }}
      >
        {filteredEmojis.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: colors.textSecondary,
              padding: "24px",
              fontSize: "0.875rem",
            }}
          >
            {searchQuery ? "No emojis found" : "No recent emojis"}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "4px",
            }}
          >
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiSelect(emoji)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                  e.currentTarget.style.transform = "scale(1.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category label */}
      {!searchQuery && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: "0.75rem",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {EMOJI_CATEGORIES[activeCategory].label}
        </div>
      )}
    </div>
  );
}

export default EmojiPicker;
