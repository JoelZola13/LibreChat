/**
 * Glassmorphism theme for BlockNote editor.
 * Matches the Street Voices dark stone + gold accent design system.
 */

/** CSS to inject into the editor wrapper for glassmorphism theming */
export const editorThemeCSS = `
  .bn-editor {
    font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
  }

  /* BlockNote container overrides */
  .bn-container[data-theming-css-variables-demo] {
    --bn-colors-editor-text: #fff;
    --bn-colors-editor-background: transparent;
    --bn-colors-menu-text: #fff;
    --bn-colors-menu-background: rgba(12, 10, 9, 0.95);
    --bn-colors-tooltip-text: #fff;
    --bn-colors-tooltip-background: rgba(12, 10, 9, 0.95);
    --bn-colors-hovered-text: #fff;
    --bn-colors-hovered-background: rgba(255, 255, 255, 0.08);
    --bn-colors-selected-text: #0C0A09;
    --bn-colors-selected-background: #FFD600;
    --bn-colors-disabled-text: rgba(255, 255, 255, 0.3);
    --bn-colors-disabled-background: rgba(255, 255, 255, 0.05);
    --bn-colors-shadow: rgba(0, 0, 0, 0.4);
    --bn-colors-border: rgba(255, 255, 255, 0.15);
    --bn-colors-side-menu: rgba(255, 255, 255, 0.4);
    --bn-font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --bn-border-radius: 12px;
  }

  /* Glass menus */
  .bn-container .bn-side-menu,
  .bn-container .bn-formatting-toolbar,
  .bn-container .bn-slash-menu,
  .bn-container .bn-link-toolbar,
  .bn-container .bn-suggestion-menu {
    background: rgba(12, 10, 9, 0.9) !important;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
  }

  /* Suggestion/slash menu items */
  .bn-container .bn-suggestion-menu .bn-suggestion-menu-item:hover,
  .bn-container .bn-suggestion-menu .bn-suggestion-menu-item.bn-selected-suggestion-menu-item {
    background: rgba(255, 255, 255, 0.08) !important;
  }

  /* Drag handle */
  .bn-container .bn-side-menu .bn-button {
    color: rgba(255, 255, 255, 0.4);
  }
  .bn-container .bn-side-menu .bn-button:hover {
    color: #FFD600;
    background: rgba(255, 214, 0, 0.1);
  }

  /* Toolbar buttons */
  .bn-container .bn-formatting-toolbar .bn-button:hover,
  .bn-container .bn-formatting-toolbar .bn-button[data-active="true"] {
    background: rgba(255, 214, 0, 0.15) !important;
    color: #FFD600 !important;
  }

  /* Placeholder text */
  .bn-editor .bn-block-content:before {
    color: rgba(255, 255, 255, 0.3) !important;
  }

  /* Selection highlight */
  .bn-editor .ProseMirror ::selection {
    background: rgba(255, 214, 0, 0.3);
  }

  /* Headings */
  .bn-editor h1, .bn-editor h2, .bn-editor h3 {
    font-family: 'Rubik', sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* Blockquote */
  .bn-editor [data-content-type="quote"] {
    border-left: 3px solid #FFD600;
    padding-left: 1em;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Link styling */
  .bn-editor a {
    color: #FFD600;
    text-decoration: underline;
    text-decoration-color: rgba(255, 214, 0, 0.4);
  }

  /* Code block */
  .bn-editor [data-content-type="codeBlock"] {
    background: rgba(0, 0, 0, 0.3) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  /* Image blocks */
  .bn-editor [data-content-type="image"],
  .bn-editor [data-content-type="editorialImage"] {
    border-radius: 12px;
    overflow: hidden;
  }

  /* Drag indicator */
  .bn-editor .bn-drag-preview {
    border: 2px solid #FFD600;
    border-radius: 8px;
    background: rgba(255, 214, 0, 0.05);
  }

  /* Drop indicator */
  .ProseMirror-dropcursor {
    background: #FFD600 !important;
  }
`;
