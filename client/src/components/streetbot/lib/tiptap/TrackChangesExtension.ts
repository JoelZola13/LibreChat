/**
 * Track Changes Extension for TipTap
 *
 * Provides collaborative track changes (suggestions) functionality with:
 * - InsertionMark: Green underline for added text
 * - DeletionMark: Red strikethrough for deleted text
 * - TrackChangesExtension: Main extension with commands and keyboard handling
 */

import { Extension, Mark } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { ReplaceStep } from "prosemirror-transform";

// ============================================================================
// Types
// ============================================================================

export interface SuggestionData {
  id: string;
  type: "insertion" | "deletion";
  text: string;
  originalText?: string;
  from: number;
  to: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: string;
}

export interface TrackChangesOptions {
  enabled: boolean;
  userId: string;
  userName: string;
  userColor: string;
  onSuggestionCreate?: (suggestion: SuggestionData) => void;
  onSuggestionResolve?: (
    suggestionId: string,
    action: "accept" | "reject"
  ) => void;
}

// ============================================================================
// Plugin Key
// ============================================================================

export const TrackChangesPluginKey = new PluginKey("trackChanges");

// ============================================================================
// Helper Functions
// ============================================================================

function generateSuggestionId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Insertion Mark
// ============================================================================

export const InsertionMark = Mark.create({
  name: "insertion",

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes) => ({
          "data-suggestion-id": attributes.suggestionId,
        }),
      },
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-id"),
        renderHTML: (attributes) => ({
          "data-author-id": attributes.authorId,
        }),
      },
      authorName: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-name"),
        renderHTML: (attributes) => ({
          "data-author-name": attributes.authorName,
        }),
      },
      authorColor: {
        default: "#22c55e",
        parseHTML: (element) =>
          element.getAttribute("data-author-color") || "#22c55e",
        renderHTML: (attributes) => ({
          "data-author-color": attributes.authorColor,
        }),
      },
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-created-at"),
        renderHTML: (attributes) => ({
          "data-created-at": attributes.createdAt,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'ins[data-suggestion-id]',
      },
      {
        tag: 'span.track-changes-insertion',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes["data-author-color"] || "#22c55e";
    return [
      "ins",
      {
        ...HTMLAttributes,
        class: "track-changes-insertion",
        style: `border-bottom: 2px solid ${color}; background: rgba(34, 197, 94, 0.15); padding: 0 1px; border-radius: 2px;`,
      },
      0,
    ];
  },
});

// ============================================================================
// Deletion Mark
// ============================================================================

export const DeletionMark = Mark.create({
  name: "deletion",

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-suggestion-id"),
        renderHTML: (attributes) => ({
          "data-suggestion-id": attributes.suggestionId,
        }),
      },
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-id"),
        renderHTML: (attributes) => ({
          "data-author-id": attributes.authorId,
        }),
      },
      authorName: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-name"),
        renderHTML: (attributes) => ({
          "data-author-name": attributes.authorName,
        }),
      },
      authorColor: {
        default: "#ef4444",
        parseHTML: (element) =>
          element.getAttribute("data-author-color") || "#ef4444",
        renderHTML: (attributes) => ({
          "data-author-color": attributes.authorColor,
        }),
      },
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-created-at"),
        renderHTML: (attributes) => ({
          "data-created-at": attributes.createdAt,
        }),
      },
      originalText: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-original-text"),
        renderHTML: (attributes) => ({
          "data-original-text": attributes.originalText,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'del[data-suggestion-id]',
      },
      {
        tag: 'span.track-changes-deletion',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes["data-author-color"] || "#ef4444";
    return [
      "del",
      {
        ...HTMLAttributes,
        class: "track-changes-deletion",
        style: `text-decoration: line-through; text-decoration-color: ${color}; text-decoration-thickness: 2px; background: rgba(239, 68, 68, 0.15); color: #999; padding: 0 1px; border-radius: 2px;`,
      },
      0,
    ];
  },
});

