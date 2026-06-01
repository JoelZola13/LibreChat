import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Extension, Mark, Node as TiptapNode, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, Selection as ProseMirrorSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import AudioExtension from "@tiptap/extension-audio";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Highlight from "@tiptap/extension-highlight";
import TiptapImage from "@tiptap/extension-image";
import { InvisibleCharacters } from "@tiptap/extension-invisible-characters";
import Link from "@tiptap/extension-link";
import { ListKit } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import Mention from "@tiptap/extension-mention";
import { Markdown } from "@tiptap/markdown";
import SubscriptExtension from "@tiptap/extension-subscript";
import SuperscriptExtension from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TableOfContents, getHierarchicalIndexes, type TableOfContentData } from "@tiptap/extension-table-of-contents";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TwitchExtension from "@tiptap/extension-twitch";
import Typography from "@tiptap/extension-typography";
import { UniqueID } from "@tiptap/extension-unique-id";
import Underline from "@tiptap/extension-underline";
import YoutubeExtension from "@tiptap/extension-youtube";
import { FloatingMenuPlugin } from "@tiptap/extension-floating-menu";
import DragHandleReact from "@tiptap/extension-drag-handle-react";
import { CharacterCount, Focus, Placeholder, Selection } from "@tiptap/extensions";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Emoji from "@tiptap/extension-emoji";
import FileHandler from "@tiptap/extension-file-handler";
import { Suggestion, exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import "katex/dist/katex.min.css";
import { lowlight } from "lowlight";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  AtSign,
  Bold,
  Braces,
  Check,
  Code2,
  Columns3,
  ClipboardPaste,
  Copy,
  X,
  EyeOff,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  ListChecks,
  ListOrdered,
  List as ListIcon,
  ListTree,
  Lightbulb,
  Lock,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Music2,
  PaintBucket,
  Palette,
  Pilcrow,
  Plus,
  Printer,
  Quote,
  Redo2,
  Rows3,
  Save,
  Search,
  SeparatorHorizontal,
  Settings2,
  Sigma,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Type,
  Twitch as TwitchIcon,
  Underline as UnderlineIcon,
  Undo2,
  Users,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import {
  DeletionMark,
  InsertionMark,
  type SuggestionData,
  TrackChangesExtension,
} from "../lib/tiptap/TrackChangesExtension";

export interface TiptapDocumentRecord {
  id: string;
  title: string;
  document_type: string;
  status: string;
  content?: JSONContent | Record<string, unknown> | null;
  content_text?: string;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
}

export type TiptapPageSize = "letter" | "a4" | "legal";
export type TiptapPageOrientation = "portrait" | "landscape";

export interface TiptapPageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TiptapPageSettings {
  size: TiptapPageSize;
  orientation: TiptapPageOrientation;
  margins: TiptapPageMargins;
}

export interface TiptapSavePayload {
  title: string;
  content: JSONContent;
  contentText: string;
  wordCount: number;
  pageSettings: TiptapPageSettings;
  baseUpdatedAt: string | null;
}

interface TiptapOfflineDraft extends TiptapSavePayload {
  version: 1;
  documentId: string;
  userId: string;
  savedAt: string;
  baseSnapshot: string;
}

interface TiptapOfflineDraftNotice {
  kind: "restored" | "saved" | "conflict";
  savedAt: string;
}

interface TiptapBlockLinkNotice {
  kind: "success" | "error";
  message: string;
  href?: string;
}

export class TiptapDocumentSaveConflictError extends Error {
  constructor(message = "Document changed elsewhere. Your draft was saved locally.") {
    super(message);
    this.name = "TiptapDocumentSaveConflictError";
  }
}

export interface TiptapMentionOption {
  id: string;
  label: string;
  description?: string;
}

export interface TiptapMediaUploadResult {
  src: string;
  fileId?: string;
  filename?: string;
  contentType?: string;
  source?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

export type TiptapCollaborationStatus = "disabled" | "connecting" | "connected" | "disconnected" | "error";
type TiptapCollaborationPresenceMode = "editing" | "viewing" | "syncing" | "joining" | "offline" | "solo";

export interface TiptapCollaborationUser {
  id: string;
  name: string;
  color: string;
}

interface TiptapCollaborationPresenceUser extends TiptapCollaborationUser {
  clientId: number;
  mode: TiptapCollaborationPresenceMode;
  label: string;
  updatedAt: string | null;
}

export interface TiptapCollaborationConfig {
  enabled: boolean;
  websocketUrl?: string;
  roomName?: string;
  roomToken?: string | null;
  user: TiptapCollaborationUser;
}

interface TiptapDocumentEditorProps {
  document: TiptapDocumentRecord;
  userId: string;
  userName?: string;
  colors: EditorColors;
  isDark: boolean;
  loading?: boolean;
  error?: string | null;
  onSave: (payload: TiptapSavePayload) => Promise<void>;
  suggestions?: TiptapReviewSuggestion[];
  suggestionsLoading?: boolean;
  suggestionsError?: string | null;
  onSuggestionCreate?: (suggestion: SuggestionData) => void | Promise<void>;
  onSuggestionResolve?: (suggestionId: string, action: "accept" | "reject") => void | Promise<void>;
  comments?: TiptapReviewComment[];
  commentsLoading?: boolean;
  commentsError?: string | null;
  onCommentCreate?: (comment: TiptapCommentCreatePayload) => Promise<TiptapReviewComment | void>;
  onCommentResolve?: (commentId: string) => void | Promise<void>;
  mentionOptions?: TiptapMentionOption[];
  mentionOptionsLoading?: boolean;
  mentionOptionsError?: string | null;
  onMediaUpload?: (file: File) => Promise<TiptapMediaUploadResult | null | undefined>;
  collaboration?: TiptapCollaborationConfig | null;
  readOnly?: boolean;
  readOnlyReason?: string | null;
}

interface EditorColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
}

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const emptyDocumentSnapshot = JSON.stringify(emptyDocument);

const AUTOSAVE_DELAY_MS = 1200;
const PAGE_RENDER_SCALE = 96;
const MIN_MARGIN_INCHES = 0.25;
const MAX_MARGIN_INCHES = 2.5;
const TIPTAP_BLOCK_LINK_HASH_PREFIX = "block-";
const TIPTAP_BLOCK_LINK_HIGHLIGHT_MS = 2800;

export const TIPTAP_PAGE_SETTINGS_METADATA_KEY = "streetbot_page_settings";

const PAGE_SIZE_OPTIONS: Array<{
  value: TiptapPageSize;
  label: string;
  width: number;
  height: number;
}> = [
  { value: "letter", label: "Letter", width: 8.5, height: 11 },
  { value: "a4", label: "A4", width: 8.27, height: 11.69 },
  { value: "legal", label: "Legal", width: 8.5, height: 14 },
];

const ORIENTATION_OPTIONS: Array<{ value: TiptapPageOrientation; label: string }> = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

const DEFAULT_PAGE_SETTINGS: TiptapPageSettings = {
  size: "letter",
  orientation: "portrait",
  margins: {
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
  },
};

type SaveTrigger = "manual" | "auto";

interface TiptapCollaborationSession {
  doc: Y.Doc;
  provider: WebsocketProvider;
  roomName: string;
  websocketUrl: string;
  user: TiptapCollaborationUser;
}

function createCollaborationCaretElement(user: Record<string, unknown>): HTMLElement {
  const color = typeof user.color === "string" ? user.color : "#2563eb";
  const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : "Collaborator";
  const cursor = document.createElement("span");
  cursor.className = "streetbot-collaboration-caret";
  cursor.style.borderColor = color;

  const label = document.createElement("span");
  label.className = "streetbot-collaboration-caret-label";
  label.style.backgroundColor = color;
  label.textContent = name;
  cursor.appendChild(label);

  return cursor;
}

function createCollaborationSelectionAttrs(user: Record<string, unknown>) {
  const color = typeof user.color === "string" ? user.color : "#2563eb";
  const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : "Collaborator";

  return {
    nodeName: "span",
    class: "streetbot-collaboration-selection",
    style: `background-color: ${color}33`,
    "data-user": name,
  };
}

function collaborationStatusLabel(status: TiptapCollaborationStatus, synced: boolean): string {
  if (status === "connected" && synced) return "Live";
  if (status === "connected") return "Syncing";
  if (status === "connecting") return "Connecting";
  if (status === "error") return "Offline";
  if (status === "disconnected") return "Offline";
  return "Solo";
}

function collaborationPresenceForState(
  status: TiptapCollaborationStatus,
  synced: boolean,
  readOnly: boolean
): { mode: TiptapCollaborationPresenceMode; label: string } {
  if (readOnly) return { mode: "viewing", label: "Viewing" };
  if (status === "connected" && synced) return { mode: "editing", label: "Editing" };
  if (status === "connected") return { mode: "syncing", label: "Syncing" };
  if (status === "connecting") return { mode: "joining", label: "Joining" };
  if (status === "error" || status === "disconnected") return { mode: "offline", label: "Offline" };
  return { mode: "solo", label: "Solo" };
}

function normalizeCollaborationPresenceMode(value: unknown): TiptapCollaborationPresenceMode {
  if (
    value === "editing" ||
    value === "viewing" ||
    value === "syncing" ||
    value === "joining" ||
    value === "offline" ||
    value === "solo"
  ) {
    return value;
  }
  return "editing";
}

function parseCollaborationPresenceUser(clientId: number, state: unknown): TiptapCollaborationPresenceUser | null {
  const awarenessState = state && typeof state === "object" ? state as Record<string, unknown> : {};
  const rawUser = awarenessState.user && typeof awarenessState.user === "object"
    ? awarenessState.user as Record<string, unknown>
    : null;

  if (
    !rawUser ||
    typeof rawUser.id !== "string" ||
    typeof rawUser.name !== "string" ||
    typeof rawUser.color !== "string"
  ) {
    return null;
  }

  const rawPresence = awarenessState.presence && typeof awarenessState.presence === "object"
    ? awarenessState.presence as Record<string, unknown>
    : {};
  const mode = normalizeCollaborationPresenceMode(rawPresence.mode);
  const label = typeof rawPresence.label === "string" && rawPresence.label.trim()
    ? rawPresence.label.trim()
    : collaborationPresenceForState("connected", true, false).label;
  const updatedAt = typeof rawPresence.updatedAt === "string" ? rawPresence.updatedAt : null;

  return {
    clientId,
    id: rawUser.id,
    name: rawUser.name,
    color: rawUser.color,
    mode,
    label,
    updatedAt,
  };
}

function collaborationPresenceDotColor(mode: TiptapCollaborationPresenceMode): string {
  if (mode === "editing") return "#16a34a";
  if (mode === "viewing") return "#f59e0b";
  if (mode === "syncing") return "#2563eb";
  if (mode === "joining") return "#64748b";
  if (mode === "offline") return "#dc2626";
  return "#6b7280";
}

function collaborationPresenceTimeLabel(value: string | null): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 60_000) return "Now";
  if (elapsedMs < 60 * 60_000) return `${Math.max(1, Math.round(elapsedMs / 60_000))}m ago`;
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export interface TiptapReviewSuggestion {
  id: string;
  suggestionId: string;
  suggestionType: "insertion" | "deletion";
  originalText?: string;
  suggestedText?: string;
  authorName?: string;
  authorColor?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt?: string | Date;
}

export interface TiptapReviewComment {
  id: string;
  content: string;
  anchorType: "document" | "selection" | "block";
  anchorFrom?: number;
  anchorTo?: number;
  anchorText?: string;
  isResolved: boolean;
  createdAt?: string | Date;
}

export interface TiptapCommentCreatePayload {
  content: string;
  anchorType: "document" | "selection" | "block";
  anchorFrom?: number;
  anchorTo?: number;
  anchorText?: string;
}

interface CommentAnchorDraft {
  anchorType: "document" | "selection" | "block";
  anchorFrom?: number;
  anchorTo?: number;
  anchorText?: string;
}

interface DocumentOutlineItem {
  id: string;
  text: string;
  level: number;
  position: number;
  isActive?: boolean;
  isScrolledOver?: boolean;
  itemIndex?: number;
}

interface EditorCounts {
  characters: number;
  words: number;
}

interface DocumentSearchMatch {
  from: number;
  to: number;
  text: string;
  index: number;
}

interface DocumentSearchPluginState {
  query: string;
  activeIndex: number;
  results: DocumentSearchMatch[];
  decorations: DecorationSet;
}

interface DocumentSearchSummary {
  query: string;
  activeIndex: number;
  resultCount: number;
}

type MentionSuggestionProps = SuggestionProps<TiptapMentionOption, TiptapMentionOption>;

type InsertDialogKind = "audio" | "codeBlock" | "emoji" | "image" | "link" | "math" | "twitch" | "youtube";
type MarkdownImportMode = "insert" | "replace";

interface MarkdownExportStatus {
  kind: "success" | "error";
  message: string;
}

interface InsertDialogState {
  kind: InsertDialogKind;
  title: string;
  label: string;
  placeholder: string;
  value: string;
  submitLabel: string;
  insertPosition?: number;
}

interface SlashCommandRange {
  from: number;
  to: number;
}

interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  category: string;
  shortcut?: string;
  keywords: string[];
  command: (editor: Editor, range: SlashCommandRange) => void;
}

const TEXT_COLOR_SWATCHES = ["#111827", "#2563eb", "#16a34a", "#dc2626", "#9333ea", "#c2410c"];
const BACKGROUND_COLOR_SWATCHES = ["#fef3c7", "#dcfce7", "#dbeafe", "#fce7f3", "#ede9fe"];
const FONT_FAMILY_OPTIONS = [
  { label: "Rubik", value: "'Rubik', sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "'SFMono-Regular', Consolas, monospace" },
];
const FONT_SIZE_OPTIONS = ["14px", "16px", "18px", "22px"];
const LINE_HEIGHT_OPTIONS = ["1.35", "1.55", "1.72", "2"];
const CODE_BLOCK_LANGUAGE_OPTIONS = [
  { label: "Plain text", value: "plaintext" },
  { label: "Bash", value: "bash" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
  { label: "C#", value: "csharp" },
  { label: "CSS", value: "css" },
  { label: "Diff", value: "diff" },
  { label: "Go", value: "go" },
  { label: "GraphQL", value: "graphql" },
  { label: "HTML / XML", value: "xml" },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript" },
  { label: "JSON", value: "json" },
  { label: "Kotlin", value: "kotlin" },
  { label: "Lua", value: "lua" },
  { label: "Makefile", value: "makefile" },
  { label: "Markdown", value: "markdown" },
  { label: "PHP", value: "php" },
  { label: "Python", value: "python" },
  { label: "R", value: "r" },
  { label: "Ruby", value: "ruby" },
  { label: "Rust", value: "rust" },
  { label: "SCSS", value: "scss" },
  { label: "Shell", value: "shell" },
  { label: "SQL", value: "sql" },
  { label: "Swift", value: "swift" },
  { label: "TypeScript", value: "typescript" },
  { label: "YAML", value: "yaml" },
];
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const AUDIO_MIME_TYPES = [
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
];
const MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...AUDIO_MIME_TYPES];
const MAX_EDITOR_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EDITOR_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_INLINE_IMAGE_FALLBACK_BYTES = 512 * 1024;
const slashCommandPluginKey = new PluginKey("streetbotSlashCommands");
const documentSearchPluginKey = new PluginKey<DocumentSearchPluginState>("streetbotDocumentSearch");

function createInsertDialogState(
  kind: InsertDialogKind,
  previousValue = "",
  insertPosition?: number
): InsertDialogState {
  const dialogByKind: Record<InsertDialogKind, Omit<InsertDialogState, "insertPosition">> = {
    audio: {
      kind,
      title: "Audio",
      label: "Audio URL",
      placeholder: "https://example.com/audio.mp3",
      value: "",
      submitLabel: "Insert",
    },
    codeBlock: {
      kind,
      title: "Code block",
      label: "Language",
      placeholder: "javascript",
      value: previousValue || "javascript",
      submitLabel: "Create",
    },
    emoji: {
      kind,
      title: "Emoji",
      label: "Shortcode",
      placeholder: "sparkles",
      value: previousValue || "sparkles",
      submitLabel: "Insert",
    },
    image: {
      kind,
      title: "Image",
      label: "Image URL",
      placeholder: "https://example.com/image.png",
      value: "",
      submitLabel: "Insert",
    },
    link: {
      kind,
      title: "Link",
      label: "Link URL",
      placeholder: "https://example.com",
      value: previousValue,
      submitLabel: previousValue ? "Update" : "Apply",
    },
    math: {
      kind,
      title: "Math",
      label: "LaTeX",
      placeholder: "E = mc^2",
      value: previousValue || "E = mc^2",
      submitLabel: "Insert",
    },
    twitch: {
      kind,
      title: "Twitch",
      label: "Twitch URL",
      placeholder: "https://www.twitch.tv/videos/1234567890",
      value: "",
      submitLabel: "Insert",
    },
    youtube: {
      kind,
      title: "YouTube",
      label: "YouTube URL",
      placeholder: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      value: "",
      submitLabel: "Insert",
    },
  };

  return {
    ...dialogByKind[kind],
    ...(typeof insertPosition === "number" ? { insertPosition } : {}),
  };
}

function textToTiptapDocument(text?: string | null): JSONContent {
  if (!text?.trim()) return emptyDocument;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: "paragraph",
      content: [{ type: "text", text: block }],
    }));

  return {
    type: "doc",
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
  };
}

function normalizeTiptapContent(
  content?: JSONContent | Record<string, unknown> | null,
  fallbackText?: string | null
): JSONContent {
  if (content && typeof content === "object") {
    const maybeJson = content as JSONContent;
    if (maybeJson.type === "doc") {
      return maybeJson;
    }

    if (Array.isArray(maybeJson.content)) {
      return {
        type: "doc",
        content: maybeJson.content,
      };
    }
  }

  return textToTiptapDocument(fallbackText);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clampMargin(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_MARGIN_INCHES, Math.max(MIN_MARGIN_INCHES, Math.round(parsed * 100) / 100));
}

function isPageSize(value: unknown): value is TiptapPageSize {
  return PAGE_SIZE_OPTIONS.some(option => option.value === value);
}

function isPageOrientation(value: unknown): value is TiptapPageOrientation {
  return ORIENTATION_OPTIONS.some(option => option.value === value);
}

function pageSettingsFromMetadata(metadata?: Record<string, unknown> | null): TiptapPageSettings {
  const rawSettings = metadata?.[TIPTAP_PAGE_SETTINGS_METADATA_KEY] as Partial<TiptapPageSettings> | undefined;
  const rawMargins = (rawSettings?.margins || {}) as Partial<TiptapPageMargins>;

  return {
    size: isPageSize(rawSettings?.size) ? rawSettings.size : DEFAULT_PAGE_SETTINGS.size,
    orientation: isPageOrientation(rawSettings?.orientation)
      ? rawSettings.orientation
      : DEFAULT_PAGE_SETTINGS.orientation,
    margins: {
      top: clampMargin(rawMargins.top, DEFAULT_PAGE_SETTINGS.margins.top),
      right: clampMargin(rawMargins.right, DEFAULT_PAGE_SETTINGS.margins.right),
      bottom: clampMargin(rawMargins.bottom, DEFAULT_PAGE_SETTINGS.margins.bottom),
      left: clampMargin(rawMargins.left, DEFAULT_PAGE_SETTINGS.margins.left),
    },
  };
}

function pageGeometry(settings: TiptapPageSettings) {
  const sizeOption = PAGE_SIZE_OPTIONS.find(option => option.value === settings.size) || PAGE_SIZE_OPTIONS[0];
  const widthInches = settings.orientation === "landscape" ? sizeOption.height : sizeOption.width;
  const heightInches = settings.orientation === "landscape" ? sizeOption.width : sizeOption.height;
  return {
    widthInches,
    heightInches,
    widthPx: Math.round(widthInches * PAGE_RENDER_SCALE),
    heightPx: Math.round(heightInches * PAGE_RENDER_SCALE),
  };
}

function saveSnapshot(payload: TiptapSavePayload): string {
  return JSON.stringify({
    title: payload.title,
    content: payload.content,
    contentText: payload.contentText,
    wordCount: payload.wordCount,
    pageSettings: payload.pageSettings,
  });
}

function tiptapOfflineDraftKey(userId: string, documentId: string): string {
  return `streetbot:tiptap-offline-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(documentId)}`;
}

function parseTimestamp(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isTiptapOfflineDraft(value: unknown, documentId: string, userId: string): value is TiptapOfflineDraft {
  const draft = value as Partial<TiptapOfflineDraft> | null;
  return Boolean(
    draft &&
      draft.version === 1 &&
      draft.documentId === documentId &&
      draft.userId === userId &&
      typeof draft.title === "string" &&
      draft.content &&
      typeof draft.content === "object" &&
      typeof draft.contentText === "string" &&
      typeof draft.wordCount === "number" &&
      draft.pageSettings &&
      typeof draft.pageSettings === "object" &&
      typeof draft.savedAt === "string" &&
      (draft.baseUpdatedAt === null || typeof draft.baseUpdatedAt === "string") &&
      typeof draft.baseSnapshot === "string"
  );
}

function readTiptapOfflineDraft(key: string, documentId: string, userId: string): TiptapOfflineDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(key);
    if (!rawDraft) return null;
    const parsedDraft = JSON.parse(rawDraft);
    return isTiptapOfflineDraft(parsedDraft, documentId, userId) ? parsedDraft : null;
  } catch (error) {
    console.warn("Could not read Tiptap offline draft.", error);
    return null;
  }
}

function writeTiptapOfflineDraft(key: string, draft: TiptapOfflineDraft): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch (error) {
    console.warn("Could not write Tiptap offline draft.", error);
    return false;
  }
}

function deleteTiptapOfflineDraft(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Could not delete Tiptap offline draft.", error);
  }
}

function shouldRestoreTiptapOfflineDraft(
  draft: TiptapOfflineDraft,
  initialContentSnapshot: string,
  documentUpdatedAt?: string
): boolean {
  if (draft.baseSnapshot === initialContentSnapshot) {
    return true;
  }

  const draftSavedAt = parseTimestamp(draft.savedAt);
  const serverUpdatedAt = parseTimestamp(documentUpdatedAt);
  return draftSavedAt > 0 && (!serverUpdatedAt || draftSavedAt > serverUpdatedAt);
}

function isTiptapDocumentSaveConflict(error: unknown): boolean {
  return error instanceof Error && error.name === "TiptapDocumentSaveConflictError";
}

function normalizeSuggestionDate(value?: string | Date): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function getSuggestionText(suggestion: TiptapReviewSuggestion): string {
  return suggestion.suggestionType === "insertion"
    ? suggestion.suggestedText || ""
    : suggestion.originalText || "";
}

function getDocumentOutline(editor: Editor | null): DocumentOutlineItem[] {
  if (!editor) return [];

  const items: DocumentOutlineItem[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "heading") return;
    const level = Number.isInteger(node.attrs.level) && node.attrs.level >= 1 && node.attrs.level <= 6
      ? node.attrs.level
      : 2;
    const text = node.textContent.trim();
    if (!text) return;
    items.push({
      id: `${position}-${level}-${text}`,
      text,
      level,
      position,
    });
  });

  return items;
}

function outlineFromTableOfContents(data: TableOfContentData): DocumentOutlineItem[] {
  return data
    .filter(item => item.textContent.trim())
    .map(item => ({
      id: item.id || `${item.pos}-${item.textContent}`,
      text: item.textContent.trim(),
      level: item.originalLevel || item.level || 2,
      position: item.pos,
      isActive: item.isActive,
      isScrolledOver: item.isScrolledOver,
      itemIndex: item.itemIndex,
    }));
}

function filterDocumentOutlineItems(items: DocumentOutlineItem[], query: string): DocumentOutlineItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;
  return items.filter(item => item.text.toLocaleLowerCase().includes(normalizedQuery));
}

function getDocumentSearchMatches(doc: ProseMirrorNode, query: string): DocumentSearchMatch[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const queryLower = normalizedQuery.toLocaleLowerCase();
  const queryLength = normalizedQuery.length;
  const matches: DocumentSearchMatch[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;

    const text = node.text;
    const textLower = text.toLocaleLowerCase();
    let offset = textLower.indexOf(queryLower);

    while (offset !== -1) {
      matches.push({
        from: position + offset,
        to: position + offset + queryLength,
        text: text.slice(offset, offset + queryLength),
        index: matches.length,
      });
      offset = textLower.indexOf(queryLower, offset + queryLength);
    }
  });

  return matches;
}

function normalizeDocumentSearchActiveIndex(activeIndex: number, resultCount: number): number {
  if (resultCount <= 0) return -1;
  if (!Number.isFinite(activeIndex) || activeIndex < 0) return 0;
  return activeIndex % resultCount;
}

function createDocumentSearchDecorations(
  doc: ProseMirrorNode,
  results: DocumentSearchMatch[],
  activeIndex: number
): DecorationSet {
  if (!results.length) return DecorationSet.empty;

  return DecorationSet.create(
    doc,
    results.map(match => Decoration.inline(match.from, match.to, {
      class: match.index === activeIndex
        ? "streetbot-tiptap-search-match is-active"
        : "streetbot-tiptap-search-match",
      "data-search-index": String(match.index),
    }))
  );
}

function createDocumentSearchPluginState(
  doc: ProseMirrorNode,
  query: string,
  activeIndex = 0
): DocumentSearchPluginState {
  const normalizedQuery = query.trim();
  const results = getDocumentSearchMatches(doc, normalizedQuery);
  const normalizedActiveIndex = normalizeDocumentSearchActiveIndex(activeIndex, results.length);
  return {
    query: normalizedQuery,
    activeIndex: normalizedActiveIndex,
    results,
    decorations: createDocumentSearchDecorations(doc, results, normalizedActiveIndex),
  };
}