// ============================================================================
// Track Changes Extension
// ============================================================================

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trackChanges: {
      /**
       * Toggle track changes mode
       */
      toggleTrackChanges: () => ReturnType;
      /**
       * Enable track changes
       */
      enableTrackChanges: () => ReturnType;
      /**
       * Disable track changes
       */
      disableTrackChanges: () => ReturnType;
      /**
       * Accept a specific suggestion
       */
      acceptSuggestion: (suggestionId: string) => ReturnType;
      /**
       * Reject a specific suggestion
       */
      rejectSuggestion: (suggestionId: string) => ReturnType;
      /**
       * Accept all suggestions
       */
      acceptAllSuggestions: () => ReturnType;
      /**
       * Reject all suggestions
       */
      rejectAllSuggestions: () => ReturnType;
      /**
       * Set track changes user info
       */
      setTrackChangesUser: (userId: string, userName: string, userColor: string) => ReturnType;
    };
  }

  // Extend Storage interface for track changes
  interface Storage {
    trackChanges: {
      enabled: boolean;
    };
  }
}

export const TrackChangesExtension = Extension.create<TrackChangesOptions>({
  name: "trackChanges",

  addOptions() {
    return {
      enabled: false,
      userId: "",
      userName: "Anonymous",
      userColor: "#6366f1",
      onSuggestionCreate: undefined,
      onSuggestionResolve: undefined,
    };
  },

  addStorage() {
    return {
      enabled: this.options.enabled,
    };
  },

  addCommands() {
    return {
      toggleTrackChanges:
        () =>
        ({ editor }) => {
          this.storage.enabled = !this.storage.enabled;
          (editor as unknown as { emit: (event: string, data: unknown) => void }).emit(
            "trackChangesToggled",
            { enabled: this.storage.enabled }
          );
          return true;
        },

      enableTrackChanges:
        () =>
        ({ editor }) => {
          this.storage.enabled = true;
          (editor as unknown as { emit: (event: string, data: unknown) => void }).emit(
            "trackChangesToggled",
            { enabled: true }
          );
          return true;
        },

      disableTrackChanges:
        () =>
        ({ editor }) => {
          this.storage.enabled = false;
          (editor as unknown as { emit: (event: string, data: unknown) => void }).emit(
            "trackChangesToggled",
            { enabled: false }
          );
          return true;
        },

      setTrackChangesUser:
        (userId: string, userName: string, userColor: string) =>
        () => {
          this.options.userId = userId;
          this.options.userName = userName;
          this.options.userColor = userColor;
          return true;
        },

      acceptSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          let modified = false;

          // Find all marks with this suggestionId
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (
                (mark.type.name === "insertion" || mark.type.name === "deletion") &&
                mark.attrs.suggestionId === suggestionId
              ) {
                if (mark.type.name === "insertion") {
                  // For insertions: remove the mark, keep the text
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  modified = true;
                } else if (mark.type.name === "deletion") {
                  // For deletions: remove the text and the mark
                  tr.delete(pos, pos + node.nodeSize);
                  modified = true;
                }
              }
            });
          });

          if (modified) {
            dispatch(tr);
            this.options.onSuggestionResolve?.(suggestionId, "accept");
          }

          return modified;
        },

      rejectSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          let modified = false;

          // Find all marks with this suggestionId
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (
                (mark.type.name === "insertion" || mark.type.name === "deletion") &&
                mark.attrs.suggestionId === suggestionId
              ) {
                if (mark.type.name === "insertion") {
                  // For insertions: remove the text and the mark
                  tr.delete(pos, pos + node.nodeSize);
                  modified = true;
                } else if (mark.type.name === "deletion") {
                  // For deletions: remove the mark, keep the text
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  modified = true;
                }
              }
            });
          });

          if (modified) {
            dispatch(tr);
            this.options.onSuggestionResolve?.(suggestionId, "reject");
          }

          return modified;
        },

      acceptAllSuggestions:
        () =>
        ({ commands, state }) => {
          const suggestionIds = new Set<string>();

          state.doc.descendants((node) => {
            node.marks.forEach((mark) => {
              if (
                (mark.type.name === "insertion" || mark.type.name === "deletion") &&
                mark.attrs.suggestionId
              ) {
                suggestionIds.add(mark.attrs.suggestionId);
              }
            });
          });

          suggestionIds.forEach((id) => {
            commands.acceptSuggestion(id);
          });

          return true;
        },

      rejectAllSuggestions:
        () =>
        ({ commands, state }) => {
          const suggestionIds = new Set<string>();

          state.doc.descendants((node) => {
            node.marks.forEach((mark) => {
              if (
                (mark.type.name === "insertion" || mark.type.name === "deletion") &&
                mark.attrs.suggestionId
              ) {
                suggestionIds.add(mark.attrs.suggestionId);
              }
            });
          });

          suggestionIds.forEach((id) => {
            commands.rejectSuggestion(id);
          });

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        if (!this.storage.enabled) return false;

        const { from, to, empty } = editor.state.selection;

        if (empty) {
          // Delete previous character - wrap in deletion mark
          const pos = from - 1;
          if (pos >= 0) {
            const text = editor.state.doc.textBetween(pos, from);
            if (text) {
              const suggestionId = generateSuggestionId();
              const attrs = {
                suggestionId,
                authorId: this.options.userId,
                authorName: this.options.userName,
                authorColor: this.options.userColor,
                createdAt: new Date().toISOString(),
                originalText: text,
              };

              // Apply deletion mark instead of deleting
              editor
                .chain()
                .setTextSelection({ from: pos, to: from })
                .setMark("deletion", attrs)
                .setTextSelection(from)
                .run();

              // Notify about suggestion creation
              this.options.onSuggestionCreate?.({
                id: suggestionId,
                type: "deletion",
                text: text,
                originalText: text,
                from: pos,
                to: from,
                authorId: this.options.userId,
                authorName: this.options.userName,
                authorColor: this.options.userColor,
                createdAt: attrs.createdAt,
              });

              return true;
            }
          }
        } else {
          // Delete selection - wrap in deletion mark
          const text = editor.state.doc.textBetween(from, to);
          if (text) {
            const suggestionId = generateSuggestionId();
            const attrs = {
              suggestionId,
              authorId: this.options.userId,
              authorName: this.options.userName,
              authorColor: this.options.userColor,
              createdAt: new Date().toISOString(),
              originalText: text,
            };

            editor
              .chain()
              .setMark("deletion", attrs)
              .setTextSelection(to)
              .run();

            // Notify about suggestion creation
            this.options.onSuggestionCreate?.({
              id: suggestionId,
              type: "deletion",
              text: text,
              originalText: text,
              from,
              to,
              authorId: this.options.userId,
              authorName: this.options.userName,
              authorColor: this.options.userColor,
              createdAt: attrs.createdAt,
            });

            return true;
          }
        }

        return false;
      },

      Delete: ({ editor }) => {
        if (!this.storage.enabled) return false;

        const { from, to, empty } = editor.state.selection;

        if (empty) {
          // Delete next character - wrap in deletion mark
          const pos = from + 1;
          if (pos <= editor.state.doc.content.size) {
            const text = editor.state.doc.textBetween(from, pos);
            if (text) {
              const suggestionId = generateSuggestionId();
              const attrs = {
                suggestionId,
                authorId: this.options.userId,
                authorName: this.options.userName,
                authorColor: this.options.userColor,
                createdAt: new Date().toISOString(),
                originalText: text,
              };

              editor
                .chain()
                .setTextSelection({ from, to: pos })
                .setMark("deletion", attrs)
                .setTextSelection(from)
                .run();

              this.options.onSuggestionCreate?.({
                id: suggestionId,
                type: "deletion",
                text: text,
                originalText: text,
                from,
                to: pos,
                authorId: this.options.userId,
                authorName: this.options.userName,
                authorColor: this.options.userColor,
                createdAt: attrs.createdAt,
              });

              return true;
            }
          }
        }

        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: TrackChangesPluginKey,

        appendTransaction(transactions, oldState, newState) {
          if (!extension.storage.enabled) return null;

          // Check if any transaction added text
          const textAdded = transactions.some(
            (tr) => tr.docChanged && tr.steps.length > 0
          );

          if (!textAdded) return null;

          // Check if the change was a text insertion (not from marks)
          let hasNewText = false;
          let insertionFrom = 0;
          let insertionTo = 0;
          let insertedText = "";

          transactions.forEach((tr) => {
            tr.steps.forEach((step) => {
              // Type guard for ReplaceStep which has slice, from, and to
              if (step instanceof ReplaceStep && step.slice.content.size > 0) {
                const from = step.from;
                const to = step.to;

                // Check if this is just adding marks (not new content)
                const stepContent = step.slice.content;
                if (stepContent.childCount > 0) {
                  const firstChild = stepContent.child(0);
                  // If the content doesn't have our marks, it's new text
                  const hasSuggestionMark = firstChild.marks.some(
                    (m: { type: { name: string } }) =>
                      m.type.name === "insertion" || m.type.name === "deletion"
                  );

                  if (!hasSuggestionMark && firstChild.isText) {
                    hasNewText = true;
                    insertionFrom = from;
                    insertionTo = from + stepContent.size;
                    insertedText = firstChild.text || "";
                  }
                }
              }
            });
          });

          if (!hasNewText || !insertedText) return null;

          // Create a new transaction to wrap the inserted text with insertion mark
          const tr = newState.tr;
          const suggestionId = generateSuggestionId();
          const attrs = {
            suggestionId,
            authorId: extension.options.userId,
            authorName: extension.options.userName,
            authorColor: extension.options.userColor,
            createdAt: new Date().toISOString(),
          };

          const insertionMark = newState.schema.marks.insertion.create(attrs);
          tr.addMark(insertionFrom, insertionTo, insertionMark);

          // Notify about suggestion creation
          extension.options.onSuggestionCreate?.({
            id: suggestionId,
            type: "insertion",
            text: insertedText,
            from: insertionFrom,
            to: insertionTo,
            authorId: extension.options.userId,
            authorName: extension.options.userName,
            authorColor: extension.options.userColor,
            createdAt: attrs.createdAt,
          });

          return tr;
        },
      }),
    ];
  },
});