function getDocumentSearchPluginState(editor: Editor | null): DocumentSearchPluginState | null {
  if (!editor) return null;
  return documentSearchPluginKey.getState(editor.state) || null;
}

function documentSearchSummaryFromState(state: DocumentSearchPluginState | null): DocumentSearchSummary {
  return {
    query: state?.query || "",
    activeIndex: state?.activeIndex ?? -1,
    resultCount: state?.results.length || 0,
  };
}

function updateDocumentSearchState(
  editor: Editor,
  query: string,
  activeIndex = 0,
  shouldSelectMatch = true
): DocumentSearchPluginState {
  editor.view.dispatch(
    editor.state.tr.setMeta(documentSearchPluginKey, {
      query,
      activeIndex,
    })
  );

  const nextState = getDocumentSearchPluginState(editor)
    || createDocumentSearchPluginState(editor.state.doc, query, activeIndex);
  const activeMatch = nextState.activeIndex >= 0 ? nextState.results[nextState.activeIndex] : null;

  if (shouldSelectMatch && activeMatch) {
    editor
      .chain()
      .focus()
      .setTextSelection({ from: activeMatch.from, to: activeMatch.to })
      .scrollIntoView()
      .run();
  }

  return nextState;
}

function goToDocumentSearchResult(editor: Editor, direction: 1 | -1): DocumentSearchPluginState | null {
  const currentState = getDocumentSearchPluginState(editor);
  if (!currentState || currentState.results.length === 0) return currentState;

  const nextIndex = (currentState.activeIndex + direction + currentState.results.length) % currentState.results.length;
  return updateDocumentSearchState(editor, currentState.query, nextIndex);
}

const DocumentSearchExtension = Extension.create({
  name: "streetbotDocumentSearch",

  addProseMirrorPlugins() {
    return [
      new Plugin<DocumentSearchPluginState>({
        key: documentSearchPluginKey,
        state: {
          init: (_, state) => createDocumentSearchPluginState(state.doc, ""),
          apply: (transaction, pluginState) => {
            const meta = transaction.getMeta(documentSearchPluginKey) as
              | { query?: string; activeIndex?: number }
              | undefined;
            const nextQuery = typeof meta?.query === "string" ? meta.query : pluginState.query;
            const nextActiveIndex = typeof meta?.activeIndex === "number"
              ? meta.activeIndex
              : pluginState.activeIndex;

            if (!transaction.docChanged && nextQuery === pluginState.query && nextActiveIndex === pluginState.activeIndex) {
              return pluginState;
            }

            return createDocumentSearchPluginState(transaction.doc, nextQuery, nextActiveIndex);
          },
        },
        props: {
          decorations: (state) => documentSearchPluginKey.getState(state)?.decorations || null,
        },
      }),
    ];
  },
});

function getEditorCounts(editor: Editor | null): EditorCounts {
  if (!editor) return { characters: 0, words: 0 };
  const characterCount = editor.storage.characterCount as
    | { characters?: () => number; words?: () => number }
    | undefined;
  const text = editor.getText();

  return {
    characters: characterCount?.characters?.() ?? text.length,
    words: characterCount?.words?.() ?? countWords(text),
  };
}

function getTwitchParent(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function mediaKindLabel(file: File): "image" | "audio" | "media" {
  if (IMAGE_MIME_TYPES.includes(file.type)) return "image";
  if (AUDIO_MIME_TYPES.includes(file.type)) return "audio";
  return "media";
}

function mediaUploadLimit(file: File): number {
  return IMAGE_MIME_TYPES.includes(file.type)
    ? MAX_EDITOR_IMAGE_UPLOAD_BYTES
    : MAX_EDITOR_AUDIO_UPLOAD_BYTES;
}

function canInlineFallback(file: File): boolean {
  return IMAGE_MIME_TYPES.includes(file.type) && file.size <= MAX_INLINE_IMAGE_FALLBACK_BYTES;
}

interface TiptapMediaNotice {
  kind: "success" | "warning" | "error";
  message: string;
}

interface InsertMediaFilesOptions {
  position?: number;
  uploadMedia?: (file: File) => Promise<TiptapMediaUploadResult | null | undefined>;
  onNotice?: (notice: TiptapMediaNotice) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error || new Error(`Could not read ${file.name}`));
    });
    reader.readAsDataURL(file);
  });
}

function insertMediaNode(editor: Editor, file: File, src: string, position?: number): void {
  if (editor.isDestroyed) return;

  if (AUDIO_MIME_TYPES.includes(file.type)) {
    const audioNode = {
      type: "audio",
      attrs: {
        src,
        controls: true,
        preload: "metadata",
      },
    };
    if (typeof position === "number") {
      editor.chain().insertContentAt(position, audioNode).focus().run();
      return;
    }
    editor.chain().focus().setAudio({ src, controls: true, preload: "metadata" }).run();
    return;
  }

  const imageNode = {
    type: "image",
    attrs: {
      src,
      alt: file.name,
      title: file.name,
    },
  };
  if (typeof position === "number") {
    editor.chain().insertContentAt(position, imageNode).focus().run();
    return;
  }
  editor.chain().focus().setImage({ src, alt: file.name, title: file.name }).run();
}

async function insertMediaFiles(
  editor: Editor,
  files: File[],
  options: InsertMediaFilesOptions = {}
): Promise<void> {
  const mediaFiles = files.filter(file => MEDIA_MIME_TYPES.includes(file.type));
  let insertionPosition = options.position;

  for (const file of mediaFiles) {
    const kindLabel = mediaKindLabel(file);
    const uploadLimit = mediaUploadLimit(file);

    if (file.size > uploadLimit) {
      options.onNotice?.({
        kind: "error",
        message: `${file.name} was not inserted. ${kindLabel === "image" ? "Images" : "Audio files"} must be ${formatBytes(uploadLimit)} or smaller.`,
      });
      continue;
    }

    let src = "";
    let uploadedToStorage = false;
    let uploadFailed = false;

    if (options.uploadMedia) {
      try {
        const uploaded = await options.uploadMedia(file);
        src = uploaded?.src || "";
        uploadedToStorage = Boolean(src);
      } catch (err) {
        uploadFailed = true;
        console.warn("Media upload failed.", err);
      }
    }

    if (!src) {
      if (!canInlineFallback(file)) {
        options.onNotice?.({
          kind: "error",
          message: uploadFailed
            ? `${file.name} was not inserted because durable upload failed and inline ${kindLabel} fallback is disabled.`
            : `${file.name} was not inserted because inline ${kindLabel} fallback is disabled.`,
        });
        continue;
      }

      try {
        src = await readFileAsDataUrl(file);
        options.onNotice?.({
          kind: "warning",
          message: `${file.name} was inserted inline because durable upload was unavailable. Inline fallback is limited to images under ${formatBytes(MAX_INLINE_IMAGE_FALLBACK_BYTES)}.`,
        });
      } catch (err) {
        console.warn("Could not read media file for insertion.", err);
        options.onNotice?.({
          kind: "error",
          message: `${file.name} could not be read for insertion.`,
        });
        continue;
      }
    }

    if (!src) continue;
    insertMediaNode(editor, file, src, insertionPosition);
    if (uploadedToStorage) {
      options.onNotice?.({
        kind: "success",
        message: `${file.name} was inserted from authenticated document storage.`,
      });
    }
    if (typeof insertionPosition === "number") {
      insertionPosition += 1;
    }
  }
}

function mentionNode(mention: TiptapMentionOption): JSONContent {
  return {
    type: "mention",
    attrs: {
      id: mention.id,
      label: mention.label,
      mentionSuggestionChar: "@",
    },
  };
}

function insertMention(editor: Editor, mention: TiptapMentionOption): void {
  editor
    .chain()
    .focus()
    .insertContent([mentionNode(mention), { type: "text", text: " " }])
    .run();
}

const CALLOUT_KIND_META = {
  note: {
    label: "Note",
    indicator: "i",
  },
  tip: {
    label: "Tip",
    indicator: "!",
  },
  warning: {
    label: "Warning",
    indicator: "!",
  },
} as const;

type CalloutKind = keyof typeof CALLOUT_KIND_META;

const DEFAULT_CALLOUT_KIND: CalloutKind = "note";

function normalizeCalloutKind(value: unknown): CalloutKind {
  if (typeof value !== "string") return DEFAULT_CALLOUT_KIND;
  return value in CALLOUT_KIND_META ? (value as CalloutKind) : DEFAULT_CALLOUT_KIND;
}

function calloutNode(kind: CalloutKind = DEFAULT_CALLOUT_KIND): JSONContent {
  return {
    type: "streetbotCallout",
    attrs: {
      kind,
    },
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

function getSlashCommandReplacementRange(editor: Editor, range: SlashCommandRange): SlashCommandRange {
  const $from = editor.state.doc.resolve(range.from);
  const parent = $from.parent;

  if ($from.depth > 0 && parent.type.name === "paragraph" && parent.textContent.trim().startsWith("/")) {
    return {
      from: $from.before($from.depth),
      to: $from.after($from.depth),
    };
  }

  return range;
}

function dispatchCalloutInsertion(editor: Editor, range: SlashCommandRange, kind: CalloutKind): void {
  const callout = editor.schema.nodeFromJSON(calloutNode(kind));
  const insertFrom = Math.min(range.from, editor.state.doc.content.size);
  const insertTo = Math.min(Math.max(range.to, insertFrom), editor.state.doc.content.size);

  try {
    const transaction = editor.state.tr.replaceWith(insertFrom, insertTo, callout);
    const selectionPosition = Math.min(Math.max(insertFrom + 2, 0), transaction.doc.content.size);
    const $selection = transaction.doc.resolve(selectionPosition);
    transaction.setSelection(
      $selection.parent.inlineContent
        ? TextSelection.create(transaction.doc, selectionPosition)
        : ProseMirrorSelection.near($selection, 1)
    );
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
  } catch (error) {
    editor.chain().focus().insertContent(calloutNode(kind)).run();
  }
}

function insertCallout(editor: Editor, kind: CalloutKind = DEFAULT_CALLOUT_KIND): void {
  dispatchCalloutInsertion(editor, editor.state.selection, kind);
}

function insertCalloutAtSlashRange(editor: Editor, range: SlashCommandRange, kind: CalloutKind): void {
  dispatchCalloutInsertion(editor, getSlashCommandReplacementRange(editor, range), kind);
}

function getActiveBlockRange(editor: Editor): { from: number; to: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.isBlock) {
      return {
        from: $from.before(depth),
        to: $from.after(depth),
        node,
      };
    }
  }

  return null;
}

function findAncestorNodeRange(
  editor: Editor,
  nodeName: string
): { from: number; to: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === nodeName) {
      return {
        from: $from.before(depth),
        to: $from.after(depth),
        node,
      };
    }
  }

  return null;
}

function setSelectionNearPosition(transaction: Transaction, position: number): void {
  const selectionPosition = Math.min(Math.max(position, 0), transaction.doc.content.size);
  const $selection = transaction.doc.resolve(selectionPosition);
  transaction.setSelection(
    $selection.parent.inlineContent
      ? TextSelection.create(transaction.doc, selectionPosition)
      : ProseMirrorSelection.near($selection, 1)
  );
}

function transformActiveBlockToCallout(editor: Editor, kind: CalloutKind): void {
  const calloutType = editor.schema.nodes.streetbotCallout;
  if (!calloutType) {
    insertCallout(editor, kind);
    return;
  }

  const activeCallout = findAncestorNodeRange(editor, "streetbotCallout");
  if (activeCallout) {
    const transaction = editor.state.tr.setNodeMarkup(activeCallout.from, undefined, {
      ...activeCallout.node.attrs,
      kind,
    });
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
    return;
  }

  const activeBlock = getActiveBlockRange(editor);
  if (!activeBlock) {
    insertCallout(editor, kind);
    return;
  }

  try {
    const callout = calloutType.create({ kind }, Fragment.from(activeBlock.node));
    const transaction = editor.state.tr.replaceWith(activeBlock.from, activeBlock.to, callout);
    setSelectionNearPosition(transaction, activeBlock.from + 2);
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
  } catch (error) {
    insertCallout(editor, kind);
  }
}

function setHeadingTransform(editor: Editor, level: 1 | 2 | 3): void {
  if (editor.isActive("heading", { level })) {
    editor.chain().focus().run();
    return;
  }

  editor.chain().focus().setParagraph().toggleHeading({ level }).run();
}

function applyBlockTransform(editor: Editor, kind: BlockTransformKind): void {
  switch (kind) {
    case "paragraph":
      editor.chain().focus().clearNodes().setParagraph().run();
      break;
    case "heading-1":
      setHeadingTransform(editor, 1);
      break;
    case "heading-2":
      setHeadingTransform(editor, 2);
      break;
    case "heading-3":
      setHeadingTransform(editor, 3);
      break;
    case "quote":
      if (!editor.isActive("blockquote")) {
        editor.chain().focus().toggleBlockquote().run();
      }
      break;
    case "callout-note":
      transformActiveBlockToCallout(editor, "note");
      break;
    case "callout-tip":
      transformActiveBlockToCallout(editor, "tip");
      break;
    case "callout-warning":
      transformActiveBlockToCallout(editor, "warning");
      break;
    case "code-block":
      if (!editor.isActive("codeBlock")) {
        editor.chain().focus().toggleCodeBlock().run();
      }
      break;
    case "bullet-list":
      if (!editor.isActive("bulletList")) {
        editor.chain().focus().toggleBulletList().run();
      }
      break;
    case "ordered-list":
      if (!editor.isActive("orderedList")) {
        editor.chain().focus().toggleOrderedList().run();
      }
      break;
    case "task-list":
      if (!editor.isActive("taskList")) {
        editor.chain().focus().toggleTaskList().run();
      }
      break;
    case "details":
      if (!editor.isActive("details")) {
        editor.chain().focus().setDetails().run();
      }
      break;
    case "divider":
      editor.chain().focus().setHorizontalRule().run();
      break;
    case "table":
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
  }
}

function normalizeCodeBlockLanguage(value: unknown): string {
  if (typeof value !== "string") return "plaintext";
  const normalizedValue = value.trim().toLowerCase();
  return CODE_BLOCK_LANGUAGE_OPTIONS.some(option => option.value === normalizedValue)
    ? normalizedValue
    : "plaintext";
}

function getActiveCodeBlockLanguage(editor: Editor | null): string {
  if (!editor) return "";

  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "codeBlock") {
      return normalizeCodeBlockLanguage(node.attrs.language);
    }
  }

  return "";
}

const StreetbotCallout = TiptapNode.create({
  name: "streetbotCallout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: DEFAULT_CALLOUT_KIND,
        parseHTML: (element) => normalizeCalloutKind(element.getAttribute("data-callout-kind")),
        renderHTML: (attributes) => ({
          "data-callout-kind": normalizeCalloutKind(attributes.kind),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "aside[data-type='streetbot-callout']",
        contentElement: "[data-callout-content]",
      },
      {
        tag: "div[data-streetbot-callout]",
        contentElement: "[data-callout-content]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = normalizeCalloutKind(node.attrs.kind);
    const meta = CALLOUT_KIND_META[kind];

    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        "data-type": "streetbot-callout",
        "data-callout-kind": kind,
        "data-callout-label": meta.label,
        class: `streetbot-tiptap-callout streetbot-tiptap-callout-${kind}`,
        role: "note",
      }),
      [
        "div",
        {
          class: "streetbot-tiptap-callout-icon",
          "aria-hidden": "true",
        },
        meta.indicator,
      ],
      [
        "div",
        {
          class: "streetbot-tiptap-callout-content",
          "data-callout-content": "",
        },
        0,
      ],
    ];
  },
});

function createMentionSuggestionRenderer() {
  let container: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let latestProps: MentionSuggestionProps | null = null;

  const removeContainer = () => {
    container?.remove();
    container = null;
    latestProps = null;
    selectedIndex = 0;
  };

  const selectItem = (index: number) => {
    const item = latestProps?.items[index];
    if (!item || !latestProps) return;
    latestProps.command(item);
  };

  const updatePosition = () => {
    if (!container || !latestProps) return;
    const rect = latestProps.clientRect?.();
    if (!rect) {
      container.style.display = "none";
      return;
    }

    const viewportPadding = 8;
    const top = Math.min(
      window.innerHeight - container.offsetHeight - viewportPadding,
      rect.bottom + 6
    );
    const left = Math.min(
      window.innerWidth - container.offsetWidth - viewportPadding,
      rect.left
    );
    container.style.display = "block";
    container.style.top = `${Math.max(viewportPadding, top)}px`;
    container.style.left = `${Math.max(viewportPadding, left)}px`;
  };

  const renderItems = () => {
    if (!container || !latestProps) return;
    const items = latestProps.items;
    selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
    container.replaceChildren();

    if (items.length === 0) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "streetbot-tiptap-mention-empty";
      emptyItem.textContent = "No matches";
      container.appendChild(emptyItem);
      updatePosition();
      return;
    }

    items.forEach((item, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `streetbot-tiptap-mention-option${index === selectedIndex ? " is-selected" : ""}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");

      const label = document.createElement("span");
      label.className = "streetbot-tiptap-mention-option-label";
      label.textContent = `@${item.label}`;
      option.appendChild(label);

      if (item.description) {
        const description = document.createElement("span");
        description.className = "streetbot-tiptap-mention-option-description";
        description.textContent = item.description;
        option.appendChild(description);
      }

      option.addEventListener("mouseenter", () => {
        selectedIndex = index;
        renderItems();
      });
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectItem(index);
      });
      container.appendChild(option);
    });

    updatePosition();
  };

  return {
    onStart: (props: MentionSuggestionProps) => {
      if (typeof document === "undefined") return;
      container = document.createElement("div");
      container.className = "streetbot-tiptap-mention-menu";
      container.setAttribute("role", "listbox");
      container.setAttribute("aria-label", "Mention suggestions");
      document.body.appendChild(container);
      latestProps = props;
      selectedIndex = 0;
      renderItems();
    },
    onUpdate: (props: MentionSuggestionProps) => {
      latestProps = props;
      renderItems();
    },
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (!latestProps?.items.length) return false;

      if (event.key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % latestProps.items.length;
        renderItems();
        return true;
      }

      if (event.key === "ArrowUp") {
        selectedIndex = (selectedIndex + latestProps.items.length - 1) % latestProps.items.length;
        renderItems();
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        selectItem(selectedIndex);
        return true;
      }

      if (event.key === "Escape") {
        removeContainer();
        return true;
      }

      return false;
    },
    onExit: removeContainer,
  };
}

type SlashCommandSuggestionProps = SuggestionProps<SlashCommandItem, SlashCommandItem>;

function createSlashCommandRenderer() {
  let container: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let latestProps: SlashCommandSuggestionProps | null = null;

  const selectItem = (index: number) => {
    const item = latestProps?.items[index];
    if (!item || !latestProps) return;
    latestProps.command(item);
  };

  const handleMenuKeyDown = (event: KeyboardEvent): boolean => {
    if (!latestProps) return false;

    if (event.key === "Escape") {
      exitSuggestion(latestProps.editor.view, slashCommandPluginKey);
      return true;
    }

    if (!latestProps.items.length) return false;

    if (event.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % latestProps.items.length;
      renderItems();
      return true;
    }

    if (event.key === "ArrowUp") {
      selectedIndex = (selectedIndex + latestProps.items.length - 1) % latestProps.items.length;
      renderItems();
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      selectItem(selectedIndex);
      return true;
    }

    return false;
  };

  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
    if (!handleMenuKeyDown(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const removeContainer = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
    }
    container?.remove();
    container = null;
    latestProps = null;
    selectedIndex = 0;
  };

  const updatePosition = () => {
    if (!container || !latestProps) return;
    const rect = latestProps.clientRect?.();
    if (!rect) {
      container.style.display = "none";
      return;
    }

    const viewportPadding = 8;
    const top = Math.min(
      window.innerHeight - container.offsetHeight - viewportPadding,
      rect.bottom + 8
    );
    const left = Math.min(
      window.innerWidth - container.offsetWidth - viewportPadding,
      rect.left
    );
    container.style.display = "block";
    container.style.top = `${Math.max(viewportPadding, top)}px`;
    container.style.left = `${Math.max(viewportPadding, left)}px`;
  };

  const renderItems = () => {
    if (!container || !latestProps) return;
    const items = latestProps.items;
    selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
    container.replaceChildren();

    if (items.length === 0) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "streetbot-tiptap-slash-empty";
      emptyItem.textContent = "No commands";
      container.appendChild(emptyItem);
      updatePosition();
      return;
    }

    let currentCategory = "";

    items.forEach((item, index) => {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        const category = document.createElement("div");
        category.className = "streetbot-tiptap-slash-category";
        category.setAttribute("role", "presentation");
        category.textContent = item.category;
        container.appendChild(category);
      }

      const option = document.createElement("button");
      option.type = "button";
      option.className = `streetbot-tiptap-slash-option${index === selectedIndex ? " is-selected" : ""}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      option.setAttribute("data-testid", `streetbot-tiptap-slash-option-${item.id}`);

      const labelRow = document.createElement("span");
      labelRow.className = "streetbot-tiptap-slash-option-row";

      const label = document.createElement("span");
      label.className = "streetbot-tiptap-slash-option-label";
      label.textContent = item.label;
      labelRow.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "streetbot-tiptap-slash-option-shortcut";
        shortcut.textContent = item.shortcut;
        labelRow.appendChild(shortcut);
      }

      option.appendChild(labelRow);

      const description = document.createElement("span");
      description.className = "streetbot-tiptap-slash-option-description";
      description.textContent = item.description;
      option.appendChild(description);

      option.addEventListener("mouseenter", () => {
        selectedIndex = index;
        renderItems();
      });
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectItem(index);
      });
      container.appendChild(option);
    });

    updatePosition();
  };

  return {
    onStart: (props: SlashCommandSuggestionProps) => {
      if (typeof document === "undefined") return;
      container = document.createElement("div");
      container.className = "streetbot-tiptap-slash-menu";
      container.setAttribute("role", "listbox");
      container.setAttribute("aria-label", "Slash commands");
      document.body.appendChild(container);
      document.addEventListener("keydown", handleDocumentKeyDown, true);
      latestProps = props;
      selectedIndex = 0;
      renderItems();
    },
    onUpdate: (props: SlashCommandSuggestionProps) => {
      latestProps = props;
      renderItems();
    },
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      return handleMenuKeyDown(event);
    },
    onExit: removeContainer,
  };
}

const SLASH_COMMAND_MAX_RESULTS = 24;

function filterSlashCommandItems(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items.slice(0, SLASH_COMMAND_MAX_RESULTS);

  return items
    .filter(item => {
      const searchableText = [
        item.label,
        item.description,
        ...item.keywords,
      ].join(" ").toLowerCase();
      return searchableText.includes(normalizedQuery);
    })
    .slice(0, SLASH_COMMAND_MAX_RESULTS);
}

const SlashCommandExtension = Extension.create<{ items: SlashCommandItem[] }>({
  name: "streetbotSlashCommands",
  priority: 1000,

  addOptions() {
    return {
      items: [],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        startOfLine: true,
        allowSpaces: true,
        allowedPrefixes: null,
        decorationClass: "streetbot-tiptap-slash-query",
        items: ({ query }) => filterSlashCommandItems(this.options.items, query),
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        command: ({ editor, range, props }) => {
          props.command(editor, range);
        },
        render: createSlashCommandRenderer,
      }),
    ];
  },
});