// ============================================================================
// Helper to get all suggestions from document
// ============================================================================

export function getSuggestionsFromDoc(
  doc: ReturnType<typeof import("@tiptap/core").Editor.prototype.getJSON>
): SuggestionData[] {
  const suggestions: SuggestionData[] = [];

  function traverse(node: unknown, pos: number = 0): number {
    const typedNode = node as {
      type?: string;
      content?: unknown[];
      marks?: Array<{
        type: string;
        attrs: Record<string, unknown>;
      }>;
      text?: string;
    };

    if (!typedNode) return pos;

    if (typedNode.marks) {
      typedNode.marks.forEach((mark) => {
        if (mark.type === "insertion" || mark.type === "deletion") {
          suggestions.push({
            id: mark.attrs.suggestionId as string,
            type: mark.type as "insertion" | "deletion",
            text: typedNode.text || "",
            originalText: mark.attrs.originalText as string | undefined,
            from: pos,
            to: pos + (typedNode.text?.length || 0),
            authorId: mark.attrs.authorId as string,
            authorName: mark.attrs.authorName as string,
            authorColor: mark.attrs.authorColor as string,
            createdAt: mark.attrs.createdAt as string,
          });
        }
      });
    }

    if (typedNode.content) {
      let currentPos = pos;
      typedNode.content.forEach((child) => {
        currentPos = traverse(child, currentPos);
      });
      return currentPos;
    }

    if (typedNode.text) {
      return pos + typedNode.text.length;
    }

    return pos + 1;
  }

  traverse(doc);
  return suggestions;
}

// ============================================================================
// Export all
// ============================================================================

export default TrackChangesExtension;