function createSlashCommandItems({
  currentMention,
  openInsertDialogAtRange,
}: {
  currentMention: TiptapMentionOption;
  openInsertDialogAtRange: (editor: Editor, range: SlashCommandRange, kind: InsertDialogKind) => void;
}): SlashCommandItem[] {
  return [
    {
      id: "paragraph",
      label: "Text",
      description: "Plain paragraph",
      category: "Basic blocks",
      shortcut: "/text",
      keywords: ["paragraph", "body", "normal"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large section title",
      category: "Basic blocks",
      shortcut: "/h1",
      keywords: ["h1", "title"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium section title",
      category: "Basic blocks",
      shortcut: "/h2",
      keywords: ["h2", "subtitle"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small section title",
      category: "Basic blocks",
      shortcut: "/h3",
      keywords: ["h3", "subheading"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
    },
    {
      id: "bullet-list",
      label: "Bulleted list",
      description: "Simple list",
      category: "Lists",
      shortcut: "/bullet",
      keywords: ["bullet", "unordered", "list"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: "ordered-list",
      label: "Numbered list",
      description: "Ordered list",
      category: "Lists",
      shortcut: "/number",
      keywords: ["numbered", "ordered", "list"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: "task-list",
      label: "Checklist",
      description: "To-do list",
      category: "Lists",
      shortcut: "/todo",
      keywords: ["task", "todo", "check", "checkbox"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Indented quote block",
      category: "Structure",
      shortcut: "/quote",
      keywords: ["blockquote", "callout"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: "callout",
      label: "Callout",
      description: "Highlighted note",
      category: "Structure",
      shortcut: "/callout",
      keywords: ["note", "info", "aside"],
      command: (editor, range) => insertCalloutAtSlashRange(editor, range, "note"),
    },
    {
      id: "tip-callout",
      label: "Tip callout",
      description: "Helpful tip block",
      category: "Structure",
      shortcut: "/tip",
      keywords: ["tip", "hint", "idea", "callout"],
      command: (editor, range) => insertCalloutAtSlashRange(editor, range, "tip"),
    },
    {
      id: "warning-callout",
      label: "Warning callout",
      description: "Important warning",
      category: "Structure",
      shortcut: "/warn",
      keywords: ["warning", "caution", "alert", "callout"],
      command: (editor, range) => insertCalloutAtSlashRange(editor, range, "warning"),
    },
    {
      id: "code-block",
      label: "Code block",
      description: "Syntax-highlighted code",
      category: "Structure",
      shortcut: "/code",
      keywords: ["code", "pre", "snippet"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal rule",
      category: "Structure",
      shortcut: "/divider",
      keywords: ["horizontal", "rule", "separator"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      id: "table",
      label: "Table",
      description: "3 x 3 table",
      category: "Structure",
      shortcut: "/table",
      keywords: ["grid", "spreadsheet", "cells"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: "details",
      label: "Details",
      description: "Collapsible section",
      category: "Structure",
      shortcut: "/details",
      keywords: ["toggle", "accordion", "summary"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).setDetails().run(),
    },
    {
      id: "math",
      label: "Math",
      description: "LaTeX formula",
      category: "Inline",
      shortcut: "/math",
      keywords: ["latex", "formula", "equation"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).insertInlineMath({ latex: "E = mc^2" }).run(),
    },
    {
      id: "emoji",
      label: "Emoji",
      description: "Insert an emoji",
      category: "Inline",
      shortcut: "/emoji",
      keywords: ["icon", "face", "sparkles"],
      command: (editor, range) => editor.chain().focus().deleteRange(range).setEmoji("sparkles").run(),
    },
    {
      id: "mention",
      label: "Mention",
      description: "Mention a person or role",
      category: "Inline",
      shortcut: "/mention",
      keywords: ["user", "person", "at"],
      command: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([mentionNode(currentMention), { type: "text", text: " " }])
          .run();
      },
    },
    {
      id: "image",
      label: "Image",
      description: "Insert by URL",
      category: "Media",
      shortcut: "/image",
      keywords: ["picture", "media", "photo"],
      command: (editor, range) => openInsertDialogAtRange(editor, range, "image"),
    },
    {
      id: "youtube",
      label: "YouTube",
      description: "Embed video",
      category: "Media",
      shortcut: "/youtube",
      keywords: ["video", "embed"],
      command: (editor, range) => openInsertDialogAtRange(editor, range, "youtube"),
    },
    {
      id: "audio",
      label: "Audio",
      description: "Embed audio",
      category: "Media",
      shortcut: "/audio",
      keywords: ["sound", "music", "media"],
      command: (editor, range) => openInsertDialogAtRange(editor, range, "audio"),
    },
    {
      id: "twitch",
      label: "Twitch",
      description: "Embed stream video",
      category: "Media",
      shortcut: "/twitch",
      keywords: ["stream", "video", "embed"],
      command: (editor, range) => openInsertDialogAtRange(editor, range, "twitch"),
    },
  ];
}

const CommentAnchorMark = Mark.create({
  name: "commentAnchor",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => ({
          "data-comment-id": attributes.commentId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        class: "streetbot-comment-anchor",
      },
      0,
    ];
  },
});

function createToolbarButtonStyle(
  active: boolean,
  colors: TiptapDocumentEditorProps["colors"],
  isDark: boolean
): React.CSSProperties {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "7px",
    border: `1px solid ${active ? colors.accent : colors.border}`,
    background: active
      ? isDark ? "rgba(255,214,0,0.16)" : "rgba(59,130,246,0.12)"
      : isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
    color: active ? colors.accent : colors.textMuted,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 32px",
  };
}

interface ToolbarButton {
  label: string;
  icon: LucideIcon;
  action: () => void;
  active?: boolean;
  disabled?: boolean;
}

type BlockTransformKind =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "quote"
  | "callout-note"
  | "callout-tip"
  | "callout-warning"
  | "code-block"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "details"
  | "divider"
  | "table";

const BLOCK_TRANSFORM_OPTIONS: Array<{ value: BlockTransformKind; label: string }> = [
  { value: "paragraph", label: "Text" },
  { value: "heading-1", label: "Heading 1" },
  { value: "heading-2", label: "Heading 2" },
  { value: "heading-3", label: "Heading 3" },
  { value: "quote", label: "Quote" },
  { value: "callout-note", label: "Callout" },
  { value: "callout-tip", label: "Tip callout" },
  { value: "callout-warning", label: "Warning callout" },
  { value: "code-block", label: "Code block" },
  { value: "bullet-list", label: "Bulleted list" },
  { value: "ordered-list", label: "Numbered list" },
  { value: "task-list", label: "Checklist" },
  { value: "details", label: "Details" },
  { value: "divider", label: "Divider" },
  { value: "table", label: "Table" },
];

function BubbleMenuSurface({
  editor,
  children,
}: {
  editor: Editor;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuRef.current) return;

    const pluginKey = "streetbotBubbleMenu";
    const plugin = BubbleMenuPlugin({
      editor,
      element: menuRef.current,
      pluginKey,
      updateDelay: 80,
    });

    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(pluginKey);
    };
  }, [editor]);

  return (
    <div
      ref={menuRef}
      className="streetbot-tiptap-bubble-menu"
      style={{ position: "absolute", visibility: "hidden" }}
    >
      {children}
    </div>
  );
}

function FloatingMenuSurface({
  editor,
  children,
}: {
  editor: Editor;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !menuRef.current) return;

    const pluginKey = "streetbotFloatingMenu";
    const plugin = FloatingMenuPlugin({
      editor,
      element: menuRef.current,
      pluginKey,
      updateDelay: 80,
    });

    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(pluginKey);
    };
  }, [editor]);

  return (
    <div
      ref={menuRef}
      className="streetbot-tiptap-floating-menu"
      style={{ position: "absolute", visibility: "hidden" }}
    >
      {children}
    </div>
  );
}

interface TiptapBlockMoveTarget {
  node: ProseMirrorNode;
  parent: ProseMirrorNode;
  index: number;
  pos: number;
}

interface TiptapBlockTextRange {
  from: number;
  to: number;
}

function findBlockMoveTarget(doc: ProseMirrorNode, targetPos: number): TiptapBlockMoveTarget | null {
  let match: TiptapBlockMoveTarget | null = null;

  const visit = (parent: ProseMirrorNode, parentStart: number): boolean => {
    let offset = 0;

    for (let index = 0; index < parent.childCount; index += 1) {
      const node = parent.child(index);
      const pos = parentStart + offset;

      if (pos === targetPos && node.isBlock) {
        match = { node, parent, index, pos };
        return true;
      }

      if (targetPos > pos && targetPos < pos + node.nodeSize && node.content.size > 0) {
        if (visit(node, pos + 1)) return true;
      }

      offset += node.nodeSize;
    }

    return false;
  };

  visit(doc, 0);
  return match;
}

function getTextRangeInsideBlock(target: TiptapBlockMoveTarget, docSize: number): TiptapBlockTextRange | null {
  if (target.node.isTextblock) {
    const from = Math.min(target.pos + 1, docSize);
    const to = Math.min(Math.max(from, target.pos + target.node.nodeSize - 1), docSize);
    return { from, to };
  }

  let range: TiptapBlockTextRange | null = null;
  target.node.descendants((node, pos) => {
    if (range || !node.isTextblock) return false;

    const nodePos = target.pos + 1 + pos;
    const from = Math.min(nodePos + 1, docSize);
    const to = Math.min(Math.max(from, nodePos + node.nodeSize - 1), docSize);
    range = { from, to };
    return false;
  });

  return range;
}

function uniqueBlockIdFromNode(node: ProseMirrorNode): string | null {
  const id = node.attrs?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function nodeSupportsUniqueBlockId(node: ProseMirrorNode): boolean {
  return Object.prototype.hasOwnProperty.call(node.type.spec.attrs || {}, "id");
}

function createUniqueBlockId(): string {
  const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `streetbot-block-${randomId}`;
}

function findBlockTargetById(doc: ProseMirrorNode, blockId: string): Pick<TiptapBlockMoveTarget, "node" | "pos"> | null {
  let match: Pick<TiptapBlockMoveTarget, "node" | "pos"> | null = null;

  doc.descendants((node, pos) => {
    if (!node.isBlock) return true;
    if (uniqueBlockIdFromNode(node) !== blockId) return true;

    match = { node, pos };
    return false;
  });

  return match;
}

function ensureBlockTargetId(
  editor: Editor,
  target: TiptapBlockMoveTarget
): { id: string; pos: number; node: ProseMirrorNode } | null {
  const directId = uniqueBlockIdFromNode(target.node);
  if (directId) return { id: directId, pos: target.pos, node: target.node };

  if (nodeSupportsUniqueBlockId(target.node)) {
    const id = createUniqueBlockId();
    const transaction = editor.state.tr.setNodeMarkup(target.pos, undefined, {
      ...target.node.attrs,
      id,
    }, target.node.marks);
    editor.view.dispatch(transaction);
    return { id, pos: target.pos, node: transaction.doc.nodeAt(target.pos) || target.node };
  }

  let descendant: { id: string; pos: number; node: ProseMirrorNode; needsAssignment: boolean } | null = null;
  target.node.descendants((node, pos) => {
    if (!node.isBlock) return true;

    const nodePos = target.pos + 1 + pos;
    const id = uniqueBlockIdFromNode(node);
    if (id) {
      descendant = { id, pos: nodePos, node, needsAssignment: false };
      return false;
    }

    if (nodeSupportsUniqueBlockId(node)) {
      descendant = { id: createUniqueBlockId(), pos: nodePos, node, needsAssignment: true };
      return false;
    }

    return true;
  });

  if (!descendant) return null;
  if (!descendant.needsAssignment) return descendant;

  const transaction = editor.state.tr.setNodeMarkup(descendant.pos, undefined, {
    ...descendant.node.attrs,
    id: descendant.id,
  }, descendant.node.marks);
  editor.view.dispatch(transaction);
  return {
    id: descendant.id,
    pos: descendant.pos,
    node: transaction.doc.nodeAt(descendant.pos) || descendant.node,
  };
}

function blockIdFromLocationHash(hash: string): string | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!rawHash.startsWith(TIPTAP_BLOCK_LINK_HASH_PREFIX)) return null;

  try {
    const decoded = decodeURIComponent(rawHash.slice(TIPTAP_BLOCK_LINK_HASH_PREFIX.length));
    return decoded.trim() || null;
  } catch {
    return rawHash.slice(TIPTAP_BLOCK_LINK_HASH_PREFIX.length).trim() || null;
  }
}

function buildBlockLinkHref(documentId: string, blockId: string): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  url.searchParams.set("documentId", documentId);
  url.hash = `${TIPTAP_BLOCK_LINK_HASH_PREFIX}${encodeURIComponent(blockId)}`;
  return url.toString();
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the old selection API below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function sanitizeMarkdownExportFilename(filename: string): string {
  const sanitized = filename
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 96);

  return sanitized || "document";
}

function downloadMarkdownText(markdown: string, filename: string): boolean {
  if (typeof document === "undefined") return false;

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

function scrollToBlockId(editor: Editor, blockId: string): boolean {
  const target = findBlockTargetById(editor.state.doc, blockId);
  if (!target) return false;

  const transaction = editor.state.tr;
  if (NodeSelection.isSelectable(target.node)) {
    transaction.setSelection(NodeSelection.create(transaction.doc, target.pos));
  } else {
    setSelectionNearPosition(transaction, target.pos + 1);
  }
  editor.view.dispatch(transaction.scrollIntoView());

  window.requestAnimationFrame(() => {
    const blockDom = editor.view.nodeDOM(target.pos);
    const element = blockDom instanceof HTMLElement
      ? blockDom
      : blockDom?.parentElement instanceof HTMLElement
        ? blockDom.parentElement
        : null;
    if (!element) return;

    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.classList.add("streetbot-tiptap-block-link-target");
    window.setTimeout(() => {
      element.classList.remove("streetbot-tiptap-block-link-target");
    }, TIPTAP_BLOCK_LINK_HIGHLIGHT_MS);
  });

  return true;
}

function stripUniqueNodeIds(value: JSONContent): JSONContent {
  const nextValue: JSONContent = { ...value };

  if (nextValue.attrs && typeof nextValue.attrs === "object") {
    const { id: _id, ...attrs } = nextValue.attrs;
    nextValue.attrs = attrs;
  }

  if (Array.isArray(nextValue.content)) {
    nextValue.content = nextValue.content.map(stripUniqueNodeIds);
  }

  return nextValue;
}

function duplicateProseMirrorNodeWithoutUniqueIds(editor: Editor, node: ProseMirrorNode): ProseMirrorNode {
  return editor.schema.nodeFromJSON(stripUniqueNodeIds(node.toJSON()));
}

function toolbarFor(
  editor: Editor,
  trackChanges: boolean,
  setTrackChanges: (value: boolean) => void,
  onComment: () => void,
  invisibleCharacters: boolean,
  setInvisibleCharacters: (value: boolean) => void,
  currentMention: TiptapMentionOption,
  openInsertDialog: (kind: InsertDialogKind) => void
): ToolbarButton[][] {
  return [
    [
      {
        label: "Undo",
        icon: Undo2,
        action: () => editor.chain().focus().undo().run(),
        disabled: !editor.can().undo(),
      },
      {
        label: "Redo",
        icon: Redo2,
        action: () => editor.chain().focus().redo().run(),
        disabled: !editor.can().redo(),
      },
    ],
    [
      {
        label: "Paragraph",
        icon: Pilcrow,
        action: () => editor.chain().focus().setParagraph().run(),
        active: editor.isActive("paragraph"),
      },
      {
        label: "Heading 1",
        icon: Heading1,
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        active: editor.isActive("heading", { level: 1 }),
      },
      {
        label: "Heading 2",
        icon: Heading2,
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive("heading", { level: 2 }),
      },
      {
        label: "Heading 3",
        icon: Heading3,
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        active: editor.isActive("heading", { level: 3 }),
      },
      {
        label: "Quote",
        icon: Quote,
        action: () => editor.chain().focus().toggleBlockquote().run(),
        active: editor.isActive("blockquote"),
      },
      {
        label: "Callout",
        icon: Lightbulb,
        action: () => insertCallout(editor),
        active: editor.isActive("streetbotCallout"),
      },
      {
        label: "Code block",
        icon: Braces,
        action: () => openInsertDialog("codeBlock"),
        active: editor.isActive("codeBlock"),
      },
      {
        label: "Horizontal rule",
        icon: SeparatorHorizontal,
        action: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
    [
      {
        label: "Bold",
        icon: Bold,
        action: () => editor.chain().focus().toggleBold().run(),
        active: editor.isActive("bold"),
      },
      {
        label: "Italic",
        icon: Italic,
        action: () => editor.chain().focus().toggleItalic().run(),
        active: editor.isActive("italic"),
      },
      {
        label: "Underline",
        icon: UnderlineIcon,
        action: () => editor.chain().focus().toggleUnderline().run(),
        active: editor.isActive("underline"),
      },
      {
        label: "Strike",
        icon: Strikethrough,
        action: () => editor.chain().focus().toggleStrike().run(),
        active: editor.isActive("strike"),
      },
      {
        label: "Highlight",
        icon: Highlighter,
        action: () => editor.chain().focus().toggleHighlight({ color: "#fde047" }).run(),
        active: editor.isActive("highlight"),
      },
      {
        label: "Inline code",
        icon: Code2,
        action: () => editor.chain().focus().toggleCode().run(),
        active: editor.isActive("code"),
      },
      {
        label: "Subscript",
        icon: Subscript,
        action: () => editor.chain().focus().toggleSubscript().run(),
        active: editor.isActive("subscript"),
      },
      {
        label: "Superscript",
        icon: Superscript,
        action: () => editor.chain().focus().toggleSuperscript().run(),
        active: editor.isActive("superscript"),
      },
    ],
    [
      {
        label: "Bullet list",
        icon: ListIcon,
        action: () => editor.chain().focus().toggleBulletList().run(),
        active: editor.isActive("bulletList"),
      },
      {
        label: "Numbered list",
        icon: ListOrdered,
        action: () => editor.chain().focus().toggleOrderedList().run(),
        active: editor.isActive("orderedList"),
      },
      {
        label: "Checklist",
        icon: ListChecks,
        action: () => editor.chain().focus().toggleTaskList().run(),
        active: editor.isActive("taskList"),
      },
    ],
    [
      {
        label: "Align left",
        icon: AlignLeft,
        action: () => editor.chain().focus().setTextAlign("left").run(),
        active: editor.isActive({ textAlign: "left" }),
      },
      {
        label: "Align center",
        icon: AlignCenter,
        action: () => editor.chain().focus().setTextAlign("center").run(),
        active: editor.isActive({ textAlign: "center" }),
      },
      {
        label: "Align right",
        icon: AlignRight,
        action: () => editor.chain().focus().setTextAlign("right").run(),
        active: editor.isActive({ textAlign: "right" }),
      },
    ],
    [
      {
        label: "Link",
        icon: Link2,
        action: () => openInsertDialog("link"),
        active: editor.isActive("link"),
      },
      {
        label: "Image",
        icon: ImageIcon,
        action: () => openInsertDialog("image"),
      },
      {
        label: "YouTube",
        icon: Youtube,
        action: () => openInsertDialog("youtube"),
      },
      {
        label: "Audio",
        icon: Music2,
        action: () => openInsertDialog("audio"),
      },
      {
        label: "Twitch",
        icon: TwitchIcon,
        action: () => openInsertDialog("twitch"),
      },
      {
        label: "Details",
        icon: ListTree,
        action: () => editor.chain().focus().setDetails().run(),
        active: editor.isActive("details"),
      },
      {
        label: "Math",
        icon: Sigma,
        action: () => openInsertDialog("math"),
      },
      {
        label: "Emoji",
        icon: Smile,
        action: () => openInsertDialog("emoji"),
      },
      {
        label: "Mention",
        icon: AtSign,
        action: () => insertMention(editor, currentMention),
      },
      {
        label: "Comment",
        icon: MessageSquare,
        action: onComment,
      },
      {
        label: "Track changes",
        icon: Check,
        action: () => {
          editor.commands.toggleTrackChanges();
          setTrackChanges(Boolean(editor.storage.trackChanges?.enabled));
        },
        active: trackChanges,
      },
      {
        label: "Invisible characters",
        icon: EyeOff,
        action: () => {
          editor.commands.toggleInvisibleCharacters();
          setInvisibleCharacters(Boolean(editor.storage.invisibleCharacters?.visibility?.()));
        },
        active: invisibleCharacters,
      },
    ],
  ];
}

function TiptapDocumentEditor({
  document,
  userId,
  userName,
  colors,
  isDark,
  loading,
  error,
  onSave,
  suggestions = [],
  suggestionsLoading = false,
  suggestionsError = null,
  onSuggestionCreate,
  onSuggestionResolve,
  comments = [],
  commentsLoading = false,
  commentsError = null,
  onCommentCreate,
  onCommentResolve,
  mentionOptions: externalMentionOptions = [],
  mentionOptionsLoading = false,
  mentionOptionsError = null,
  onMediaUpload,
  collaboration = null,
  readOnly = false,
  readOnlyReason = null,
}: TiptapDocumentEditorProps) {
  const [title, setTitle] = useState(document.title);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveTrigger, setSaveTrigger] = useState<SaveTrigger | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [changeSerial, setChangeSerial] = useState(0);
  const [trackChanges, setTrackChanges] = useState(false);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchorDraft | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);
  const [pageSettings, setPageSettings] = useState<TiptapPageSettings>(() => pageSettingsFromMetadata(document.metadata));
  const [outlineItems, setOutlineItems] = useState<DocumentOutlineItem[]>([]);
  const [outlineFilter, setOutlineFilter] = useState("");
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [documentSearchSummary, setDocumentSearchSummary] = useState<DocumentSearchSummary>({
    query: "",
    activeIndex: -1,
    resultCount: 0,
  });
  const [codeBlockLanguageValue, setCodeBlockLanguageValue] = useState("");
  const pendingCodeBlockLanguageValueRef = useRef<string | null>(null);
  const [invisibleCharacters, setInvisibleCharacters] = useState(false);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(false);
  const [pagePanelOpen, setPagePanelOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [tableToolsOpen, setTableToolsOpen] = useState(false);
  const [insertDialog, setInsertDialog] = useState<InsertDialogState | null>(null);
  const [markdownImportOpen, setMarkdownImportOpen] = useState(false);
  const [markdownImportValue, setMarkdownImportValue] = useState("");
  const [markdownImportError, setMarkdownImportError] = useState<string | null>(null);
  const [markdownExportOpen, setMarkdownExportOpen] = useState(false);
  const [markdownExportValue, setMarkdownExportValue] = useState("");
  const [markdownExportStatus, setMarkdownExportStatus] = useState<MarkdownExportStatus | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<TiptapCollaborationStatus>("disabled");
  const [collaborationSynced, setCollaborationSynced] = useState(false);
  const [collaborationUsers, setCollaborationUsers] = useState<TiptapCollaborationPresenceUser[]>([]);
  const [presencePanelOpen, setPresencePanelOpen] = useState(false);
  const [offlineDraftNotice, setOfflineDraftNotice] = useState<TiptapOfflineDraftNotice | null>(null);
  const [mediaNotice, setMediaNotice] = useState<TiptapMediaNotice | null>(null);
  const [blockLinkNotice, setBlockLinkNotice] = useState<TiptapBlockLinkNotice | null>(null);
  const [blockActionMenuOpen, setBlockActionMenuOpen] = useState(false);
  const titleRef = useRef(document.title);
  const pageSettingsRef = useRef(pageSettings);
  const saveRequestRef = useRef(0);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const hydratedContentSnapshotRef = useRef<string | null>(null);
  const hydratingFromDocumentRef = useRef(false);
  const initialContentSnapshotRef = useRef<string | null>(null);
  const restoredOfflineDraftRef = useRef<string | null>(null);
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const documentSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dragHandleTargetRef = useRef<{ nodeName?: string | null; pos?: number | null } | null>(null);
  const linkedBlockVisitRef = useRef<string | null>(null);
  const restoreEditorFocusAfterMenuCloseRef = useRef(false);
  const outlineUpdateFrameRef = useRef<number | null>(null);
  const presencePanelRef = useRef<HTMLDivElement | null>(null);
  const tableToolsRef = useRef<HTMLDivElement | null>(null);
  const onSuggestionCreateRef = useRef(onSuggestionCreate);
  const onSuggestionResolveRef = useRef(onSuggestionResolve);
  const onCommentCreateRef = useRef(onCommentCreate);
  const onCommentResolveRef = useRef(onCommentResolve);

  const markDirty = useCallback(() => {
    if (readOnly) return;
    setDirty(true);
    setSaveError(null);
    setChangeSerial(serial => serial + 1);
  }, [readOnly]);

  const syncCodeBlockLanguageValue = useCallback((activeEditor: Editor) => {
    const activeCodeBlockLanguage = getActiveCodeBlockLanguage(activeEditor);
    if (activeCodeBlockLanguage) {
      pendingCodeBlockLanguageValueRef.current = null;
      setCodeBlockLanguageValue(activeCodeBlockLanguage);
      return;
    }

    if (pendingCodeBlockLanguageValueRef.current) {
      setCodeBlockLanguageValue(pendingCodeBlockLanguageValueRef.current);
      return;
    }

    if (activeEditor.view.hasFocus()) {
      setCodeBlockLanguageValue("");
    }
  }, []);

  const syncDragHandleAttributes = useCallback((target?: { nodeName?: string | null; pos?: number | null }) => {
    if (target) {
      dragHandleTargetRef.current = target;
    }

    const activeTarget = target || dragHandleTargetRef.current;
    const handle = editorRootRef.current?.querySelector(".streetbot-tiptap-drag-handle") as HTMLElement | null | undefined;
    if (!handle) return;

    handle.setAttribute("aria-label", "Drag block");
    handle.setAttribute("title", "Drag block");
    handle.setAttribute("data-testid", "streetbot-tiptap-drag-handle");
    handle.setAttribute("data-drag-target", activeTarget?.nodeName || "");
    handle.setAttribute("data-drag-target-pos", typeof activeTarget?.pos === "number" ? String(activeTarget.pos) : "");
  }, []);

  const queueOutlineItemsUpdate = useCallback((items: DocumentOutlineItem[]) => {
    if (typeof window === "undefined") {
      setOutlineItems(items);
      return;
    }

    if (outlineUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(outlineUpdateFrameRef.current);
    }

    outlineUpdateFrameRef.current = window.requestAnimationFrame(() => {
      outlineUpdateFrameRef.current = null;
      setOutlineItems(items);
    });
  }, []);

  const updatePageSettings = useCallback((updater: (settings: TiptapPageSettings) => TiptapPageSettings) => {
    setPageSettings(previousSettings => {
      const nextSettings = updater(previousSettings);
      pageSettingsRef.current = nextSettings;
      return nextSettings;
    });
    markDirty();
  }, [markDirty]);

  useEffect(() => {
    onSuggestionCreateRef.current = onSuggestionCreate;
  }, [onSuggestionCreate]);

  useEffect(() => {
    onSuggestionResolveRef.current = onSuggestionResolve;
  }, [onSuggestionResolve]);

  useEffect(() => {
    onCommentCreateRef.current = onCommentCreate;
  }, [onCommentCreate]);

  useEffect(() => {
    onCommentResolveRef.current = onCommentResolve;
  }, [onCommentResolve]);

  useEffect(() => {
    if (!blockLinkNotice || typeof window === "undefined") return undefined;

    const timeoutId = window.setTimeout(() => {
      setBlockLinkNotice(null);
    }, 5200);
    return () => window.clearTimeout(timeoutId);
  }, [blockLinkNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const frame = window.requestAnimationFrame(() => syncDragHandleAttributes());
    return () => window.cancelAnimationFrame(frame);
  }, [syncDragHandleAttributes]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && outlineUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(outlineUpdateFrameRef.current);
      outlineUpdateFrameRef.current = null;
    }
  }, []);

  const initialContent = useMemo(
    () => normalizeTiptapContent(document.content, document.content_text),
    [document.content, document.content_text]
  );
  const initialContentSnapshot = useMemo(() => JSON.stringify(initialContent), [initialContent]);
  useEffect(() => {
    initialContentSnapshotRef.current = initialContentSnapshot;
  }, [initialContentSnapshot]);
  const offlineDraftKey = useMemo(
    () => tiptapOfflineDraftKey(userId, document.id),
    [document.id, userId]
  );
  useEffect(() => {
    setMediaNotice(null);
  }, [document.id]);
  useEffect(() => {
    setBlockActionMenuOpen(false);
  }, [document.id, readOnly]);
  useEffect(() => {
    setTableToolsOpen(false);
  }, [document.id, readOnly]);
  useEffect(() => {
    setOutlineFilter("");
    setDocumentSearchOpen(false);
    setDocumentSearchQuery("");
    setDocumentSearchSummary({
      query: "",
      activeIndex: -1,
      resultCount: 0,
    });
  }, [document.id]);
  const documentPageSettings = useMemo(
    () => pageSettingsFromMetadata(document.metadata),
    [document.metadata]
  );
  const currentPageGeometry = useMemo(() => pageGeometry(pageSettings), [pageSettings]);
  const currentPageMargins = useMemo(() => ({
    top: Math.round(pageSettings.margins.top * PAGE_RENDER_SCALE),
    right: Math.round(pageSettings.margins.right * PAGE_RENDER_SCALE),
    bottom: Math.round(pageSettings.margins.bottom * PAGE_RENDER_SCALE),
    left: Math.round(pageSettings.margins.left * PAGE_RENDER_SCALE),
  }), [pageSettings]);
  const twitchParent = useMemo(() => getTwitchParent(), []);
  const editorMinHeight = Math.max(
    360,
    currentPageGeometry.heightPx - currentPageMargins.top - currentPageMargins.bottom - 96
  );
  const pageSizeLabel = PAGE_SIZE_OPTIONS.find(option => option.value === pageSettings.size)?.label || "Letter";
  const currentMention = useMemo<TiptapMentionOption>(() => {
    const label = (userName || "Street Voices").trim() || "Street Voices";
    return {
      id: userId || "current-user",
      label,
      description: "You",
    };
  }, [userId, userName]);
  const openInsertDialogAtRange = useCallback((activeEditor: Editor, range: SlashCommandRange, kind: InsertDialogKind) => {
    const previousValue = kind === "link"
      ? (activeEditor.getAttributes("link").href as string | undefined) || ""
      : "";
    activeEditor.chain().focus().deleteRange(range).run();
    const insertPosition = Math.min(range.from, activeEditor.state.doc.content.size);
    setInsertDialog(createInsertDialogState(kind, previousValue, insertPosition));
  }, []);
  const slashCommandItems = useMemo(
    () => createSlashCommandItems({ currentMention, openInsertDialogAtRange }),
    [currentMention, openInsertDialogAtRange]
  );
  const filteredOutlineItems = useMemo(
    () => filterDocumentOutlineItems(outlineItems, outlineFilter),
    [outlineFilter, outlineItems]
  );
  const outlineFilterActive = outlineFilter.trim().length > 0;
  const collaborationSession = useMemo<TiptapCollaborationSession | null>(() => {
    if (
      !collaboration?.enabled ||
      !collaboration.websocketUrl ||
      !collaboration.roomName ||
      typeof window === "undefined"
    ) {
      return null;
    }

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(collaboration.websocketUrl, collaboration.roomName, doc, {
      params: {
        user_id: collaboration.user.id,
        ...(collaboration.roomToken ? { room_token: collaboration.roomToken } : {}),
      },
    });

    provider.awareness.setLocalStateField("user", collaboration.user);

    return {
      doc,
      provider,
      roomName: collaboration.roomName,
      websocketUrl: collaboration.websocketUrl,
      user: collaboration.user,
    };
  }, [
    collaboration?.enabled,
    collaboration?.roomName,
    collaboration?.roomToken,
    collaboration?.user.color,
    collaboration?.user.id,
    collaboration?.user.name,
    collaboration?.websocketUrl,
  ]);
  const collaborationActive = Boolean(collaborationSession);
  const localCollaborationPresence = useMemo(
    () => collaborationPresenceForState(collaborationStatus, collaborationSynced, readOnly),
    [collaborationStatus, collaborationSynced, readOnly]
  );
  const mentionOptions = useMemo<TiptapMentionOption[]>(() => {
    const seededMentions: TiptapMentionOption[] = [
      currentMention,
      { id: "reviewer", label: "Reviewer", description: "Review role" },
      { id: "program-lead", label: "Program Lead", description: "Program role" },
      { id: "document-owner", label: "Document Owner", description: "Ownership role" },
    ];
    return [...externalMentionOptions, ...seededMentions]
      .map(mention => ({
        ...mention,
        id: mention.id.trim(),
        label: mention.label.trim(),
        description: mention.description?.trim(),
      }))
      .filter(mention => mention.id && mention.label)
      .filter((mention, index, mentions) =>
        mentions.findIndex(candidate => (
          candidate.id === mention.id ||
          candidate.label.toLowerCase() === mention.label.toLowerCase()
        )) === index
      );
  }, [currentMention, externalMentionOptions]);

  const pendingSuggestions = useMemo(
    () => suggestions
      .filter(suggestion => suggestion.status === "pending")
      .sort((a, b) => normalizeSuggestionDate(b.createdAt) - normalizeSuggestionDate(a.createdAt)),
    [suggestions]
  );
  const activeComments = useMemo(
    () => comments
      .filter(comment => !comment.isResolved)
      .sort((a, b) => normalizeSuggestionDate(b.createdAt) - normalizeSuggestionDate(a.createdAt)),
    [comments]
  );

  useEffect(() => {
    if (!collaborationSession) {
      setCollaborationStatus("disabled");
      setCollaborationSynced(false);
      setCollaborationUsers([]);
      setPresencePanelOpen(false);
      return;
    }

    const { doc, provider } = collaborationSession;

    const refreshUsers = () => {
      const users = Array.from(provider.awareness.getStates().entries())
        .filter(([clientId]) => clientId !== doc.clientID)
        .map(([clientId, state]) => parseCollaborationPresenceUser(clientId, state))
        .filter((user): user is TiptapCollaborationPresenceUser => Boolean(user))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCollaborationUsers(users);
    };
    const handleStatus = (event: { status: "connected" | "disconnected" | "connecting" }) => {
      setCollaborationStatus(event.status);
    };
    const handleSync = (synced: boolean) => {
      setCollaborationSynced(synced);
    };
    const handleConnectionError = () => {
      setCollaborationStatus("error");
    };

    setCollaborationStatus(provider.wsconnected ? "connected" : "connecting");
    setCollaborationSynced(provider.synced);
    refreshUsers();
    provider.on("status", handleStatus);
    provider.on("sync", handleSync);
    provider.on("connection-error", handleConnectionError);
    provider.awareness.on("update", refreshUsers);

    return () => {
      provider.off("status", handleStatus);
      provider.off("sync", handleSync);
      provider.off("connection-error", handleConnectionError);
      provider.awareness.off("update", refreshUsers);
      provider.disconnect();
      (provider as { destroy?: () => void }).destroy?.();
      doc.destroy();
    };
  }, [collaborationSession]);

  useEffect(() => {
    if (!collaborationSession) return;

    collaborationSession.provider.awareness.setLocalStateField("presence", {
      mode: localCollaborationPresence.mode,
      label: localCollaborationPresence.label,
      updatedAt: new Date().toISOString(),
      readOnly,
      ...(readOnlyReason ? { readOnlyReason } : {}),
    });
  }, [
    collaborationSession,
    localCollaborationPresence.label,
    localCollaborationPresence.mode,
    readOnly,
    readOnlyReason,
  ]);

  useEffect(() => {
    if (!presencePanelOpen || typeof window === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      const panel = presencePanelRef.current;
      if (!panel || panel.contains(event.target as Node)) return;
      setPresencePanelOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPresencePanelOpen(false);
      }
    };

    window.document.addEventListener("mousedown", handlePointerDown);
    window.document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.document.removeEventListener("mousedown", handlePointerDown);
      window.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [presencePanelOpen]);

  useEffect(() => {
    if (!tableToolsOpen || typeof window === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      const panel = tableToolsRef.current;
      if (!panel || panel.contains(event.target as Node)) return;
      setTableToolsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTableToolsOpen(false);
      }
    };

    window.document.addEventListener("click", handleClick);
    window.document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.document.removeEventListener("click", handleClick);
      window.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tableToolsOpen]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        bulletList: false,
        codeBlock: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        underline: false,
        undoRedo: collaborationActive ? false : undefined,
      }),
      ...(collaborationSession
        ? [
            Collaboration.configure({
              document: collaborationSession.doc,
              field: "default",
              provider: collaborationSession.provider,
            }),
            CollaborationCaret.configure({
              provider: collaborationSession.provider,
              user: collaborationSession.user,
              render: createCollaborationCaretElement,
              selectionRender: createCollaborationSelectionAttrs,
            }),
          ]
        : []),
      ListKit.configure({
        taskItem: {
          nested: true,
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
        enableTabIndentation: true,
      }),
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        defaultProtocol: "https",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      SubscriptExtension,
      SuperscriptExtension,
      TextStyleKit.configure({
        textStyle: {},
        color: {},
        backgroundColor: {},
        fontFamily: {},
        fontSize: {},
        lineHeight: {},
      }),
      TableKit.configure({
        table: {
          resizable: true,
          renderWrapper: true,
          allowTableNodeSelection: true,
        },
      }),
      TiptapImage.configure({
        allowBase64: true,
        resize: {
          enabled: true,
          minWidth: 80,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      YoutubeExtension.configure({
        width: 640,
        height: 360,
        controls: true,
      }),
      AudioExtension.configure({
        allowBase64: true,
        controls: true,
        preload: "metadata",
        HTMLAttributes: {
          class: "streetbot-tiptap-audio",
        },
      }),
      TwitchExtension.configure({
        width: 640,
        height: 360,
        parent: twitchParent,
        allowFullscreen: true,
        muted: false,
      }),
      StreetbotCallout,
      Details.configure({
        persist: true,
      }),
      DetailsSummary,
      DetailsContent,
      Emoji,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "streetbot-tiptap-mention",
        },
        suggestion: {
          char: "@",
          decorationClass: "streetbot-tiptap-mention-query",
          items: ({ query }) => {
            const normalizedQuery = query.trim().toLowerCase();
            return mentionOptions
              .filter(mention => {
                const searchableText = `${mention.label} ${mention.description || ""}`.toLowerCase();
                return searchableText.includes(normalizedQuery);
              })
              .slice(0, 6);
          },
          command: ({ editor: activeEditor, range, props }) => {
            const mention = props as TiptapMentionOption;
            activeEditor
              .chain()
              .focus()
              .insertContentAt(range, [mentionNode(mention), { type: "text", text: " " }])
              .run();
          },
          render: createMentionSuggestionRenderer,
        },
      }),
      InvisibleCharacters.configure({
        visible: false,
      }),
	      FileHandler.configure({
	        allowedMimeTypes: MEDIA_MIME_TYPES,
	        onDrop: (activeEditor, files, position) => {
	          void insertMediaFiles(activeEditor, files, { position, uploadMedia: onMediaUpload, onNotice: setMediaNotice });
	        },
        onPaste: (activeEditor, files) => {
	          void insertMediaFiles(activeEditor, files, { uploadMedia: onMediaUpload, onNotice: setMediaNotice });
	        },
	      }),
	      SlashCommandExtension.configure({
	        items: slashCommandItems,
	      }),
	      UniqueID.configure({
	        types: ["heading", "paragraph", "streetbotCallout", "table", "image", "audio", "youtube", "twitch", "details", "blockMath"],
	      }),
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate: (data) => {
          queueOutlineItemsUpdate(outlineFromTableOfContents(data));
        },
      }),
      Markdown,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading";
          return "Start writing...";
        },
      }),
      CharacterCount.configure({
        wordCounter: (text) => text.split(/\s+/).filter(word => word !== "").length,
      }),
      Selection,
      DocumentSearchExtension,
      Focus.configure({
        className: "streetbot-tiptap-focused-node",
        mode: "deepest",
      }),
      CommentAnchorMark,
      InsertionMark,
      DeletionMark,
      TrackChangesExtension.configure({
        enabled: false,
        userId,
        userName: userName || "Street Voices",
        userColor: "#2563eb",
        onSuggestionCreate: (suggestion) => {
          void onSuggestionCreateRef.current?.(suggestion);
        },
        onSuggestionResolve: (suggestionId, action) => {
          void onSuggestionResolveRef.current?.(suggestionId, action);
        },
      }),
    ],
	    [collaborationActive, collaborationSession, mentionOptions, onMediaUpload, queueOutlineItemsUpdate, slashCommandItems, twitchParent, userId, userName]
	  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "streetbot-tiptap-editor",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: activeEditor, transaction }) => {
      syncCodeBlockLanguageValue(activeEditor);

      if (readOnly) {
        setSaveError(null);
        setChangeSerial(serial => serial + 1);
        return;
      }

      const collaborationUpdate = collaborationActive && isChangeOrigin(transaction);
      const internalDocumentUpdate =
        hydratingFromDocumentRef.current ||
        (!collaborationUpdate && transaction.getMeta("addToHistory") === false) ||
        transaction.getMeta("__uniqueIDTransaction");

      if (internalDocumentUpdate) {
        setSaveError(null);
        setChangeSerial(serial => serial + 1);
        return;
      }

      if (collaborationUpdate && JSON.stringify(activeEditor.getJSON()) === initialContentSnapshotRef.current) {
        setDirty(false);
        setSaveError(null);
        setChangeSerial(serial => serial + 1);
        return;
      }

      markDirty();
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      syncCodeBlockLanguageValue(activeEditor);
      setChangeSerial(serial => serial + 1);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const getCurrentBlockTarget = useCallback((): TiptapBlockMoveTarget | null => {
    if (!editor || editor.isDestroyed) return null;

    const dragTargetPos = dragHandleTargetRef.current?.pos;
    let targetPos = typeof dragTargetPos === "number" ? dragTargetPos : null;
    let target = targetPos !== null ? findBlockMoveTarget(editor.state.doc, targetPos) : null;

    if (!target) {
      const { $from } = editor.state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.isBlock) {
          targetPos = $from.before(depth);
          target = findBlockMoveTarget(editor.state.doc, targetPos);
          break;
        }
      }
    }

    return target;
  }, [editor]);

  const focusEditorViewSoon = useCallback(() => {
    if (!editor || editor.isDestroyed) return;

    const focusEditor = () => {
      if (editor.isDestroyed) return;

      editor.commands.focus();
      editor.view.dom.focus({ preventScroll: true });
      editor.view.focus();
    };

    focusEditor();

    if (typeof window !== "undefined") {
      window.setTimeout(focusEditor, 0);
      window.setTimeout(focusEditor, 40);
      window.requestAnimationFrame(focusEditor);
    }
  }, [editor]);

  const closeBlockActionMenuAndRestoreFocus = useCallback(() => {
    restoreEditorFocusAfterMenuCloseRef.current = true;
    setBlockActionMenuOpen(false);
    focusEditorViewSoon();
  }, [focusEditorViewSoon]);

  useEffect(() => {
    if (blockActionMenuOpen || !restoreEditorFocusAfterMenuCloseRef.current) return;

    restoreEditorFocusAfterMenuCloseRef.current = false;
    focusEditorViewSoon();
  }, [blockActionMenuOpen, focusEditorViewSoon]);

  useEffect(() => {
    if (!commentComposerOpen) return;

    const focusCommentComposer = () => {
      commentTextareaRef.current?.focus({ preventScroll: true });
    };

    focusCommentComposer();

    if (typeof window !== "undefined") {
      window.setTimeout(focusCommentComposer, 0);
      window.requestAnimationFrame(focusCommentComposer);
    }
  }, [commentComposerOpen]);

  const handleBlockActionButtonPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleBlockActionButtonMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const moveActiveBlock = useCallback((direction: "up" | "down"): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    const siblingIndex = direction === "up" ? target.index - 1 : target.index + 1;
    if (siblingIndex < 0 || siblingIndex >= target.parent.childCount) return false;

    const sibling = target.parent.child(siblingIndex);
    const targetFrom = target.pos;
    const targetTo = target.pos + target.node.nodeSize;
    const replaceFrom = direction === "up" ? targetFrom - sibling.nodeSize : targetFrom;
    const replaceTo = direction === "up" ? targetTo : targetTo + sibling.nodeSize;
    const movedPos = direction === "up" ? replaceFrom : targetFrom + sibling.nodeSize;
    const replacement = direction === "up"
      ? Fragment.fromArray([target.node, sibling])
      : Fragment.fromArray([sibling, target.node]);

    try {
      const transaction = editor.state.tr.replaceWith(replaceFrom, replaceTo, replacement);
      const movedNode = transaction.doc.nodeAt(movedPos);

      if (movedNode && NodeSelection.isSelectable(movedNode)) {
        transaction.setSelection(NodeSelection.create(transaction.doc, movedPos));
      } else {
        const textPosition = Math.min(Math.max(movedPos + 1, 0), transaction.doc.content.size);
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(textPosition), 1));
      }

      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: target.node.type.name, pos: movedPos };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const duplicateActiveBlock = useCallback((): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    try {
      const duplicate = duplicateProseMirrorNodeWithoutUniqueIds(editor, target.node);
      const insertPos = target.pos + target.node.nodeSize;
      const transaction = editor.state.tr.insert(insertPos, duplicate);
      setSelectionNearPosition(transaction, insertPos + 1);
      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: duplicate.type.name, pos: insertPos };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const insertParagraphNearActiveBlock = useCallback((placement: "above" | "below"): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    const paragraph = editor.schema.nodes.paragraph?.create();
    if (!target || !paragraph) return false;

    try {
      const insertPos = placement === "above" ? target.pos : target.pos + target.node.nodeSize;
      const transaction = editor.state.tr.insert(insertPos, paragraph);
      setSelectionNearPosition(transaction, insertPos + 1);
      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: paragraph.type.name, pos: insertPos };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const deleteActiveBlock = useCallback((): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    try {
      const targetFrom = target.pos;
      const targetTo = target.pos + target.node.nodeSize;
      const paragraph = editor.schema.nodes.paragraph?.create();
      const transaction = target.parent.childCount <= 1 && paragraph
        ? editor.state.tr.replaceWith(targetFrom, targetTo, paragraph)
        : editor.state.tr.delete(targetFrom, targetTo);

      setSelectionNearPosition(transaction, Math.min(targetFrom + 1, transaction.doc.content.size));
      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: paragraph?.type.name || null, pos: targetFrom };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const selectActiveBlock = useCallback((): boolean => {
    if (!editor || editor.isDestroyed) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    try {
      const transaction = editor.state.tr;

      if (NodeSelection.isSelectable(target.node)) {
        transaction.setSelection(NodeSelection.create(transaction.doc, target.pos));
      } else if (target.node.content.size > 0) {
        const from = Math.min(target.pos + 1, transaction.doc.content.size);
        const to = Math.min(target.pos + target.node.nodeSize - 1, transaction.doc.content.size);
        transaction.setSelection(TextSelection.create(transaction.doc, from, Math.max(from, to)));
      } else {
        setSelectionNearPosition(transaction, target.pos + 1);
      }

      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: target.node.type.name, pos: target.pos };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, syncDragHandleAttributes]);

  const openBlockCommentComposer = useCallback((): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    const anchorText = target.node.textContent.trim().replace(/\s+/g, " ");
    setCommentAnchor({
      anchorType: "block",
      anchorFrom: target.pos,
      anchorTo: target.pos + target.node.nodeSize,
      anchorText: anchorText || target.node.type.name,
    });
    setCommentDraft("");
    setCommentSubmitError(null);
    setCommentComposerOpen(true);
    restoreEditorFocusAfterMenuCloseRef.current = false;
    setBlockActionMenuOpen(false);
    return true;
  }, [editor, getCurrentBlockTarget, readOnly]);

  const copyActiveBlockLink = useCallback(async (): Promise<boolean> => {
    if (!editor || editor.isDestroyed) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    const blockReference = ensureBlockTargetId(editor, target);
    const href = blockReference ? buildBlockLinkHref(document.id, blockReference.id) : null;

    if (!blockReference || !href) {
      setBlockLinkNotice({
        kind: "error",
        message: "This block cannot be linked yet.",
      });
      closeBlockActionMenuAndRestoreFocus();
      return false;
    }

    setBlockLinkNotice({
      kind: "success",
      message: "Block link copied.",
      href,
    });
    void copyTextToClipboard(href).then(copied => {
      if (!copied) {
        setBlockLinkNotice({
          kind: "error",
          message: "Block link is ready, but clipboard access was blocked.",
          href,
        });
      }
    });

    dragHandleTargetRef.current = { nodeName: blockReference.node.type.name, pos: blockReference.pos };
    syncDragHandleAttributes(dragHandleTargetRef.current);
    closeBlockActionMenuAndRestoreFocus();
    return true;
  }, [closeBlockActionMenuAndRestoreFocus, document.id, editor, getCurrentBlockTarget, syncDragHandleAttributes]);

  const applyStyleToActiveBlock = useCallback((kind: "text" | "background", color: string): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    const range = getTextRangeInsideBlock(target, editor.state.doc.content.size);
    if (!range) return false;

    const chain = editor.chain().focus().setTextSelection({ from: range.from, to: range.to });
    const applied = kind === "text"
      ? chain.setColor(color).run()
      : chain.setBackgroundColor(color).run();

    if (!applied) return false;

    dragHandleTargetRef.current = { nodeName: target.node.type.name, pos: target.pos };
    syncDragHandleAttributes(dragHandleTargetRef.current);
    closeBlockActionMenuAndRestoreFocus();
    return true;
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const transformActiveBlockFromHandle = useCallback((kind: BlockTransformKind): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;

    const target = getCurrentBlockTarget();
    if (!target) return false;

    try {
      const transaction = editor.state.tr;
      setSelectionNearPosition(transaction, target.pos + 1);
      editor.view.dispatch(transaction.scrollIntoView());
      dragHandleTargetRef.current = { nodeName: target.node.type.name, pos: target.pos };
      syncDragHandleAttributes(dragHandleTargetRef.current);
      applyBlockTransform(editor, kind);
      closeBlockActionMenuAndRestoreFocus();
      return true;
    } catch (error) {
      return false;
    }
  }, [closeBlockActionMenuAndRestoreFocus, editor, getCurrentBlockTarget, readOnly, syncDragHandleAttributes]);

  const handleDragHandleNodeChange = useCallback(({ node, pos }: {
    node: ProseMirrorNode | null;
    pos: number;
  }) => {
    syncDragHandleAttributes({ nodeName: node?.type.name || null, pos });
  }, [syncDragHandleAttributes]);

  const handleDragHandleElementChange = useCallback(() => {
    syncDragHandleAttributes();
  }, [syncDragHandleAttributes]);

  const editorCounts = useMemo(
    () => getEditorCounts(editor || null),
    [changeSerial, document.id, editor, initialContentSnapshot]
  );
  const printPreviewHtml = editor?.getHTML() || "";

  const buildSavePayload = useCallback((): TiptapSavePayload | null => {
    if (!editor) return null;
    const contentText = editor.getText();
    const counts = getEditorCounts(editor);
    return {
      title: titleRef.current.trim() || "Untitled document",
      content: editor.getJSON(),
      contentText,
      wordCount: counts.words,
      pageSettings: pageSettingsRef.current,
      baseUpdatedAt: document.updated_at || null,
    };
  }, [document.updated_at, editor]);

  const persistOfflineDraft = useCallback((payload: TiptapSavePayload, noticeKind: TiptapOfflineDraftNotice["kind"] = "saved") => {
    const savedAt = new Date().toISOString();
    const saved = writeTiptapOfflineDraft(offlineDraftKey, {
      ...payload,
      version: 1,
      documentId: document.id,
      userId,
      savedAt,
      baseUpdatedAt: payload.baseUpdatedAt || document.updated_at || null,
      baseSnapshot: initialContentSnapshot,
    });

    if (saved) {
      setOfflineDraftNotice({ kind: noticeKind, savedAt });
    }
  }, [document.id, document.updated_at, initialContentSnapshot, offlineDraftKey, userId]);

  const clearOfflineDraft = useCallback(() => {
    deleteTiptapOfflineDraft(offlineDraftKey);
    setOfflineDraftNotice(null);
  }, [offlineDraftKey]);

  const handleSave = useCallback(async (trigger: SaveTrigger = "manual") => {
    if (saving || readOnly) return;
    const payload = buildSavePayload();
    if (!payload) return;

    const requestId = saveRequestRef.current + 1;
    const requestSnapshot = saveSnapshot(payload);
    saveRequestRef.current = requestId;

    setSaving(true);
    setSaveTrigger(trigger);
    setSaveError(null);
    try {
      await onSave(payload);
      const latestPayload = buildSavePayload();
      const latestSnapshot = latestPayload ? saveSnapshot(latestPayload) : requestSnapshot;
      if (latestSnapshot === requestSnapshot) {
        clearOfflineDraft();
      } else if (latestPayload) {
        persistOfflineDraft(latestPayload);
      }
      setDirty(latestSnapshot !== requestSnapshot);
    } catch (err) {
      console.error("Failed to save Tiptap document:", err);
      const isConflict = isTiptapDocumentSaveConflict(err);
      persistOfflineDraft(payload, isConflict ? "conflict" : "saved");
      setSaveError(isConflict ? "Conflict detected" : "Save failed");
    } finally {
      if (saveRequestRef.current === requestId) {
        setSaving(false);
        setSaveTrigger(null);
      }
    }
  }, [buildSavePayload, clearOfflineDraft, onSave, persistOfflineDraft, readOnly, saving]);

  useEffect(() => {
    const isNewDocument = loadedDocumentIdRef.current !== document.id;
    const previousHydratedSnapshot = hydratedContentSnapshotRef.current;
    const incomingContentChanged = isNewDocument || previousHydratedSnapshot !== initialContentSnapshot;
    const editorIsStillEmptyStarter =
      Boolean(editor?.isEmpty || !editor?.getText().trim()) &&
      (previousHydratedSnapshot === null || previousHydratedSnapshot === emptyDocumentSnapshot);
    const collaborationFragmentHasContent =
      Boolean(collaborationSession?.doc.getXmlFragment("default").length);
    const initialDocumentHasContent = initialContentSnapshot !== emptyDocumentSnapshot;
    const canHydrateCollaborationContent =
      !collaborationActive ||
      (
        collaborationSynced &&
        editorIsStillEmptyStarter &&
        (!collaborationFragmentHasContent || initialDocumentHasContent)
      );
    const canRefreshDocumentChrome = isNewDocument || (!dirty && !saving) || editorIsStillEmptyStarter;
    const canHydrateContent =
      Boolean(editor) &&
      incomingContentChanged &&
      (isNewDocument || !dirty || editorIsStillEmptyStarter) &&
      canHydrateCollaborationContent;

    if (canRefreshDocumentChrome) {
      setTitle(document.title);
      titleRef.current = document.title;
      setPageSettings(documentPageSettings);
      pageSettingsRef.current = documentPageSettings;
    }

    if (!editor) return;

    let hydratedContent = false;
    if (canHydrateContent) {
      hydratingFromDocumentRef.current = true;
      try {
        editor.commands.setContent(initialContent, { emitUpdate: false });
      } finally {
        hydratingFromDocumentRef.current = false;
      }
      hydratedContentSnapshotRef.current = initialContentSnapshot;
      hydratedContent = true;
    }
    editor.commands.updateTableOfContents();

    if (isNewDocument) {
      loadedDocumentIdRef.current = document.id;
      setDirty(false);
      setSaveError(null);
      setChangeSerial(hydratedContent ? 1 : 0);
      setTrackChanges(false);
      setCommentComposerOpen(false);
      setCommentAnchor(null);
      setCommentDraft("");
      setCommentSubmitError(null);
      setInvisibleCharacters(false);
      setOutlineItems(getDocumentOutline(editor));
      editor.commands.hideInvisibleCharacters();
      setOutlinePanelOpen(false);
      setPagePanelOpen(false);
      setDocumentSearchOpen(false);
      setDocumentSearchQuery("");
      setDocumentSearchSummary({
        query: "",
        activeIndex: -1,
        resultCount: 0,
      });
      updateDocumentSearchState(editor, "", -1, false);
      setPrintPreviewOpen(false);
      setInsertDialog(null);
      setMarkdownImportOpen(false);
      setMarkdownImportValue("");
      setMarkdownImportError(null);
      setMarkdownExportOpen(false);
      setMarkdownExportValue("");
      setMarkdownExportStatus(null);
      setBlockLinkNotice(null);
      linkedBlockVisitRef.current = null;
    } else if (hydratedContent) {
      if (editorIsStillEmptyStarter) {
        setDirty(false);
        setSaveError(null);
      }
      setChangeSerial(serial => serial + 1);
      setOutlineItems(getDocumentOutline(editor));
    }
  }, [
    collaborationActive,
    collaborationSession,
    collaborationSynced,
    dirty,
    document.id,
    document.title,
    documentPageSettings,
    editor,
    initialContent,
    initialContentSnapshot,
    saving,
  ]);

  const focusLinkedBlockFromHash = useCallback((force = false): boolean => {
    if (!editor || editor.isDestroyed || typeof window === "undefined") return false;

    const blockId = blockIdFromLocationHash(window.location.hash);
    if (!blockId) return false;

    const visitKey = `${document.id}:${blockId}:${hydratedContentSnapshotRef.current || ""}`;
    if (!force && linkedBlockVisitRef.current === visitKey) return true;

    const focused = scrollToBlockId(editor, blockId);
    if (focused) {
      linkedBlockVisitRef.current = visitKey;
    }
    return focused;
  }, [document.id, editor]);

  useEffect(() => {
    if (!editor || typeof window === "undefined") return undefined;

    const timeoutId = window.setTimeout(() => {
      focusLinkedBlockFromHash(false);
    }, 160);
    return () => window.clearTimeout(timeoutId);
  }, [changeSerial, document.id, editor, focusLinkedBlockFromHash]);

  useEffect(() => {
    if (!editor || typeof window === "undefined") return undefined;

    const handleHashChange = () => {
      linkedBlockVisitRef.current = null;
      window.setTimeout(() => {
        focusLinkedBlockFromHash(true);
      }, 40);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [editor, focusLinkedBlockFromHash]);

  useEffect(() => {
    if (!editor || readOnly) return;

    const restoreKey = `${offlineDraftKey}:${initialContentSnapshot}:${document.updated_at || ""}`;
    if (restoredOfflineDraftRef.current === restoreKey) return;
    restoredOfflineDraftRef.current = restoreKey;

    const draft = readTiptapOfflineDraft(offlineDraftKey, document.id, userId);
    if (!draft || !shouldRestoreTiptapOfflineDraft(draft, initialContentSnapshot, document.updated_at)) {
      return;
    }

    const draftContent = normalizeTiptapContent(draft.content, draft.contentText);
    const draftPageSettings = pageSettingsFromMetadata({
      [TIPTAP_PAGE_SETTINGS_METADATA_KEY]: draft.pageSettings,
    });
    const draftPayload: TiptapSavePayload = {
      title: draft.title,
      content: draftContent,
      contentText: draft.contentText,
      wordCount: draft.wordCount,
      pageSettings: draftPageSettings,
      baseUpdatedAt: draft.baseUpdatedAt,
    };
    const serverPayload: TiptapSavePayload = {
      title: document.title,
      content: initialContent,
      contentText: document.content_text || "",
      wordCount: countWords(document.content_text || ""),
      pageSettings: documentPageSettings,
      baseUpdatedAt: document.updated_at || null,
    };

    if (saveSnapshot(draftPayload) === saveSnapshot(serverPayload)) {
      clearOfflineDraft();
      return;
    }

    hydratingFromDocumentRef.current = true;
    try {
      editor.commands.setContent(draftContent, { emitUpdate: false });
    } finally {
      hydratingFromDocumentRef.current = false;
    }

    setTitle(draft.title);
    titleRef.current = draft.title;
    setPageSettings(draftPageSettings);
    pageSettingsRef.current = draftPageSettings;
    setDirty(true);
    setSaveError(null);
    setOfflineDraftNotice({ kind: "restored", savedAt: draft.savedAt });
    setChangeSerial(serial => serial + 1);
    setOutlineItems(getDocumentOutline(editor));
    editor.commands.updateTableOfContents();
  }, [
    clearOfflineDraft,
    document.content_text,
    document.id,
    document.title,
    document.updated_at,
    documentPageSettings,
    editor,
    initialContent,
    initialContentSnapshot,
    offlineDraftKey,
    readOnly,
    userId,
  ]);

  useEffect(() => {
    if (readOnly || !dirty || saving || !editor) return;

    const timeout = window.setTimeout(() => {
      const payload = buildSavePayload();
      if (payload) {
        persistOfflineDraft(payload);
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [buildSavePayload, changeSerial, dirty, editor, persistOfflineDraft, readOnly, saving]);

  useEffect(() => {
    if (readOnly || !dirty || !editor) return;

    const persistBeforePageHide = () => {
      const payload = buildSavePayload();
      if (payload) {
        persistOfflineDraft(payload);
      }
    };

    window.addEventListener("pagehide", persistBeforePageHide);
    return () => window.removeEventListener("pagehide", persistBeforePageHide);
  }, [buildSavePayload, dirty, editor, persistOfflineDraft, readOnly]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setTrackChangesUser(userId, userName || "Street Voices", "#2563eb");
  }, [editor, userId, userName]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.updateTableOfContents();
  }, [changeSerial, document.id, editor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (readOnly) return;
        void handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, readOnly]);

  useEffect(() => {
    if (readOnly || !dirty || saving || saveError || loading || !editor) return;

    const timeout = window.setTimeout(() => {
      void handleSave("auto");
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [changeSerial, dirty, editor, handleSave, loading, readOnly, saveError, saving]);

  const resolveSuggestion = useCallback((suggestionId: string, action: "accept" | "reject") => {
    if (!editor) return;
    const modified = action === "accept"
      ? editor.commands.acceptSuggestion(suggestionId)
      : editor.commands.rejectSuggestion(suggestionId);

    if (!modified) {
      void onSuggestionResolveRef.current?.(suggestionId, action);
    }
  }, [editor]);

  const resolveAllSuggestions = useCallback((action: "accept" | "reject") => {
    pendingSuggestions.forEach((suggestion) => {
      resolveSuggestion(suggestion.suggestionId, action);
    });
  }, [pendingSuggestions, resolveSuggestion]);

  const openCommentComposer = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const anchorText = empty ? "" : editor.state.doc.textBetween(from, to, " ").trim();

    setCommentAnchor(anchorText
      ? {
          anchorType: "selection",
          anchorFrom: from,
          anchorTo: to,
          anchorText,
        }
      : { anchorType: "document" }
    );
    setCommentDraft("");
    setCommentSubmitError(null);
    setCommentComposerOpen(true);
  }, [editor]);

  const removeCommentAnchorMark = useCallback((commentId: string): boolean => {
    if (!editor) return false;
    const markType = editor.schema.marks.commentAnchor;
    if (!markType) return false;

    const tr = editor.state.tr;
    let modified = false;
    editor.state.doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === "commentAnchor" && mark.attrs.commentId === commentId) {
          tr.removeMark(pos, pos + node.nodeSize, markType);
          modified = true;
        }
      });
    });

    if (modified) {
      editor.view.dispatch(tr);
    }
    return modified;
  }, [editor]);

  const submitComment = useCallback(async () => {
    if (!editor || !commentDraft.trim() || !onCommentCreateRef.current) return;

    const anchor = commentAnchor || { anchorType: "document" as const };
    const payload: TiptapCommentCreatePayload = {
      content: commentDraft.trim(),
      anchorType: anchor.anchorType,
      anchorFrom: anchor.anchorFrom,
      anchorTo: anchor.anchorTo,
      anchorText: anchor.anchorText,
    };

    setCommentSubmitting(true);
    setCommentSubmitError(null);
    try {
      const created = await onCommentCreateRef.current(payload);
      if (created && created.id && payload.anchorType === "selection" && payload.anchorFrom != null && payload.anchorTo != null) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: payload.anchorFrom, to: payload.anchorTo })
          .setMark("commentAnchor", { commentId: created.id })
          .setTextSelection(payload.anchorTo)
          .run();
      }
      setCommentDraft("");
      setCommentAnchor(null);
      setCommentComposerOpen(false);
    } catch (err) {
      console.error("Failed to create comment:", err);
      setCommentSubmitError("Could not add comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentAnchor, commentDraft, editor]);

  const resolveComment = useCallback((commentId: string) => {
    removeCommentAnchorMark(commentId);
    void onCommentResolveRef.current?.(commentId);
  }, [removeCommentAnchorMark]);

  const syncDocumentSearchSummary = useCallback(() => {
    setDocumentSearchSummary(documentSearchSummaryFromState(getDocumentSearchPluginState(editor)));
  }, [editor]);

  const applyDocumentSearchQuery = useCallback((query: string, activeIndex = 0) => {
    setDocumentSearchQuery(query);
    if (!editor) {
      setDocumentSearchSummary({
        query: query.trim(),
        activeIndex: -1,
        resultCount: 0,
      });
      return;
    }

    const nextState = updateDocumentSearchState(editor, query, activeIndex);
    setDocumentSearchSummary(documentSearchSummaryFromState(nextState));
  }, [editor]);

  const clearDocumentSearch = useCallback(() => {
    setDocumentSearchQuery("");
    if (editor) {
      const nextState = updateDocumentSearchState(editor, "", -1, false);
      setDocumentSearchSummary(documentSearchSummaryFromState(nextState));
    } else {
      setDocumentSearchSummary({
        query: "",
        activeIndex: -1,
        resultCount: 0,
      });
    }
  }, [editor]);

  const closeDocumentSearchPanel = useCallback(() => {
    setDocumentSearchOpen(false);
    clearDocumentSearch();
  }, [clearDocumentSearch]);

  const navigateDocumentSearch = useCallback((direction: 1 | -1) => {
    if (!editor) return;
    const nextState = goToDocumentSearchResult(editor, direction);
    if (nextState) {
      setDocumentSearchSummary(documentSearchSummaryFromState(nextState));
      setDocumentSearchQuery(nextState.query);
    }
  }, [editor]);

  useEffect(() => {
    if (!documentSearchOpen || typeof window === "undefined") return undefined;
    const timeoutId = window.setTimeout(() => {
      documentSearchInputRef.current?.focus();
      documentSearchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [documentSearchOpen]);

  useEffect(() => {
    if (!editor || !documentSearchQuery.trim()) return;
    syncDocumentSearchSummary();
  }, [changeSerial, documentSearchQuery, editor, syncDocumentSearchSummary]);

  useEffect(() => {
    if (!editor || typeof window === "undefined") return undefined;

    const handleDocumentSearchShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      setDocumentSearchOpen(true);
      setOutlinePanelOpen(false);
      setPagePanelOpen(false);
    };

    window.addEventListener("keydown", handleDocumentSearchShortcut);
    return () => window.removeEventListener("keydown", handleDocumentSearchShortcut);
  }, [editor]);

  const jumpToOutlineItem = useCallback((item: DocumentOutlineItem) => {
    if (!editor) return;
    const selectionPosition = Math.min(item.position + 1, editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(selectionPosition).scrollIntoView().run();
  }, [editor]);

  const applyTextColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  const applyBackgroundColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setBackgroundColor(color).run();
  }, [editor]);

  const applyFontFamily = useCallback((fontFamily: string) => {
    if (!editor || !fontFamily) return;
    editor.chain().focus().setFontFamily(fontFamily).run();
  }, [editor]);

  const applyFontSize = useCallback((fontSize: string) => {
    if (!editor || !fontSize) return;
    editor.chain().focus().setFontSize(fontSize).run();
  }, [editor]);

  const applyLineHeight = useCallback((lineHeight: string) => {
    if (!editor || !lineHeight) return;
    editor.chain().focus().setLineHeight(lineHeight).run();
  }, [editor]);

  const applyCodeBlockLanguage = useCallback((language: string) => {
    if (!editor || readOnly) return;
    const normalizedLanguage = normalizeCodeBlockLanguage(language);
    const chain = editor.chain().focus();
    pendingCodeBlockLanguageValueRef.current = normalizedLanguage;

    const finishLanguageSync = () => {
      pendingCodeBlockLanguageValueRef.current = null;
      setCodeBlockLanguageValue(getActiveCodeBlockLanguage(editor) || normalizedLanguage);
    };

    if (editor.isActive("codeBlock")) {
      chain.updateAttributes("codeBlock", { language: normalizedLanguage }).run();
      setCodeBlockLanguageValue(normalizedLanguage);
      window.setTimeout(finishLanguageSync, 0);
      return;
    }

    chain.setCodeBlock({ language: normalizedLanguage }).run();
    setCodeBlockLanguageValue(normalizedLanguage);
    window.setTimeout(finishLanguageSync, 0);
  }, [editor, readOnly]);

  const runTableCommand = useCallback((command: (activeEditor: Editor) => boolean | void): boolean => {
    if (!editor || editor.isDestroyed || readOnly) return false;
    return Boolean(command(editor));
  }, [editor, readOnly]);

	  const openInsertDialog = useCallback((kind: InsertDialogKind) => {
	    if (!editor) return;

	    if (kind === "codeBlock" && editor.isActive("codeBlock")) {
	      editor.chain().focus().toggleCodeBlock().run();
	      return;
	    }

	    const previousLink = (editor.getAttributes("link").href as string | undefined) || "";
	    setInsertDialog(createInsertDialogState(kind, kind === "link" ? previousLink : ""));
	  }, [editor]);

  const closeInsertDialog = useCallback(() => {
    setInsertDialog(null);
    editor?.chain().focus().run();
  }, [editor]);

  const openMarkdownImportDialog = useCallback(() => {
    if (!editor || readOnly) return;
    setMarkdownImportOpen(true);
    setMarkdownImportError(null);
  }, [editor, readOnly]);

  const closeMarkdownImportDialog = useCallback(() => {
    setMarkdownImportOpen(false);
    setMarkdownImportError(null);
    editor?.chain().focus().run();
  }, [editor]);

  const submitMarkdownImport = useCallback((mode: MarkdownImportMode) => {
    if (!editor || readOnly) return;

    const markdown = markdownImportValue.trim();
    if (!markdown) {
      setMarkdownImportError("Add Markdown before importing.");
      return;
    }

    try {
      if (mode === "replace") {
        editor.commands.setContent(markdown, { contentType: "markdown" });
      } else {
        editor.chain().focus().insertContent(markdown, { contentType: "markdown" }).run();
      }
      setMarkdownImportOpen(false);
      setMarkdownImportValue("");
      setMarkdownImportError(null);
    } catch (err) {
      console.warn("Could not import Markdown into Tiptap document.", err);
      setMarkdownImportError("That Markdown could not be imported.");
    }
  }, [editor, markdownImportValue, readOnly]);

  const refreshMarkdownExportValue = useCallback((): string | null => {
    if (!editor || editor.isDestroyed) return null;

    try {
      const markdown = editor.getMarkdown();
      setMarkdownExportValue(markdown);
      return markdown;
    } catch (err) {
      console.warn("Could not serialize Tiptap document to Markdown.", err);
      setMarkdownExportStatus({
        kind: "error",
        message: "This document could not be serialized to Markdown.",
      });
      return null;
    }
  }, [editor]);

  const openMarkdownExportDialog = useCallback(() => {
    setMarkdownExportStatus(null);
    const markdown = refreshMarkdownExportValue();
    if (markdown === null) return;
    setMarkdownExportOpen(true);
  }, [refreshMarkdownExportValue]);

  const closeMarkdownExportDialog = useCallback(() => {
    setMarkdownExportOpen(false);
    setMarkdownExportStatus(null);
    editor?.chain().focus().run();
  }, [editor]);

  const copyMarkdownExport = useCallback(async () => {
    const markdown = markdownExportValue || refreshMarkdownExportValue();
    if (markdown === null) return;

    const copied = await copyTextToClipboard(markdown);
    setMarkdownExportStatus(copied
      ? { kind: "success", message: "Markdown copied." }
      : { kind: "error", message: "Clipboard access was blocked." });
  }, [markdownExportValue, refreshMarkdownExportValue]);

  const downloadMarkdownExport = useCallback(() => {
    const markdown = markdownExportValue || refreshMarkdownExportValue();
    if (markdown === null) return;

    const filename = `${sanitizeMarkdownExportFilename(titleRef.current || title || document.title)}.md`;
    const downloaded = downloadMarkdownText(markdown, filename);
    setMarkdownExportStatus(downloaded
      ? { kind: "success", message: `Downloaded ${filename}.` }
      : { kind: "error", message: "Markdown download is unavailable in this environment." });
  }, [document.title, markdownExportValue, refreshMarkdownExportValue, title]);

  const submitInsertDialog = useCallback(() => {
    if (!editor || !insertDialog) return;

	    const value = insertDialog.value.trim();
	    const chain = editor.chain().focus();
	    const getInsertPosition = () => {
	      if (typeof insertDialog.insertPosition === "number") {
	        return Math.min(Math.max(insertDialog.insertPosition, 0), editor.state.doc.content.size);
	      }
	      return Math.min(editor.state.selection.from, editor.state.doc.content.size);
	    };
	    const insertAtSelection = (content: JSONContent) =>
	      editor.chain().focus().insertContentAt(getInsertPosition(), content).run();

    switch (insertDialog.kind) {
	      case "audio":
	        if (value) {
	          insertAtSelection({
	            type: "audio",
	            attrs: {
	              src: value,
              controls: true,
              preload: "metadata",
            },
          });
        }
	        break;
	      case "codeBlock":
	        insertAtSelection({
	          type: "codeBlock",
	          attrs: {
	            language: value || "plaintext",
          },
        });
        break;
      case "emoji":
        if (value) chain.setEmoji(value.replace(/^:|:$/g, "")).run();
        break;
	      case "image":
	        if (value) {
	          insertAtSelection({
	            type: "image",
	            attrs: {
	              src: value,
            },
          });
        }
        break;
      case "link":
        if (value) {
          chain.extendMarkRange("link").setLink({ href: value }).run();
        } else {
          chain.extendMarkRange("link").unsetLink().run();
        }
	        break;
	      case "math":
	        if (value) chain.insertInlineMath({ latex: value, pos: getInsertPosition() }).run();
	        break;
	      case "twitch":
	        if (value) {
	          insertAtSelection({
	            type: "twitch",
	            attrs: {
	              src: value,
              width: 640,
              height: 360,
            },
          });
        }
        break;
	      case "youtube":
	        if (value) {
	          insertAtSelection({
	            type: "youtube",
	            attrs: {
	              src: value,
              width: 640,
              height: 360,
            },
          });
        }
        break;
      default:
        break;
    }

    setInsertDialog(null);
  }, [editor, insertDialog]);

  const discardRestoredOfflineDraft = useCallback(() => {
    clearOfflineDraft();
    if (!editor) return;

    hydratingFromDocumentRef.current = true;
    try {
      editor.commands.setContent(initialContent, { emitUpdate: false });
    } finally {
      hydratingFromDocumentRef.current = false;
    }

    setTitle(document.title);
    titleRef.current = document.title;
    setPageSettings(documentPageSettings);
    pageSettingsRef.current = documentPageSettings;
    setDirty(false);
    setSaveError(null);
    setChangeSerial(serial => serial + 1);
    setOutlineItems(getDocumentOutline(editor));
    editor.commands.updateTableOfContents();
  }, [clearOfflineDraft, document.title, documentPageSettings, editor, initialContent]);

  const toolbar = editor
    ? toolbarFor(
        editor,
        trackChanges,
        setTrackChanges,
        openCommentComposer,
        invisibleCharacters,
        setInvisibleCharacters,
        currentMention,
        openInsertDialog
      )
    : [];
  const tableActive = Boolean(editor?.isActive("table"));
  const codeBlockActive = Boolean(codeBlockLanguageValue);
  const activeCodeBlockLanguage = codeBlockLanguageValue;
  const saveStateLabel = saving
    ? saveTrigger === "auto" ? "Autosaving..." : "Saving..."
    : readOnly
      ? "Read only"
      : saveError
        ? offlineDraftNotice?.kind === "conflict"
          ? "Conflict saved locally"
          : offlineDraftNotice
            ? "Saved locally"
            : saveError
        : (dirty ? "Unsaved changes" : "Saved");
  const offlineDraftTimeLabel = offlineDraftNotice
    ? new Date(offlineDraftNotice.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const collaborationLabel = collaborationStatusLabel(collaborationStatus, collaborationSynced);
  const collaborationIsLive = collaborationStatus === "connected" && collaborationSynced;
  const collaborationPeerLabel = collaborationUsers.length === 0
    ? "Only you"
    : `${collaborationUsers.length} other${collaborationUsers.length === 1 ? "" : "s"}`;
  const visibleCollaborationUsers = collaborationUsers.slice(0, 5);
  const localCollaborationPresenceUser: TiptapCollaborationPresenceUser = {
    id: collaborationSession?.user.id || userId || "current-user",
    name: collaborationSession?.user.name || currentMention.label,
    color: collaborationSession?.user.color || "#2563eb",
    clientId: collaborationSession?.doc.clientID ?? -1,
    mode: localCollaborationPresence.mode,
    label: localCollaborationPresence.label,
    updatedAt: null,
  };
  const collaborationTitle = collaborationSession
    ? `${collaborationLabel} collaboration in ${collaborationSession.roomName}. You are ${localCollaborationPresence.label.toLowerCase()}. ${collaborationPeerLabel}.`
    : `${collaborationLabel} document session. You are ${localCollaborationPresence.label.toLowerCase()}. ${collaborationPeerLabel}.`;
  const showReviewPanel = trackChanges
    || pendingSuggestions.length > 0
    || activeComments.length > 0
    || commentComposerOpen
    || suggestionsLoading
    || commentsLoading
    || Boolean(suggestionsError)
    || Boolean(commentsError);
  const sidePanelStyle: React.CSSProperties = {
    width: "304px",
    flex: "0 0 304px",
    borderLeft: `1px solid ${colors.border}`,
    background: isDark ? "rgba(17,19,24,0.94)" : "rgba(255,255,255,0.92)",
    overflow: "auto",
  };
  const panelSectionStyle: React.CSSProperties = {
    padding: "14px",
    borderBottom: `1px solid ${colors.border}`,
  };
  const segmentedButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: "32px",
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: "7px",
    background: active
      ? isDark ? "rgba(255,214,0,0.16)" : "rgba(59,130,246,0.12)"
      : "transparent",
    color: active ? colors.accent : colors.textSecondary,
    cursor: "pointer",
    fontSize: "0.76rem",
    fontWeight: active ? 800 : 650,
  });
  const marginInputStyle: React.CSSProperties = {
    width: "100%",
    height: "32px",
    boxSizing: "border-box",
    borderRadius: "7px",
    border: `1px solid ${colors.border}`,
    background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
    color: colors.text,
    padding: "0 8px",
    font: "inherit",
    fontSize: "0.8rem",
    outline: "none",
  };

  return (
    <div
      ref={editorRootRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: isDark ? "#111318" : "#f6f7fb",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          borderBottom: `1px solid ${colors.border}`,
          background: isDark ? "rgba(15,17,23,0.92)" : "rgba(255,255,255,0.86)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          flexWrap: "wrap",
        }}
      >
        {toolbar.map((group, groupIndex) => (
          <div key={groupIndex} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {group.map(({ label, icon: Icon, action, active = false, disabled = false }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onClick={action}
                disabled={disabled || !editor || readOnly}
                style={{
                  ...createToolbarButtonStyle(active, colors, isDark),
                  opacity: disabled || readOnly ? 0.42 : 1,
                  cursor: disabled || readOnly ? "default" : "pointer",
                }}
              >
                <Icon size={16} />
              </button>
            ))}
            {groupIndex < toolbar.length - 1 && (
              <div style={{ width: "1px", height: "24px", background: colors.border, margin: "0 4px" }} />
            )}
          </div>
        ))}

        <div
          ref={tableToolsRef}
          className="streetbot-tiptap-table-tools"
          style={{ position: "relative", display: "inline-flex" }}
        >
          <button
            type="button"
            title="Table tools"
            aria-label="Table tools"
            aria-haspopup="menu"
            aria-expanded={tableToolsOpen}
            data-testid="streetbot-tiptap-table-tools"
            onClick={() => setTableToolsOpen(open => !open)}
            disabled={!editor || readOnly}
            style={{
              ...createToolbarButtonStyle(tableActive || tableToolsOpen, colors, isDark),
              opacity: readOnly ? 0.42 : 1,
              cursor: readOnly ? "default" : "pointer",
            }}
          >
            <Table2 size={16} />
          </button>
          {tableToolsOpen && (
            <div
              className="streetbot-tiptap-table-tools-menu"
              role="menu"
              aria-label="Table tools menu"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="streetbot-tiptap-table-tools-section">
                <button
                  type="button"
                  role="menuitem"
                  data-testid="streetbot-tiptap-insert-table"
                  disabled={!editor || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
                >
                  <Table2 size={13} />
                  <span>Insert 3 x 3</span>
                </button>
              </div>

              <div className="streetbot-tiptap-table-tools-section" role="group" aria-label="Rows">
                <span className="streetbot-tiptap-table-tools-label">Rows</span>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="streetbot-tiptap-add-row-before"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().addRowBefore().run())}
                >
                  <ArrowUp size={13} />
                  <span>Add above</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="streetbot-tiptap-add-row-after"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().addRowAfter().run())}
                >
                  <Rows3 size={13} />
                  <span>Add below</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().deleteRow().run())}
                >
                  <Trash2 size={13} />
                  <span>Delete row</span>
                </button>
              </div>

              <div className="streetbot-tiptap-table-tools-section" role="group" aria-label="Columns">
                <span className="streetbot-tiptap-table-tools-label">Columns</span>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="streetbot-tiptap-add-column-before"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().addColumnBefore().run())}
                >
                  <ArrowUp size={13} style={{ transform: "rotate(-90deg)" }} />
                  <span>Add left</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="streetbot-tiptap-add-column-after"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().addColumnAfter().run())}
                >
                  <Columns3 size={13} />
                  <span>Add right</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().deleteColumn().run())}
                >
                  <Trash2 size={13} />
                  <span>Delete column</span>
                </button>
              </div>

              <div className="streetbot-tiptap-table-tools-section" role="group" aria-label="Cells">
                <span className="streetbot-tiptap-table-tools-label">Cells</span>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().mergeCells().run())}
                >
                  <Rows3 size={13} />
                  <span>Merge cells</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().splitCell().run())}
                >
                  <Columns3 size={13} />
                  <span>Split cell</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().toggleHeaderCell().run())}
                >
                  <Type size={13} />
                  <span>Header cell</span>
                </button>
              </div>

              <div className="streetbot-tiptap-table-tools-section" role="group" aria-label="Headers">
                <span className="streetbot-tiptap-table-tools-label">Headers</span>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().toggleHeaderRow().run())}
                >
                  <Rows3 size={13} />
                  <span>Header row</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!tableActive || readOnly}
                  onClick={() => runTableCommand(activeEditor => activeEditor.chain().focus().toggleHeaderColumn().run())}
                >
                  <Columns3 size={13} />
                  <span>Header column</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  disabled={!tableActive || readOnly}
                  onClick={() => {
                    if (runTableCommand(activeEditor => activeEditor.chain().focus().deleteTable().run())) {
                      setTableToolsOpen(false);
                    }
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete table</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="streetbot-tiptap-transform-control">
          <ListTree size={15} color={colors.textMuted} />
          <select
            aria-label="Turn current block into"
            title="Turn current block into"
            value=""
            onChange={(event) => {
              const value = event.target.value as BlockTransformKind;
              if (editor && value) {
                applyBlockTransform(editor, value);
              }
            }}
            disabled={!editor || readOnly}
            style={{
              height: "32px",
              maxWidth: "116px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              color: colors.textMuted,
              fontSize: "0.76rem",
              fontWeight: 700,
              outline: "none",
            }}
          >
            <option value="">Turn into</option>
            {BLOCK_TRANSFORM_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="streetbot-tiptap-code-language-control">
          <Code2 size={15} color={codeBlockActive ? colors.accent : colors.textMuted} />
          <select
            aria-label="Code block language"
            title={codeBlockActive ? "Set code block language" : "Create code block with language"}
            data-testid="streetbot-tiptap-code-language-select"
            value={activeCodeBlockLanguage}
            onChange={(event) => {
              if (event.target.value) {
                applyCodeBlockLanguage(event.target.value);
              }
            }}
            disabled={!editor || readOnly}
            style={{
              height: "32px",
              maxWidth: "122px",
              borderRadius: "7px",
              border: `1px solid ${codeBlockActive ? colors.accent : colors.border}`,
              background: codeBlockActive
                ? isDark ? "rgba(255,214,0,0.13)" : "rgba(59,130,246,0.1)"
                : isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              color: codeBlockActive ? colors.accent : colors.textMuted,
              fontSize: "0.76rem",
              fontWeight: 700,
              outline: "none",
            }}
          >
            <option value="">Code lang</option>
            {CODE_BLOCK_LANGUAGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Palette size={15} color={colors.textMuted} />
          {TEXT_COLOR_SWATCHES.map(color => (
            <button
              key={color}
              type="button"
              title={`Text color ${color}`}
              aria-label={`Text color ${color}`}
              onClick={() => applyTextColor(color)}
              disabled={!editor || readOnly}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "7px",
                border: `1px solid ${colors.border}`,
                background: color,
                cursor: editor && !readOnly ? "pointer" : "default",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <PaintBucket size={15} color={colors.textMuted} />
          {BACKGROUND_COLOR_SWATCHES.map(color => (
            <button
              key={color}
              type="button"
              title={`Background color ${color}`}
              aria-label={`Background color ${color}`}
              onClick={() => applyBackgroundColor(color)}
              disabled={!editor || readOnly}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "7px",
                border: `1px solid ${colors.border}`,
                background: color,
                cursor: editor && !readOnly ? "pointer" : "default",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Type size={15} color={colors.textMuted} />
          <select
            aria-label="Font family"
            value=""
            onChange={(event) => {
              applyFontFamily(event.target.value);
            }}
            disabled={!editor || readOnly}
            style={{
              height: "32px",
              maxWidth: "92px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              color: colors.textMuted,
              fontSize: "0.76rem",
              fontWeight: 700,
              outline: "none",
            }}
          >
            <option value="">Font</option>
            {FONT_FAMILY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Font size"
            value=""
            onChange={(event) => {
              applyFontSize(event.target.value);
            }}
            disabled={!editor || readOnly}
            style={{
              height: "32px",
              maxWidth: "78px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              color: colors.textMuted,
              fontSize: "0.76rem",
              fontWeight: 700,
              outline: "none",
            }}
          >
            <option value="">Size</option>
            {FONT_SIZE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            aria-label="Line height"
            value=""
            onChange={(event) => {
              applyLineHeight(event.target.value);
            }}
            disabled={!editor || readOnly}
            style={{
              height: "32px",
              maxWidth: "72px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
              color: colors.textMuted,
              fontSize: "0.76rem",
              fontWeight: 700,
              outline: "none",
            }}
          >
            <option value="">Line</option>
            {LINE_HEIGHT_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            title="Find in document"
            aria-label="Find in document"
            data-testid="streetbot-tiptap-search-toggle"
            onClick={() => {
              if (documentSearchOpen) {
                closeDocumentSearchPanel();
                return;
              }
              setDocumentSearchOpen(true);
              setOutlinePanelOpen(false);
              setPagePanelOpen(false);
            }}
            style={createToolbarButtonStyle(documentSearchOpen, colors, isDark)}
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            title="Insert Markdown"
            aria-label="Insert Markdown"
            data-testid="streetbot-tiptap-markdown-import-toggle"
            onClick={openMarkdownImportDialog}
            disabled={!editor || readOnly}
            style={createToolbarButtonStyle(markdownImportOpen, colors, isDark)}
          >
            <ClipboardPaste size={16} />
          </button>
          <button
            type="button"
            title="Export Markdown"
            aria-label="Export Markdown"
            data-testid="streetbot-tiptap-markdown-export-toggle"
            onClick={openMarkdownExportDialog}
            disabled={!editor}
            style={createToolbarButtonStyle(markdownExportOpen, colors, isDark)}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            title="Document outline"
            aria-label="Document outline"
            onClick={() => {
              setOutlinePanelOpen(open => !open);
              setDocumentSearchOpen(false);
              setPagePanelOpen(false);
            }}
            style={createToolbarButtonStyle(outlinePanelOpen, colors, isDark)}
          >
            <ListTree size={16} />
          </button>
          <button
            type="button"
            title="Page setup"
            aria-label="Page setup"
            onClick={() => {
              setPagePanelOpen(open => !open);
              setDocumentSearchOpen(false);
              setOutlinePanelOpen(false);
            }}
            style={createToolbarButtonStyle(pagePanelOpen, colors, isDark)}
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            title="Print preview"
            aria-label="Print preview"
            onClick={() => setPrintPreviewOpen(true)}
            style={createToolbarButtonStyle(printPreviewOpen, colors, isDark)}
          >
            <Printer size={16} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {readOnly && (
          <span
            title={readOnlyReason || "Document is read only"}
            aria-label={readOnlyReason || "Document is read only"}
            style={{
              minHeight: "28px",
              borderRadius: "8px",
              border: "1px solid rgba(245,158,11,0.42)",
              background: isDark ? "rgba(245,158,11,0.13)" : "rgba(245,158,11,0.1)",
              color: "#b45309",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "0 9px",
              fontSize: "0.76rem",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            <Lock size={14} />
            Read only
          </span>
        )}

        <div ref={presencePanelRef} style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            title={collaborationTitle}
            aria-label={collaborationTitle}
            aria-haspopup="dialog"
            aria-expanded={presencePanelOpen}
            onClick={() => setPresencePanelOpen(open => !open)}
            style={{
              minHeight: "28px",
              borderRadius: "8px",
              border: `1px solid ${collaborationIsLive ? "rgba(34,197,94,0.42)" : colors.border}`,
              background: collaborationIsLive
                ? isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.1)"
                : isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
              color: colors.textSecondary,
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "0 9px",
              fontSize: "0.76rem",
              fontWeight: 800,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            <Users size={14} color={collaborationIsLive ? "#16a34a" : colors.textMuted} />
            {collaborationLabel}
            <span style={{ color: colors.textMuted, fontWeight: 750 }}>
              {collaborationPeerLabel}
            </span>
            {visibleCollaborationUsers.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", marginLeft: "-2px" }}>
                {visibleCollaborationUsers.slice(0, 3).map(user => (
                  <span
                    key={`${user.id}-${user.clientId}`}
                    title={`${user.name}: ${user.label}`}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: `2px solid ${isDark ? "#111318" : "#f6f7fb"}`,
                      background: user.color,
                      marginLeft: "-5px",
                      boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.16)" : "0 0 0 1px rgba(15,23,42,0.08)",
                    }}
                  />
                ))}
              </span>
            )}
          </button>
          {presencePanelOpen && (
            <div
              role="dialog"
              aria-label="Collaboration presence"
              style={{
                position: "absolute",
                top: "34px",
                right: 0,
                width: "286px",
                maxWidth: "calc(100vw - 32px)",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: isDark ? "#151922" : "#ffffff",
                boxShadow: isDark ? "0 18px 42px rgba(0,0,0,0.42)" : "0 18px 42px rgba(15,23,42,0.16)",
                zIndex: 40,
                overflow: "hidden",
              }}
            >
              <div style={{
                padding: "12px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}>
                <Users size={16} color={collaborationIsLive ? "#16a34a" : colors.textMuted} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: colors.text, fontSize: "0.82rem", fontWeight: 850, lineHeight: 1.25 }}>
                    {collaborationLabel}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: "0.72rem", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {collaborationPeerLabel}
                  </div>
                </div>
              </div>
              <div style={{ padding: "8px", display: "grid", gap: "4px" }}>
                {[localCollaborationPresenceUser, ...visibleCollaborationUsers].map(user => {
                  const timeLabel = collaborationPresenceTimeLabel(user.updatedAt);
                  const isLocalSession = user.clientId === localCollaborationPresenceUser.clientId;
                  return (
                    <div
                      key={`${user.id}-${user.clientId}`}
                      style={{
                        minHeight: "38px",
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: "8px",
                        padding: "5px 6px",
                        borderRadius: "7px",
                        background: isLocalSession
                          ? isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)"
                          : "transparent",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: user.color,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: `inset 0 0 0 2px ${isDark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.68)"}`,
                        }}
                      >
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: collaborationPresenceDotColor(user.mode),
                            boxShadow: isDark ? "0 0 0 1px rgba(0,0,0,0.4)" : "0 0 0 1px rgba(255,255,255,0.85)",
                          }}
                        />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isLocalSession ? `${user.name} (you)` : user.name}
                        </div>
                        <div style={{ color: colors.textMuted, fontSize: "0.69rem", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {timeLabel ? `${user.label} - ${timeLabel}` : user.label}
                        </div>
                      </div>
                      <span
                        style={{
                          borderRadius: "999px",
                          padding: "3px 7px",
                          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
                          color: colors.textSecondary,
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <span
          aria-label={`${editorCounts.words} words and ${editorCounts.characters} characters`}
          style={{ color: colors.textMuted, fontSize: "0.76rem", whiteSpace: "nowrap" }}
        >
          {editorCounts.words.toLocaleString()} words / {editorCounts.characters.toLocaleString()} chars
        </span>
        <span aria-live="polite" style={{ color: colors.textMuted, fontSize: "0.76rem", minWidth: "104px", textAlign: "right" }}>
          {saveStateLabel}
        </span>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!editor || saving || readOnly}
          style={{
            minWidth: "92px",
            height: "34px",
            borderRadius: "8px",
            border: `1px solid ${colors.border}`,
            background: colors.accent,
            color: "#000",
            cursor: saving || readOnly ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            fontSize: "0.82rem",
            fontWeight: 700,
            opacity: !editor || saving || readOnly ? 0.72 : 1,
          }}
        >
          {saving ? <Loader2 size={15} className="streetbot-tiptap-spin" /> : <Save size={15} />}
          Save
        </button>
      </div>

      {offlineDraftNotice && (offlineDraftNotice.kind === "restored" || offlineDraftNotice.kind === "conflict" || saveError) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            minHeight: "34px",
            borderBottom: `1px solid ${colors.border}`,
            background: isDark ? "rgba(37,99,235,0.14)" : "rgba(37,99,235,0.08)",
            color: colors.textSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "7px 16px",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          <span>
            {offlineDraftNotice.kind === "restored"
              ? `Recovered local draft${offlineDraftTimeLabel ? ` from ${offlineDraftTimeLabel}` : ""}`
              : offlineDraftNotice.kind === "conflict"
                ? `Conflict detected. Local draft kept${offlineDraftTimeLabel ? ` at ${offlineDraftTimeLabel}` : ""}`
              : `Save failed. Local draft kept${offlineDraftTimeLabel ? ` at ${offlineDraftTimeLabel}` : ""}`}
          </span>
          {(offlineDraftNotice.kind === "restored" || offlineDraftNotice.kind === "conflict") && (
            <button
              type="button"
              onClick={discardRestoredOfflineDraft}
              style={{
                height: "26px",
                borderRadius: "7px",
                border: `1px solid ${colors.border}`,
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.74)",
                color: colors.text,
                padding: "0 10px",
                cursor: "pointer",
                fontSize: "0.74rem",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Use server copy
            </button>
          )}
        </div>
      )}

      {mediaNotice && (
        <div
          role={mediaNotice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            minHeight: "34px",
            borderBottom: `1px solid ${colors.border}`,
            background: mediaNotice.kind === "error"
              ? isDark ? "rgba(239,68,68,0.16)" : "rgba(239,68,68,0.09)"
              : mediaNotice.kind === "warning"
                ? isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.11)"
                : isDark ? "rgba(22,163,74,0.14)" : "rgba(22,163,74,0.09)",
            color: colors.textSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "7px 16px",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          <span>{mediaNotice.message}</span>
          <button
            type="button"
            aria-label="Dismiss media upload notice"
            onClick={() => setMediaNotice(null)}
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.74)",
              color: colors.textMuted,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {blockLinkNotice && (
        <div
          role={blockLinkNotice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          data-testid="streetbot-tiptap-block-link-notice"
          style={{
            minHeight: "34px",
            borderBottom: `1px solid ${colors.border}`,
            background: blockLinkNotice.kind === "error"
              ? isDark ? "rgba(239,68,68,0.16)" : "rgba(239,68,68,0.09)"
              : isDark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.08)",
            color: colors.textSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "7px 16px",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {blockLinkNotice.message}
            {blockLinkNotice.href ? (
              <span style={{ color: colors.textMuted, marginLeft: "8px", fontWeight: 650 }}>
                {blockLinkNotice.href}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="Dismiss block link notice"
            onClick={() => setBlockLinkNotice(null)}
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.74)",
              color: colors.textMuted,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {insertDialog && (
        <div
          className="streetbot-tiptap-insert-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeInsertDialog();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "104px 16px 16px",
            background: "rgba(15,23,42,0.22)",
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={insertDialog.title}
            onSubmit={(event) => {
              event.preventDefault();
              submitInsertDialog();
            }}
            style={{
              width: "min(420px, 100%)",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "#181b22" : "#ffffff",
              boxShadow: isDark ? "0 24px 70px rgba(0,0,0,0.5)" : "0 24px 60px rgba(15,23,42,0.22)",
              padding: "14px",
            }}
          >
            <div style={{ color: colors.text, fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>
              {insertDialog.title}
            </div>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                color: colors.textMuted,
                fontSize: "0.76rem",
                fontWeight: 750,
              }}
            >
              {insertDialog.label}
              <input
                autoFocus
                aria-label={insertDialog.label}
                value={insertDialog.value}
                placeholder={insertDialog.placeholder}
                onChange={(event) => {
                  const value = event.target.value;
                  setInsertDialog(current => current ? { ...current, value } : current);
                }}
                style={{
                  width: "100%",
                  height: "38px",
                  boxSizing: "border-box",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                  color: colors.text,
                  padding: "0 10px",
                  font: "inherit",
                  fontSize: "0.84rem",
                  outline: "none",
                }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
              <button
                type="button"
                onClick={closeInsertDialog}
                style={{
                  height: "34px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: "transparent",
                  color: colors.textSecondary,
                  padding: "0 13px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 750,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  height: "34px",
                  borderRadius: "8px",
                  border: "none",
                  background: colors.accent,
                  color: "#000",
                  padding: "0 14px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                }}
              >
                {insertDialog.submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}

      {markdownImportOpen && (
        <div
          className="streetbot-tiptap-markdown-import-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMarkdownImportDialog();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "88px 16px 16px",
            background: "rgba(15,23,42,0.22)",
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Insert Markdown"
            data-testid="streetbot-tiptap-markdown-import-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              submitMarkdownImport("insert");
            }}
            style={{
              width: "min(640px, 100%)",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "#181b22" : "#ffffff",
              boxShadow: isDark ? "0 24px 70px rgba(0,0,0,0.5)" : "0 24px 60px rgba(15,23,42,0.22)",
              padding: "14px",
            }}
          >
            <div style={{ color: colors.text, fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>
              Insert Markdown
            </div>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                color: colors.textMuted,
                fontSize: "0.76rem",
                fontWeight: 750,
              }}
            >
              Markdown
              <textarea
                autoFocus
                aria-label="Markdown"
                data-testid="streetbot-tiptap-markdown-import-textarea"
                value={markdownImportValue}
                placeholder="# Heading"
                onChange={(event) => {
                  setMarkdownImportValue(event.target.value);
                  setMarkdownImportError(null);
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    submitMarkdownImport("insert");
                  }
                }}
                style={{
                  width: "100%",
                  minHeight: "220px",
                  boxSizing: "border-box",
                  borderRadius: "8px",
                  border: `1px solid ${markdownImportError ? "#dc2626" : colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                  color: colors.text,
                  padding: "10px",
                  font: "'SFMono-Regular', Consolas, monospace",
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </label>
            {markdownImportError && (
              <div
                role="alert"
                data-testid="streetbot-tiptap-markdown-import-error"
                style={{
                  color: "#dc2626",
                  fontSize: "0.78rem",
                  fontWeight: 750,
                  marginTop: "9px",
                }}
              >
                {markdownImportError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="streetbot-tiptap-markdown-replace"
                onClick={() => submitMarkdownImport("replace")}
                style={{
                  height: "34px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
                  color: colors.textSecondary,
                  padding: "0 13px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 750,
                }}
              >
                Replace document
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={closeMarkdownImportDialog}
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.textSecondary,
                    padding: "0 13px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: 750,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="streetbot-tiptap-markdown-insert"
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: "none",
                    background: colors.accent,
                    color: "#000",
                    padding: "0 14px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                  }}
                >
                  Insert
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {markdownExportOpen && (
        <div
          className="streetbot-tiptap-markdown-export-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMarkdownExportDialog();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "88px 16px 16px",
            background: "rgba(15,23,42,0.22)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Export Markdown"
            data-testid="streetbot-tiptap-markdown-export-dialog"
            style={{
              width: "min(680px, 100%)",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: isDark ? "#181b22" : "#ffffff",
              boxShadow: isDark ? "0 24px 70px rgba(0,0,0,0.5)" : "0 24px 60px rgba(15,23,42,0.22)",
              padding: "14px",
            }}
          >
            <div style={{ color: colors.text, fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>
              Export Markdown
            </div>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                color: colors.textMuted,
                fontSize: "0.76rem",
                fontWeight: 750,
              }}
            >
              Markdown preview
              <textarea
                readOnly
                aria-label="Markdown preview"
                data-testid="streetbot-tiptap-markdown-export-textarea"
                value={markdownExportValue}
                onFocus={(event) => event.currentTarget.select()}
                style={{
                  width: "100%",
                  minHeight: "260px",
                  boxSizing: "border-box",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                  color: colors.text,
                  padding: "10px",
                  font: "'SFMono-Regular', Consolas, monospace",
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                  outline: "none",
                  resize: "vertical",
                  whiteSpace: "pre-wrap",
                }}
              />
            </label>
            {markdownExportStatus && (
              <div
                role={markdownExportStatus.kind === "error" ? "alert" : "status"}
                data-testid="streetbot-tiptap-markdown-export-status"
                style={{
                  color: markdownExportStatus.kind === "error" ? "#dc2626" : "#16a34a",
                  fontSize: "0.78rem",
                  fontWeight: 750,
                  marginTop: "9px",
                }}
              >
                {markdownExportStatus.message}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="streetbot-tiptap-markdown-export-refresh"
                onClick={() => {
                  setMarkdownExportStatus(null);
                  refreshMarkdownExportValue();
                }}
                style={{
                  height: "34px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
                  color: colors.textSecondary,
                  padding: "0 13px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 750,
                }}
              >
                Refresh
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={closeMarkdownExportDialog}
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.textSecondary,
                    padding: "0 13px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: 750,
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  data-testid="streetbot-tiptap-markdown-export-download"
                  onClick={downloadMarkdownExport}
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
                    color: colors.textSecondary,
                    padding: "0 13px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: 750,
                  }}
                >
                  Download
                </button>
                <button
                  type="button"
                  data-testid="streetbot-tiptap-markdown-export-copy"
                  onClick={() => void copyMarkdownExport()}
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: "none",
                    background: colors.accent,
                    color: "#000",
                    padding: "0 14px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div
        className="streetbot-tiptap-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          className="streetbot-tiptap-scroll"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            padding: "24px clamp(16px, 5vw, 56px)",
          }}
        >
          <div
            style={{
              width: `${currentPageGeometry.widthPx}px`,
              minHeight: `${currentPageGeometry.heightPx}px`,
              margin: "0 auto",
              background: isDark ? "#181b22" : "#ffffff",
              border: `1px solid ${colors.border}`,
              boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.36)" : "0 20px 48px rgba(15,23,42,0.08)",
              boxSizing: "border-box",
              padding: `${currentPageMargins.top}px ${currentPageMargins.right}px ${currentPageMargins.bottom}px ${currentPageMargins.left}px`,
            }}
          >
            <input
              value={title}
              onChange={(event) => {
                if (readOnly) return;
                const nextTitle = event.target.value;
                titleRef.current = nextTitle;
                setTitle(nextTitle);
                markDirty();
              }}
              disabled={readOnly}
              aria-label="Document title"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "none",
                outline: "none",
                padding: "0 0 10px",
                background: "transparent",
                color: readOnly ? colors.textSecondary : colors.text,
                fontFamily: "'Rubik', sans-serif",
                fontSize: "2rem",
                fontWeight: 750,
                lineHeight: 1.2,
              }}
            />

            <div>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.textMuted, fontSize: "0.84rem", margin: "8px 0 14px" }}>
                  <Loader2 size={16} className="streetbot-tiptap-spin" />
                  Loading document...
                </div>
              )}
              {error && (
                <div style={{ color: "#ef4444", fontSize: "0.84rem", margin: "8px 0 14px" }}>
                  {error}
                </div>
              )}
              <div style={{ minHeight: `${editorMinHeight}px` }}>
                {editor && !readOnly && (
                  <>
                    <BubbleMenuSurface
                      editor={editor}
                    >
                      <button
                        type="button"
                        aria-label="Bubble bold"
                        title="Bold"
                        data-testid="streetbot-tiptap-bubble-bold"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={editor.isActive("bold") ? "is-active" : ""}
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble italic"
                        title="Italic"
                        data-testid="streetbot-tiptap-bubble-italic"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={editor.isActive("italic") ? "is-active" : ""}
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble underline"
                        title="Underline"
                        data-testid="streetbot-tiptap-bubble-underline"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={editor.isActive("underline") ? "is-active" : ""}
                      >
                        <UnderlineIcon size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble strike"
                        title="Strike"
                        data-testid="streetbot-tiptap-bubble-strike"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={editor.isActive("strike") ? "is-active" : ""}
                      >
                        <Strikethrough size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble inline code"
                        title="Inline code"
                        data-testid="streetbot-tiptap-bubble-code"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        className={editor.isActive("code") ? "is-active" : ""}
                      >
                        <Code2 size={14} />
                      </button>
                      <span className="streetbot-tiptap-bubble-divider" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Bubble highlight"
                        title="Highlight"
                        data-testid="streetbot-tiptap-bubble-highlight"
                        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fde047" }).run()}
                        className={editor.isActive("highlight") ? "is-active" : ""}
                      >
                        <Highlighter size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble link"
                        title="Link"
                        data-testid="streetbot-tiptap-bubble-link"
                        onClick={() => openInsertDialog("link")}
                        className={editor.isActive("link") ? "is-active" : ""}
                      >
                        <Link2 size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble remove link"
                        title="Remove link"
                        data-testid="streetbot-tiptap-bubble-unlink"
                        disabled={!editor.isActive("link")}
                        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bubble comment"
                        title="Comment"
                        data-testid="streetbot-tiptap-bubble-comment"
                        onClick={openCommentComposer}
                      >
                        <MessageSquare size={14} />
                      </button>
                      <span className="streetbot-tiptap-bubble-divider" aria-hidden="true" />
                      <div className="streetbot-tiptap-bubble-swatches" role="group" aria-label="Bubble text color">
                        <Palette size={13} aria-hidden="true" />
                        {TEXT_COLOR_SWATCHES.slice(0, 4).map(color => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Bubble text color ${color}`}
                            title={`Text color ${color}`}
                            data-testid={`streetbot-tiptap-bubble-text-color-${color.replace("#", "")}`}
                            onClick={() => applyTextColor(color)}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                      <div className="streetbot-tiptap-bubble-swatches" role="group" aria-label="Bubble background color">
                        <PaintBucket size={13} aria-hidden="true" />
                        {BACKGROUND_COLOR_SWATCHES.slice(0, 4).map(color => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Bubble background color ${color}`}
                            title={`Background color ${color}`}
                            data-testid={`streetbot-tiptap-bubble-background-color-${color.replace("#", "")}`}
                            onClick={() => applyBackgroundColor(color)}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </BubbleMenuSurface>
                    <FloatingMenuSurface
                      editor={editor}
                    >
                      <button
                        type="button"
                        aria-label="Floating text"
                        title="Text"
                        data-testid="streetbot-tiptap-floating-text"
                        onClick={() => applyBlockTransform(editor, "paragraph")}
                      >
                        <Type size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating heading 1"
                        title="Heading 1"
                        data-testid="streetbot-tiptap-floating-heading-1"
                        onClick={() => applyBlockTransform(editor, "heading-1")}
                      >
                        <Heading1 size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating heading 2"
                        title="Heading 2"
                        data-testid="streetbot-tiptap-floating-heading-2"
                        onClick={() => applyBlockTransform(editor, "heading-2")}
                      >
                        <Heading2 size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating heading 3"
                        title="Heading 3"
                        data-testid="streetbot-tiptap-floating-heading-3"
                        onClick={() => applyBlockTransform(editor, "heading-3")}
                      >
                        <Heading3 size={15} />
                      </button>
                      <span className="streetbot-tiptap-floating-divider" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Floating bullet list"
                        title="Bulleted list"
                        data-testid="streetbot-tiptap-floating-bullet-list"
                        onClick={() => applyBlockTransform(editor, "bullet-list")}
                      >
                        <ListIcon size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating numbered list"
                        title="Numbered list"
                        data-testid="streetbot-tiptap-floating-ordered-list"
                        onClick={() => applyBlockTransform(editor, "ordered-list")}
                      >
                        <ListOrdered size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating checklist"
                        title="Checklist"
                        data-testid="streetbot-tiptap-floating-checklist"
                        onClick={() => applyBlockTransform(editor, "task-list")}
                      >
                        <ListChecks size={15} />
                      </button>
                      <span className="streetbot-tiptap-floating-divider" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Floating quote"
                        title="Quote"
                        data-testid="streetbot-tiptap-floating-quote"
                        onClick={() => applyBlockTransform(editor, "quote")}
                      >
                        <Quote size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating callout"
                        title="Callout"
                        data-testid="streetbot-tiptap-floating-callout"
                        onClick={() => applyBlockTransform(editor, "callout-note")}
                      >
                        <Lightbulb size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating code block"
                        title="Code block"
                        data-testid="streetbot-tiptap-floating-code-block"
                        onClick={() => applyBlockTransform(editor, "code-block")}
                      >
                        <Braces size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating divider"
                        title="Divider"
                        data-testid="streetbot-tiptap-floating-divider-command"
                        onClick={() => applyBlockTransform(editor, "divider")}
                      >
                        <SeparatorHorizontal size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating details"
                        title="Details"
                        data-testid="streetbot-tiptap-floating-details"
                        onClick={() => applyBlockTransform(editor, "details")}
                      >
                        <Columns3 size={15} />
                      </button>
                      <span className="streetbot-tiptap-floating-divider" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Floating table"
                        title="Table"
                        data-testid="streetbot-tiptap-floating-table"
                        onClick={() => applyBlockTransform(editor, "table")}
                      >
                        <Table2 size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating image"
                        title="Image"
                        data-testid="streetbot-tiptap-floating-image"
                        onClick={() => openInsertDialog("image")}
                      >
                        <ImageIcon size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating YouTube"
                        title="YouTube"
                        data-testid="streetbot-tiptap-floating-youtube"
                        onClick={() => openInsertDialog("youtube")}
                      >
                        <Youtube size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating audio"
                        title="Audio"
                        data-testid="streetbot-tiptap-floating-audio"
                        onClick={() => openInsertDialog("audio")}
                      >
                        <Music2 size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating Twitch"
                        title="Twitch"
                        data-testid="streetbot-tiptap-floating-twitch"
                        onClick={() => openInsertDialog("twitch")}
                      >
                        <TwitchIcon size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Floating mention"
                        data-testid="streetbot-tiptap-floating-mention"
                        title={mentionOptionsError || (mentionOptionsLoading ? "Loading mention sources" : "Mention yourself")}
                        onClick={() => insertMention(editor, currentMention)}
                      >
                        <AtSign size={15} />
                      </button>
                    </FloatingMenuSurface>
                    <DragHandleReact
                      editor={editor}
                      className="streetbot-tiptap-drag-handle"
                      nested
                      onNodeChange={handleDragHandleNodeChange}
                      onElementDragStart={handleDragHandleElementChange}
                      onElementDragEnd={handleDragHandleElementChange}
                    >
                      <span className="streetbot-tiptap-drag-handle-grip" aria-hidden="true">
                        <GripVertical size={16} />
                      </span>
                      <button
                        type="button"
                        aria-label="Move block up"
                        title="Move block up"
                        data-testid="streetbot-tiptap-block-move-up"
                        draggable={false}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          moveActiveBlock("up");
                        }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move block down"
                        title="Move block down"
                        data-testid="streetbot-tiptap-block-move-down"
                        draggable={false}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          moveActiveBlock("down");
                        }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Block actions"
                        title="Block actions"
                        aria-expanded={blockActionMenuOpen}
                        data-testid="streetbot-tiptap-block-actions"
                        draggable={false}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setBlockActionMenuOpen(open => !open);
                        }}
                      >
                        <MoreHorizontal size={13} />
                      </button>
                      {blockActionMenuOpen ? (
                        <div
                          className="streetbot-tiptap-block-actions-menu"
                          role="menu"
                          aria-label="Block actions menu"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              selectActiveBlock();
                            }}
                          >
                            <Check size={13} />
                            <span>Select block</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openBlockCommentComposer();
                            }}
                          >
                            <MessageSquare size={13} />
                            <span>Comment</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            data-testid="streetbot-tiptap-copy-block-link"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void copyActiveBlockLink();
                            }}
                          >
                            <Link2 size={13} />
                            <span>Copy block link</span>
                          </button>
                          <div
                            className="streetbot-tiptap-block-style-row"
                            role="group"
                            aria-label="Block text color"
                          >
                            <Palette size={13} />
                            {TEXT_COLOR_SWATCHES.map(color => (
                              <button
                                key={color}
                                type="button"
                                aria-label={`Block text color ${color}`}
                                title={`Block text color ${color}`}
                                onPointerDown={handleBlockActionButtonPointerDown}
                                onMouseDown={handleBlockActionButtonMouseDown}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  applyStyleToActiveBlock("text", color);
                                }}
                                style={{ background: color }}
                              />
                            ))}
                          </div>
                          <div
                            className="streetbot-tiptap-block-style-row"
                            role="group"
                            aria-label="Block background color"
                          >
                            <PaintBucket size={13} />
                            {BACKGROUND_COLOR_SWATCHES.map(color => (
                              <button
                                key={color}
                                type="button"
                                aria-label={`Block background color ${color}`}
                                title={`Block background color ${color}`}
                                onPointerDown={handleBlockActionButtonPointerDown}
                                onMouseDown={handleBlockActionButtonMouseDown}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  applyStyleToActiveBlock("background", color);
                                }}
                                style={{ background: color }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              insertParagraphNearActiveBlock("above");
                            }}
                          >
                            <Plus size={13} />
                            <span>Insert above</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              insertParagraphNearActiveBlock("below");
                            }}
                          >
                            <Plus size={13} />
                            <span>Insert below</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              duplicateActiveBlock();
                            }}
                          >
                            <Copy size={13} />
                            <span>Duplicate</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              moveActiveBlock("up");
                            }}
                          >
                            <ArrowUp size={13} />
                            <span>Move up</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              moveActiveBlock("down");
                            }}
                          >
                            <ArrowDown size={13} />
                            <span>Move down</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="is-danger"
                            onPointerDown={handleBlockActionButtonPointerDown}
                            onMouseDown={handleBlockActionButtonMouseDown}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteActiveBlock();
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                          <label>
                            <ListTree size={13} />
                            <select
                              aria-label="Turn selected block into"
                              defaultValue=""
                              onChange={(event) => {
                                const value = event.target.value as BlockTransformKind;
                                if (value) {
                                  transformActiveBlockFromHandle(value);
                                  event.target.value = "";
                                }
                              }}
                            >
                              <option value="">Turn into...</option>
                              {BLOCK_TRANSFORM_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </DragHandleReact>
                  </>
                )}
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {documentSearchOpen ? (
          <aside className="streetbot-search-panel" style={sidePanelStyle}>
            <div style={panelSectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <div style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 750 }}>Find</div>
                  <div
                    data-testid="streetbot-tiptap-search-count"
                    style={{ color: colors.textMuted, fontSize: "0.75rem", marginTop: "2px" }}
                  >
                    {documentSearchQuery.trim()
                      ? documentSearchSummary.resultCount > 0
                        ? `${documentSearchSummary.activeIndex + 1} of ${documentSearchSummary.resultCount} matches`
                        : "0 matches"
                      : "Ready"}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close document search"
                  data-testid="streetbot-tiptap-search-close"
                  onClick={closeDocumentSearchPanel}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.textMuted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <label
                style={{
                  minHeight: "36px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.78)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "0 9px",
                  color: colors.textMuted,
                }}
              >
                <Search size={14} />
                <input
                  ref={documentSearchInputRef}
                  data-testid="streetbot-tiptap-search-input"
                  aria-label="Search document text"
                  placeholder="Find text"
                  value={documentSearchQuery}
                  onChange={(event) => applyDocumentSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      navigateDocumentSearch(event.shiftKey ? -1 : 1);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      closeDocumentSearchPanel();
                    }
                  }}
                  style={{
                    minWidth: 0,
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: colors.text,
                    font: "inherit",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                />
                {documentSearchQuery.trim() && (
                  <button
                    type="button"
                    data-testid="streetbot-tiptap-search-clear"
                    aria-label="Clear document search"
                    onClick={clearDocumentSearch}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      border: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: colors.textMuted,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  data-testid="streetbot-tiptap-search-prev"
                  aria-label="Previous search match"
                  onClick={() => navigateDocumentSearch(-1)}
                  disabled={documentSearchSummary.resultCount === 0}
                  style={{
                    height: "32px",
                    borderRadius: "7px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: documentSearchSummary.resultCount === 0 ? colors.textMuted : colors.text,
                    cursor: documentSearchSummary.resultCount === 0 ? "default" : "pointer",
                    opacity: documentSearchSummary.resultCount === 0 ? 0.52 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    fontSize: "0.76rem",
                    fontWeight: 750,
                  }}
                >
                  <ArrowUp size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  data-testid="streetbot-tiptap-search-next"
                  aria-label="Next search match"
                  onClick={() => navigateDocumentSearch(1)}
                  disabled={documentSearchSummary.resultCount === 0}
                  style={{
                    height: "32px",
                    borderRadius: "7px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: documentSearchSummary.resultCount === 0 ? colors.textMuted : colors.text,
                    cursor: documentSearchSummary.resultCount === 0 ? "default" : "pointer",
                    opacity: documentSearchSummary.resultCount === 0 ? 0.52 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    fontSize: "0.76rem",
                    fontWeight: 750,
                  }}
                >
                  <ArrowDown size={13} />
                  Next
                </button>
              </div>
            </div>
          </aside>
        ) : pagePanelOpen ? (
          <aside className="streetbot-page-panel" style={sidePanelStyle}>
            <div style={panelSectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div>
                    <div style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 750 }}>Page</div>
                    <div style={{ color: colors.textMuted, fontSize: "0.75rem", marginTop: "2px" }}>
                      {pageSizeLabel} - {pageSettings.orientation}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close page setup"
                    onClick={() => setPagePanelOpen(false)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      border: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: colors.textMuted,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
                    Size
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {PAGE_SIZE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updatePageSettings(settings => ({ ...settings, size: option.value }))}
                        style={segmentedButtonStyle(pageSettings.size === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
                    Orientation
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {ORIENTATION_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updatePageSettings(settings => ({ ...settings, orientation: option.value }))}
                        style={segmentedButtonStyle(pageSettings.orientation === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
                    Margins
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {(["top", "right", "bottom", "left"] as Array<keyof TiptapPageMargins>).map(edge => (
                      <label key={edge} style={{ display: "flex", flexDirection: "column", gap: "5px", color: colors.textMuted, fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                        {edge}
                        <input
                          aria-label={`${edge} margin`}
                          type="number"
                          min={MIN_MARGIN_INCHES}
                          max={MAX_MARGIN_INCHES}
                          step={0.1}
                          value={pageSettings.margins[edge]}
                          onChange={(event) => {
                            const nextMargin = clampMargin(event.target.value, pageSettings.margins[edge]);
                            updatePageSettings(settings => ({
                              ...settings,
                              margins: {
                                ...settings.margins,
                                [edge]: nextMargin,
                              },
                            }));
                          }}
                          style={marginInputStyle}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrintPreviewOpen(true)}
                  style={{
                    height: "36px",
                    borderRadius: "8px",
                    border: "none",
                    background: colors.accent,
                    color: "#000",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                  }}
                >
                  <Printer size={15} />
                  Print preview
                </button>
              </div>
            </aside>
          ) : outlinePanelOpen ? (
            <aside className="streetbot-outline-panel" style={sidePanelStyle}>
              <div style={panelSectionStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div>
                    <div style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 750 }}>Outline</div>
                    <div style={{ color: colors.textMuted, fontSize: "0.75rem", marginTop: "2px" }}>
                      {outlineFilterActive
                        ? `${filteredOutlineItems.length} of ${outlineItems.length} headings`
                        : `${outlineItems.length} ${outlineItems.length === 1 ? "heading" : "headings"}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close document outline"
                    onClick={() => setOutlinePanelOpen(false)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      border: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: colors.textMuted,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ padding: "12px 12px 0" }}>
                <label
                  style={{
                    minHeight: "34px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.78)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0 9px",
                    color: colors.textMuted,
                  }}
                >
                  <Search size={14} />
                  <input
                    data-testid="streetbot-tiptap-outline-filter"
                    aria-label="Filter document outline"
                    placeholder="Filter headings"
                    value={outlineFilter}
                    onChange={(event) => setOutlineFilter(event.target.value)}
                    style={{
                      minWidth: 0,
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: colors.text,
                      font: "inherit",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  />
                  {outlineFilterActive && (
                    <button
                      type="button"
                      data-testid="streetbot-tiptap-outline-filter-clear"
                      aria-label="Clear outline filter"
                      onClick={() => setOutlineFilter("")}
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.textMuted,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </label>
              </div>

              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {outlineItems.length === 0 ? (
                  <div style={{ color: colors.textMuted, fontSize: "0.8rem", lineHeight: 1.45 }}>
                    No headings yet.
                  </div>
                ) : filteredOutlineItems.length === 0 ? (
                  <div style={{ color: colors.textMuted, fontSize: "0.8rem", lineHeight: 1.45 }}>
                    No matching headings.
                  </div>
                ) : (
                  filteredOutlineItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid="streetbot-tiptap-outline-item"
                      data-outline-level={item.level}
                      data-outline-position={item.position}
                      data-outline-active={item.isActive ? "true" : "false"}
                      onClick={() => jumpToOutlineItem(item)}
                      style={{
                        width: "100%",
                        minHeight: "34px",
                        borderRadius: "7px",
                        border: `1px solid ${item.isActive ? colors.accent : "transparent"}`,
                        background: item.isActive
                          ? isDark ? "rgba(255,214,0,0.12)" : "rgba(37,99,235,0.08)"
                          : "transparent",
                        color: colors.text,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: `7px 9px 7px ${8 + (Math.min(6, Math.max(1, item.level)) - 1) * 12}px`,
                        textAlign: "left",
                        fontSize: item.level === 1 ? "0.84rem" : "0.8rem",
                        fontWeight: item.level === 1 ? 800 : item.level === 2 ? 720 : 650,
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.borderColor = colors.border;
                        event.currentTarget.style.background = isDark ? "rgba(255,255,255,0.055)" : "rgba(15,23,42,0.04)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.borderColor = item.isActive ? colors.accent : "transparent";
                        event.currentTarget.style.background = item.isActive
                          ? isDark ? "rgba(255,214,0,0.12)" : "rgba(37,99,235,0.08)"
                          : "transparent";
                      }}
                    >
                      <span
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "6px",
                          border: `1px solid ${colors.border}`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 18px",
                          color: colors.textMuted,
                          fontSize: "0.62rem",
                          fontWeight: 800,
                        }}
                      >
                        H{Math.min(6, Math.max(1, item.level))}
                      </span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.text}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>
          ) : showReviewPanel && (
            <aside
              className="streetbot-review-panel"
              style={sidePanelStyle}
            >
            <div style={{ padding: "14px", borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <div style={{ color: colors.text, fontSize: "0.9rem", fontWeight: 750 }}>Review</div>
                  <div style={{ color: colors.textMuted, fontSize: "0.75rem", marginTop: "2px" }}>
                    {trackChanges ? "Tracking on" : "Tracking off"}
                  </div>
                </div>
                <span
                  aria-label={`${pendingSuggestions.length + activeComments.length} pending review items`}
                  style={{
                    minWidth: "28px",
                    height: "24px",
                    padding: "0 8px",
                    borderRadius: "999px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: pendingSuggestions.length + activeComments.length > 0 ? "rgba(37,99,235,0.14)" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"),
                    color: pendingSuggestions.length + activeComments.length > 0 ? "#2563eb" : colors.textMuted,
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {pendingSuggestions.length + activeComments.length}
                </span>
              </div>

              {pendingSuggestions.length > 1 && (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => resolveAllSuggestions("accept")}
                    style={{
                      flex: 1,
                      height: "30px",
                      borderRadius: "7px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(34,197,94,0.14)" : "rgba(34,197,94,0.12)",
                      color: "#16a34a",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 750,
                    }}
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveAllSuggestions("reject")}
                    style={{
                      flex: 1,
                      height: "30px",
                      borderRadius: "7px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.10)",
                      color: "#dc2626",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 750,
                    }}
                  >
                    Reject all
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {commentComposerOpen && (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    background: isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.06)",
                    padding: "10px",
                  }}
                >
                  <div style={{ color: colors.text, fontSize: "0.8rem", fontWeight: 800, marginBottom: "7px" }}>
                    New comment
                  </div>
                  {commentAnchor?.anchorText && (
                    <div
                      style={{
                        color: colors.textMuted,
                        fontSize: "0.74rem",
                        lineHeight: 1.4,
                        marginBottom: "8px",
                        paddingLeft: "8px",
                        borderLeft: "2px solid #2563eb",
                      }}
                    >
                      {commentAnchor.anchorText}
                    </div>
                  )}
                  <textarea
                    ref={commentTextareaRef}
                    aria-label="Comment text"
                    value={commentDraft}
                    onChange={(event) => {
                      setCommentDraft(event.target.value);
                      setCommentSubmitError(null);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "86px",
                      resize: "vertical",
                      boxSizing: "border-box",
                      borderRadius: "7px",
                      border: `1px solid ${colors.border}`,
                      background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                      color: colors.text,
                      font: "inherit",
                      fontSize: "0.82rem",
                      lineHeight: 1.45,
                      padding: "8px",
                      outline: "none",
                    }}
                  />
                  {commentSubmitError && (
                    <div style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "7px" }}>
                      {commentSubmitError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", marginTop: "9px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCommentComposerOpen(false);
                        setCommentAnchor(null);
                        setCommentDraft("");
                        setCommentSubmitError(null);
                      }}
                      style={{
                        flex: 1,
                        height: "30px",
                        borderRadius: "7px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.textMuted,
                        cursor: "pointer",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitComment()}
                      disabled={!commentDraft.trim() || commentSubmitting}
                      style={{
                        flex: 1,
                        height: "30px",
                        borderRadius: "7px",
                        border: "none",
                        background: commentDraft.trim() && !commentSubmitting ? colors.accent : `${colors.accent}55`,
                        color: "#000",
                        cursor: commentDraft.trim() && !commentSubmitting ? "pointer" : "default",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      {commentSubmitting && <Loader2 size={13} className="streetbot-tiptap-spin" />}
                      Add
                    </button>
                  </div>
                </div>
              )}

              {(suggestionsLoading || suggestionsError || pendingSuggestions.length > 0) && (
                <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase" }}>
                  Changes
                </div>
              )}
              {suggestionsLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.textMuted, fontSize: "0.8rem" }}>
                  <Loader2 size={15} className="streetbot-tiptap-spin" />
                  Loading changes...
                </div>
              )}
              {suggestionsError && (
                <div style={{ color: "#dc2626", fontSize: "0.8rem", lineHeight: 1.45 }}>
                  {suggestionsError}
                </div>
              )}
              {!suggestionsLoading && pendingSuggestions.length === 0 && activeComments.length === 0 && !commentComposerOpen && !commentsLoading && (
                <div style={{ color: colors.textMuted, fontSize: "0.8rem", lineHeight: 1.45 }}>
                  No pending review items
                </div>
              )}
              {pendingSuggestions.map((suggestion) => {
                const suggestionText = getSuggestionText(suggestion);
                const color = suggestion.suggestionType === "insertion" ? "#16a34a" : "#dc2626";
                return (
                  <div
                    key={suggestion.suggestionId}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      background: isDark ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.035)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "10px 10px 8px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "7px",
                          alignSelf: "stretch",
                          borderRadius: "999px",
                          background: suggestion.authorColor || color,
                          flex: "0 0 7px",
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <span style={{ color, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase" }}>
                            {suggestion.suggestionType === "insertion" ? "Insertion" : "Deletion"}
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: "0.72rem" }}>
                            {suggestion.authorName || "Reviewer"}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: "7px",
                            color: colors.text,
                            fontSize: "0.82rem",
                            lineHeight: 1.45,
                            textDecoration: suggestion.suggestionType === "deletion" ? "line-through" : "none",
                            wordBreak: "break-word",
                          }}
                        >
                          {suggestionText || "Empty change"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", borderTop: `1px solid ${colors.border}` }}>
                      <button
                        type="button"
                        aria-label={`Accept suggestion ${suggestion.suggestionId}`}
                        title="Accept suggestion"
                        onClick={() => resolveSuggestion(suggestion.suggestionId, "accept")}
                        style={{
                          flex: 1,
                          height: "32px",
                          border: "none",
                          borderRight: `1px solid ${colors.border}`,
                          background: "transparent",
                          color: "#16a34a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Reject suggestion ${suggestion.suggestionId}`}
                        title="Reject suggestion"
                        onClick={() => resolveSuggestion(suggestion.suggestionId, "reject")}
                        style={{
                          flex: 1,
                          height: "32px",
                          border: "none",
                          background: "transparent",
                          color: "#dc2626",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {(commentsLoading || commentsError || activeComments.length > 0) && (
                <div style={{ color: colors.textMuted, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", marginTop: "6px" }}>
                  Comments
                </div>
              )}
              {commentsLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.textMuted, fontSize: "0.8rem" }}>
                  <Loader2 size={15} className="streetbot-tiptap-spin" />
                  Loading comments...
                </div>
              )}
              {commentsError && (
                <div style={{ color: "#dc2626", fontSize: "0.8rem", lineHeight: 1.45 }}>
                  {commentsError}
                </div>
              )}
              {activeComments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    background: isDark ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.035)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "10px" }}>
                    {comment.anchorText && (
                      <div
                        style={{
                          color: colors.textMuted,
                          fontSize: "0.74rem",
                          lineHeight: 1.4,
                          marginBottom: "8px",
                          paddingLeft: "8px",
                          borderLeft: "2px solid #2563eb",
                          wordBreak: "break-word",
                        }}
                      >
                        {comment.anchorText}
                      </div>
                    )}
                    <div style={{ color: colors.text, fontSize: "0.82rem", lineHeight: 1.45, wordBreak: "break-word" }}>
                      {comment.content}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Resolve comment ${comment.id}`}
                    onClick={() => resolveComment(comment.id)}
                    style={{
                      width: "100%",
                      height: "32px",
                      border: "none",
                      borderTop: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: "#2563eb",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                    }}
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {printPreviewOpen && (
        <div
          role="dialog"
          aria-label="Print preview"
          className="streetbot-print-preview-dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.24)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: "56px",
              padding: "0 16px",
              borderBottom: `1px solid ${colors.border}`,
              background: isDark ? "#111318" : "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: colors.text, fontSize: "0.92rem", fontWeight: 800 }}>Print preview</div>
              <div style={{ color: colors.textMuted, fontSize: "0.74rem", marginTop: "2px" }}>
                {pageSizeLabel} {pageSettings.orientation}, {pageSettings.margins.top}" margins
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                height: "34px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "none",
                background: colors.accent,
                color: "#000",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
                fontWeight: 800,
              }}
            >
              <Printer size={15} />
              Print
            </button>
            <button
              type="button"
              aria-label="Close print preview"
              onClick={() => setPrintPreviewOpen(false)}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div
            className="streetbot-print-preview"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: "28px",
              background: isDark ? "#0f1116" : "#eef1f6",
            }}
          >
            <div
              className="streetbot-print-page"
              style={{
                width: `${currentPageGeometry.widthPx}px`,
                minHeight: `${currentPageGeometry.heightPx}px`,
                margin: "0 auto",
                boxSizing: "border-box",
                padding: `${currentPageMargins.top}px ${currentPageMargins.right}px ${currentPageMargins.bottom}px ${currentPageMargins.left}px`,
                background: "#ffffff",
                color: "#111827",
                border: "1px solid rgba(15,23,42,0.12)",
                boxShadow: "0 20px 56px rgba(15,23,42,0.18)",
              }}
            >
              <h1 style={{ margin: "0 0 18px", fontSize: "2rem", lineHeight: 1.2, color: "#111827" }}>
                {titleRef.current.trim() || "Untitled document"}
              </h1>
              <div
                className="streetbot-print-content streetbot-tiptap-editor"
                dangerouslySetInnerHTML={{ __html: printPreviewHtml }}
              />
            </div>
          </div>

          <style>{`
            @page {
              size: ${pageSettings.size === "a4" ? "A4" : pageSettings.size} ${pageSettings.orientation};
              margin: 0;
            }

            @media print {
              body * {
                visibility: hidden !important;
              }

              .streetbot-print-preview-dialog,
              .streetbot-print-preview-dialog * {
                visibility: visible !important;
              }

              .streetbot-print-preview-dialog {
                position: absolute !important;
                inset: 0 !important;
                background: #ffffff !important;
              }

              .streetbot-print-preview-dialog > div:first-child {
                display: none !important;
              }

              .streetbot-print-preview {
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
              }

              .streetbot-print-page {
                width: ${currentPageGeometry.widthPx}px !important;
                min-height: ${currentPageGeometry.heightPx}px !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
            }
          `}</style>
        </div>
      )}

      <style>{`
        .streetbot-tiptap-spin {
          animation: streetbot-tiptap-spin 1s linear infinite;
        }

        @keyframes streetbot-tiptap-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .streetbot-tiptap-editor {
          min-height: 520px;
          color: ${colors.text};
          font-family: "Rubik", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 1rem;
          line-height: 1.72;
          outline: none;
        }

        .streetbot-tiptap-editor p {
          margin: 0.7rem 0;
        }

        .streetbot-tiptap-editor h1,
        .streetbot-tiptap-editor h2,
        .streetbot-tiptap-editor h3,
        .streetbot-tiptap-editor h4,
        .streetbot-tiptap-editor h5,
        .streetbot-tiptap-editor h6 {
          line-height: 1.2;
          margin: 1.4rem 0 0.65rem;
          color: ${colors.text};
        }

        .streetbot-tiptap-editor h1 {
          font-size: 1.8rem;
        }

        .streetbot-tiptap-editor h2 {
          font-size: 1.38rem;
        }

        .streetbot-tiptap-editor h3 {
          font-size: 1.14rem;
        }

        .streetbot-tiptap-editor h4 {
          font-size: 1.02rem;
        }

        .streetbot-tiptap-editor h5,
        .streetbot-tiptap-editor h6 {
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .streetbot-tiptap-editor ul,
        .streetbot-tiptap-editor ol {
          padding-left: 1.4rem;
          margin: 0.75rem 0;
        }

        .streetbot-tiptap-editor blockquote {
          margin: 1rem 0;
          padding-left: 1rem;
          border-left: 3px solid ${colors.accent};
          color: ${colors.textSecondary};
        }

        .streetbot-tiptap-editor code {
          border-radius: 5px;
          padding: 0.1rem 0.32rem;
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"};
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 0.88em;
        }

        .streetbot-tiptap-editor pre {
          margin: 1rem 0;
          border-radius: 8px;
          padding: 0.9rem 1rem;
          overflow-x: auto;
          background: ${isDark ? "#0b0d12" : "#f1f5f9"};
          color: ${colors.text};
        }

        .streetbot-tiptap-editor pre code {
          padding: 0;
          background: transparent;
          color: inherit;
          font-size: 0.9rem;
        }

        .streetbot-tiptap-editor hr {
          border: none;
          border-top: 1px solid ${colors.border};
          margin: 1.4rem 0;
        }

        .streetbot-tiptap-editor table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin: 1rem 0;
          overflow: hidden;
          border-radius: 8px;
        }

        .streetbot-tiptap-editor .tableWrapper {
          overflow-x: auto;
          margin: 1rem 0;
        }

        .streetbot-tiptap-editor th,
        .streetbot-tiptap-editor td {
          border: 1px solid ${colors.border};
          box-sizing: border-box;
          min-width: 1em;
          padding: 0.45rem 0.55rem;
          position: relative;
          vertical-align: top;
        }

        .streetbot-tiptap-editor th {
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"};
          font-weight: 800;
        }

        .streetbot-tiptap-editor .selectedCell::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: ${isDark ? "rgba(37,99,235,0.24)" : "rgba(37,99,235,0.14)"};
        }

        .streetbot-tiptap-editor .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: ${colors.accent};
          pointer-events: none;
        }

        .streetbot-tiptap-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .streetbot-tiptap-editor iframe {
          width: 100%;
          max-width: 100%;
          aspect-ratio: 16 / 9;
          border: 0;
          border-radius: 8px;
        }

        .streetbot-tiptap-editor details {
          margin: 1rem 0;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          padding: 0.6rem 0.75rem;
          background: ${isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)"};
        }

        .streetbot-tiptap-editor summary {
          cursor: pointer;
          font-weight: 800;
        }

        .streetbot-tiptap-editor [data-type="inline-math"] {
          padding: 0 0.16rem;
        }

        .streetbot-tiptap-editor [data-type="block-math"] {
          margin: 1rem 0;
          overflow-x: auto;
        }

        .streetbot-tiptap-editor .invisible-character {
          color: ${colors.accent};
          opacity: 0.66;
        }

        .streetbot-tiptap-editor .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: ${colors.textMuted};
          opacity: 0.62;
        }

        .streetbot-tiptap-editor a {
          color: #2563eb;
          text-decoration: underline;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout {
          display: grid;
          grid-template-columns: 1.7rem minmax(0, 1fr);
          gap: 0.7rem;
          align-items: flex-start;
          margin: 1rem 0;
          padding: 0.82rem 0.95rem;
          border: 1px solid rgba(37,99,235,0.22);
          border-radius: 8px;
          background: ${isDark ? "rgba(37,99,235,0.13)" : "rgba(219,234,254,0.62)"};
          color: ${colors.text};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-icon {
          width: 1.45rem;
          height: 1.45rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 0.1rem;
          background: #2563eb;
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 900;
          line-height: 1;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-content {
          min-width: 0;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-content > :first-child {
          margin-top: 0;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-content > :last-child {
          margin-bottom: 0;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-tip {
          border-color: rgba(22,163,74,0.24);
          background: ${isDark ? "rgba(22,163,74,0.12)" : "rgba(220,252,231,0.7)"};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-tip .streetbot-tiptap-callout-icon {
          background: #16a34a;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-warning {
          border-color: rgba(202,138,4,0.34);
          background: ${isDark ? "rgba(202,138,4,0.14)" : "rgba(254,243,199,0.78)"};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-callout-warning .streetbot-tiptap-callout-icon {
          background: #ca8a04;
        }

        .streetbot-tiptap-editor .streetbot-collaboration-selection {
          border-radius: 2px;
        }

        .streetbot-collaboration-caret {
          border-left: 2px solid;
          border-right: 2px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }

        .streetbot-collaboration-caret-label {
          position: absolute;
          top: -1.45rem;
          left: -2px;
          border-radius: 6px;
          color: #ffffff;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1;
          padding: 0.22rem 0.38rem;
          white-space: nowrap;
          box-shadow: 0 8px 18px rgba(15,23,42,0.18);
        }

        .streetbot-tiptap-bubble-menu,
        .streetbot-tiptap-floating-menu {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${isDark ? "rgba(24,27,34,0.96)" : "rgba(255,255,255,0.96)"};
          box-shadow: ${isDark ? "0 16px 36px rgba(0,0,0,0.42)" : "0 16px 34px rgba(15,23,42,0.16)"};
          padding: 4px;
          display: flex;
          align-items: center;
          gap: 3px;
          z-index: 40;
        }

        .streetbot-tiptap-bubble-menu {
          max-width: min(92vw, 620px);
          flex-wrap: wrap;
        }

        .streetbot-tiptap-floating-menu {
          max-width: min(92vw, 560px);
          flex-wrap: wrap;
        }

        .streetbot-tiptap-bubble-menu button,
        .streetbot-tiptap-floating-menu button {
          width: 30px;
          height: 30px;
          border-radius: 7px;
          border: 1px solid transparent;
          background: transparent;
          color: ${colors.textMuted};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .streetbot-tiptap-bubble-menu button:hover,
        .streetbot-tiptap-floating-menu button:hover,
        .streetbot-tiptap-bubble-menu button.is-active {
          border-color: ${colors.border};
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"};
          color: ${colors.accent};
        }

        .streetbot-tiptap-bubble-menu button:disabled {
          cursor: default;
          opacity: 0.36;
        }

        .streetbot-tiptap-bubble-divider {
          align-self: stretch;
          width: 1px;
          min-height: 22px;
          background: ${colors.border};
          margin: 3px 2px;
        }

        .streetbot-tiptap-floating-divider {
          align-self: stretch;
          width: 1px;
          min-height: 22px;
          background: ${colors.border};
          margin: 3px 2px;
        }

        .streetbot-tiptap-bubble-swatches {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: ${colors.textMuted};
          padding: 0 2px;
        }

        .streetbot-tiptap-bubble-swatches button {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border-color: ${colors.border};
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.42);
        }

        .streetbot-tiptap-drag-handle {
          position: relative;
          width: auto;
          min-width: 26px;
          height: 26px;
          border-radius: 7px;
          border: 1px solid ${colors.border};
          background: ${isDark ? "rgba(24,27,34,0.92)" : "rgba(255,255,255,0.94)"};
          color: ${colors.textMuted};
          box-shadow: ${isDark ? "0 8px 22px rgba(0,0,0,0.32)" : "0 8px 18px rgba(15,23,42,0.12)"};
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 2px;
          cursor: grab;
          opacity: 0.78;
          z-index: 30;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }

        .streetbot-tiptap-drag-handle-grip {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .streetbot-tiptap-drag-handle button {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 5px;
          background: transparent;
          color: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
        }

        .streetbot-tiptap-drag-handle button:hover {
          background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)"};
          color: ${colors.accent};
        }

        .streetbot-tiptap-drag-handle:hover,
        .streetbot-tiptap-drag-handle[data-dragging="true"] {
          opacity: 1;
          color: ${colors.accent};
        }

        .streetbot-tiptap-drag-handle[data-dragging="true"] {
          cursor: grabbing;
        }

        .streetbot-tiptap-block-actions-menu {
          position: absolute;
          top: -4px;
          left: calc(100% + 8px);
          width: 184px;
          padding: 5px;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${isDark ? "rgba(24,27,34,0.98)" : "rgba(255,255,255,0.98)"};
          color: ${colors.text};
          box-shadow: ${isDark ? "0 18px 42px rgba(0,0,0,0.44)" : "0 18px 36px rgba(15,23,42,0.18)"};
          display: grid;
          gap: 3px;
          cursor: default;
          z-index: 70;
        }

        .streetbot-tiptap-block-actions-menu button,
        .streetbot-tiptap-block-actions-menu label {
          width: 100%;
          min-height: 30px;
          height: auto;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: ${colors.text};
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          padding: 0.34rem 0.48rem;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 750;
          text-align: left;
        }

        .streetbot-tiptap-block-actions-menu button {
          cursor: pointer;
        }

        .streetbot-tiptap-block-actions-menu button:hover,
        .streetbot-tiptap-block-actions-menu label:hover {
          border-color: ${colors.border};
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"};
          color: ${colors.accent};
        }

        .streetbot-tiptap-block-style-row {
          width: 100%;
          min-height: 30px;
          border: 1px solid transparent;
          border-radius: 7px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.34rem 0.48rem;
        }

        .streetbot-tiptap-block-style-row svg {
          flex: 0 0 auto;
          color: ${colors.textMuted};
        }

        .streetbot-tiptap-block-actions-menu .streetbot-tiptap-block-style-row button {
          width: 18px;
          min-width: 18px;
          height: 18px;
          min-height: 18px;
          flex: 0 0 18px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          padding: 0;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.28);
        }

        .streetbot-tiptap-block-actions-menu .streetbot-tiptap-block-style-row button:hover {
          border-color: ${colors.accent};
          transform: translateY(-1px);
        }

        .streetbot-tiptap-block-actions-menu button.is-danger {
          color: #dc2626;
        }

        .streetbot-tiptap-block-actions-menu select {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 750;
          outline: none;
        }

        .streetbot-tiptap-table-tools-menu {
          position: absolute;
          top: 38px;
          left: 0;
          width: 238px;
          max-width: calc(100vw - 24px);
          padding: 6px;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${isDark ? "rgba(24,27,34,0.98)" : "rgba(255,255,255,0.98)"};
          color: ${colors.text};
          box-shadow: ${isDark ? "0 18px 42px rgba(0,0,0,0.44)" : "0 18px 42px rgba(15,23,42,0.18)"};
          display: grid;
          grid-template-columns: 1fr;
          gap: 5px;
          z-index: 80;
        }

        .streetbot-tiptap-table-tools-section {
          display: grid;
          gap: 3px;
          padding-bottom: 5px;
          border-bottom: 1px solid ${colors.border};
        }

        .streetbot-tiptap-table-tools-section:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .streetbot-tiptap-table-tools-label {
          padding: 2px 6px;
          color: ${colors.textMuted};
          font-size: 0.66rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        .streetbot-tiptap-table-tools-menu button {
          width: 100%;
          min-height: 30px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: ${colors.text};
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          padding: 0.34rem 0.48rem;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 750;
          text-align: left;
          cursor: pointer;
        }

        .streetbot-tiptap-table-tools-menu button:hover:not(:disabled) {
          border-color: ${colors.border};
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)"};
          color: ${colors.accent};
        }

        .streetbot-tiptap-table-tools-menu button:disabled {
          cursor: default;
          opacity: 0.42;
        }

        .streetbot-tiptap-table-tools-menu button.is-danger {
          color: #dc2626;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-mention {
          border-radius: 999px;
          padding: 0.08rem 0.38rem;
          background: ${isDark ? "rgba(37,99,235,0.22)" : "rgba(37,99,235,0.12)"};
          color: #2563eb;
          font-weight: 750;
          white-space: nowrap;
        }

	        .streetbot-tiptap-editor .streetbot-tiptap-mention-query {
	          border-radius: 4px;
	          background: ${isDark ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.1)"};
	          box-shadow: inset 0 -2px 0 rgba(37,99,235,0.34);
	        }

	        .streetbot-tiptap-editor .streetbot-tiptap-slash-query {
	          border-radius: 4px;
	          background: ${isDark ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.1)"};
	          box-shadow: inset 0 -2px 0 rgba(16,185,129,0.34);
	        }

	        .streetbot-tiptap-slash-menu {
	          position: fixed;
	          z-index: 1000;
	          width: min(360px, calc(100vw - 16px));
	          max-height: min(420px, calc(100vh - 24px));
	          overflow: auto;
	          padding: 5px;
	          border: 1px solid ${colors.border};
	          border-radius: 8px;
	          background: ${isDark ? "rgba(24,27,34,0.98)" : "rgba(255,255,255,0.98)"};
	          box-shadow: ${isDark ? "0 18px 42px rgba(0,0,0,0.44)" : "0 18px 36px rgba(15,23,42,0.18)"};
	        }

	        .streetbot-tiptap-slash-category {
	          padding: 0.46rem 0.65rem 0.26rem;
	          color: ${colors.textMuted};
	          font-size: 0.66rem;
	          font-weight: 850;
	          letter-spacing: 0;
	          text-transform: uppercase;
	        }

	        .streetbot-tiptap-slash-option {
	          width: 100%;
	          min-height: 46px;
	          border: 1px solid transparent;
	          border-radius: 7px;
	          background: transparent;
	          color: ${colors.text};
	          cursor: pointer;
	          display: flex;
	          align-items: flex-start;
	          justify-content: center;
	          flex-direction: column;
	          gap: 2px;
	          padding: 0.42rem 0.65rem;
	          font: inherit;
	          text-align: left;
	        }

	        .streetbot-tiptap-slash-option-row {
	          width: 100%;
	          min-width: 0;
	          display: flex;
	          align-items: center;
	          justify-content: space-between;
	          gap: 10px;
	        }

	        .streetbot-tiptap-slash-option-label,
	        .streetbot-tiptap-slash-option-description {
	          min-width: 0;
	          overflow: hidden;
	          text-overflow: ellipsis;
	          white-space: nowrap;
	        }

	        .streetbot-tiptap-slash-option-description {
	          width: 100%;
	        }

	        .streetbot-tiptap-slash-option-label {
	          font-size: 0.88rem;
	          font-weight: 800;
	        }

	        .streetbot-tiptap-slash-option-shortcut {
	          flex: 0 0 auto;
	          border-radius: 6px;
	          border: 1px solid ${colors.border};
	          padding: 0.08rem 0.34rem;
	          color: ${colors.textMuted};
	          background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)"};
	          font-size: 0.66rem;
	          font-weight: 850;
	        }

	        .streetbot-tiptap-slash-option-description {
	          color: ${colors.textMuted};
	          font-size: 0.72rem;
	          font-weight: 650;
	        }

	        .streetbot-tiptap-slash-option:hover,
	        .streetbot-tiptap-slash-option.is-selected {
	          border-color: ${colors.border};
	          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(16,185,129,0.08)"};
	          color: ${colors.accent};
	        }

	        .streetbot-tiptap-slash-empty {
	          padding: 0.48rem 0.65rem;
	          color: ${colors.textMuted};
	          font-size: 0.86rem;
	        }

	        .streetbot-tiptap-mention-menu {
	          position: fixed;
          z-index: 1000;
          min-width: 190px;
          max-width: min(260px, calc(100vw - 16px));
          padding: 4px;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${isDark ? "rgba(24,27,34,0.98)" : "rgba(255,255,255,0.98)"};
          box-shadow: ${isDark ? "0 18px 42px rgba(0,0,0,0.44)" : "0 18px 36px rgba(15,23,42,0.18)"};
        }

        .streetbot-tiptap-mention-option {
          width: 100%;
          min-height: 34px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: ${colors.text};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 0 0.65rem;
          font: inherit;
          font-size: 0.88rem;
          font-weight: 750;
          text-align: left;
        }

        .streetbot-tiptap-mention-option-label,
        .streetbot-tiptap-mention-option-description {
          width: 100%;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .streetbot-tiptap-mention-option-description {
          margin-top: -1px;
          color: ${colors.textMuted};
          font-size: 0.72rem;
          font-weight: 650;
        }

        .streetbot-tiptap-mention-option:hover,
        .streetbot-tiptap-mention-option.is-selected {
          border-color: ${colors.border};
          background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(37,99,235,0.08)"};
          color: ${colors.accent};
        }

        .streetbot-tiptap-mention-empty {
          padding: 0.48rem 0.65rem;
          color: ${colors.textMuted};
          font-size: 0.86rem;
        }

        .streetbot-tiptap-editor .streetbot-comment-anchor {
          background: ${isDark ? "rgba(37,99,235,0.24)" : "rgba(37,99,235,0.14)"};
          border-bottom: 2px solid #2563eb;
          border-radius: 2px;
          padding: 0 1px;
        }

        .streetbot-tiptap-editor ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .streetbot-tiptap-editor ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
        }

        .streetbot-tiptap-editor ul[data-type="taskList"] li > label {
          margin-top: 0.28rem;
        }

        .streetbot-tiptap-editor ul[data-type="taskList"] li > div {
          flex: 1;
        }

        .streetbot-tiptap-editor .ProseMirror-selectednode {
          outline: 2px solid ${colors.accent};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-focused-node {
          box-shadow: inset 3px 0 0 ${colors.accent};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-block-link-target {
          outline: 2px solid ${isDark ? "rgba(96,165,250,0.82)" : "rgba(37,99,235,0.68)"};
          outline-offset: 4px;
          border-radius: 8px;
          box-shadow: ${isDark ? "0 0 0 7px rgba(96,165,250,0.13)" : "0 0 0 7px rgba(37,99,235,0.1)"};
          transition: outline-color 0.2s ease, box-shadow 0.2s ease;
        }

        .streetbot-tiptap-editor .streetbot-tiptap-search-match {
          border-radius: 3px;
          background: ${isDark ? "rgba(250,204,21,0.28)" : "rgba(250,204,21,0.38)"};
          box-shadow: 0 0 0 1px ${isDark ? "rgba(250,204,21,0.18)" : "rgba(202,138,4,0.2)"};
        }

        .streetbot-tiptap-editor .streetbot-tiptap-search-match.is-active {
          background: ${isDark ? "rgba(96,165,250,0.34)" : "rgba(37,99,235,0.2)"};
          box-shadow: 0 0 0 2px ${isDark ? "rgba(96,165,250,0.58)" : "rgba(37,99,235,0.38)"};
        }

        .streetbot-tiptap-transform-control {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }

        .streetbot-tiptap-code-language-control {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }

        @media (max-width: 980px) {
          .streetbot-tiptap-body {
            flex-direction: column;
          }

          .streetbot-review-panel,
          .streetbot-outline-panel,
          .streetbot-page-panel,
          .streetbot-search-panel {
            width: 100% !important;
            flex-basis: 220px !important;
            border-left: none !important;
          }
        }

        @media (max-width: 720px) {
          .streetbot-tiptap-editor {
            min-height: 420px;
            font-size: 0.95rem;
          }

          .streetbot-tiptap-scroll {
            padding: 16px !important;
          }

          .streetbot-tiptap-transform-control {
            flex: 1 1 140px;
          }

          .streetbot-tiptap-code-language-control {
            flex: 1 1 142px;
          }

          .streetbot-tiptap-transform-control select,
          .streetbot-tiptap-code-language-control select {
            width: 100%;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default TiptapDocumentEditor;
