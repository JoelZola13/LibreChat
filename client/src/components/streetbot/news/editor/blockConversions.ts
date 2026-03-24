/**
 * Block conversion utilities for the news editor.
 * Converts between BlockNote JSON blocks and HTML.
 */

type InlineContent = {
  type: 'text';
  text: string;
  styles?: Record<string, boolean | string>;
} | {
  type: 'link';
  href: string;
  content: InlineContent[];
};

type BlockProps = Record<string, unknown>;

export type EditorBlock = {
  id?: string;
  type: string;
  props?: BlockProps;
  content?: InlineContent[] | string;
  children?: EditorBlock[];
};

/**
 * Extract gallery images from blocks (editorialImage blocks).
 */
export function extractGalleryImages(blocks: EditorBlock[]): Array<{
  url: string;
  caption?: string;
  credit?: string;
  layout_hint?: string;
}> {
  const images: Array<{ url: string; caption?: string; credit?: string; layout_hint?: string }> = [];
  for (const block of blocks) {
    if (block.type === 'editorialImage' && block.props?.url) {
      images.push({
        url: block.props.url as string,
        caption: (block.props.caption as string) || undefined,
        credit: (block.props.credit as string) || undefined,
        layout_hint: (block.props.layoutHint as string) || 'full',
      });
    }
    if (block.type === 'image' && block.props?.url) {
      images.push({
        url: block.props.url as string,
        caption: (block.props.caption as string) || undefined,
      });
    }
  }
  return images;
}

/** Escape HTML entities */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert inline content array to HTML string */
function inlineToHtml(content: InlineContent[] | string | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return esc(content);
  return content.map((item) => {
    if (item.type === 'text') {
      let text = esc(item.text);
      const s = item.styles || {};
      if (s.bold) text = `<strong>${text}</strong>`;
      if (s.italic) text = `<em>${text}</em>`;
      if (s.underline) text = `<u>${text}</u>`;
      if (s.strike) text = `<s>${text}</s>`;
      if (s.code) text = `<code>${text}</code>`;
      return text;
    }
    if (item.type === 'link') {
      return `<a href="${esc(item.href)}">${inlineToHtml(item.content)}</a>`;
    }
    return '';
  }).join('');
}

/**
 * Convert BlockNote JSON blocks to an HTML string.
 */
export function blocksToHtml(blocks: EditorBlock[]): string {
  const parts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const inner = inlineToHtml(block.content);
    const props = block.props || {};

    switch (block.type) {
      case 'paragraph':
        parts.push(`<p>${inner}</p>`);
        break;

      case 'heading': {
        const level = Math.min(Math.max(Number(props.level) || 2, 1), 6);
        parts.push(`<h${level}>${inner}</h${level}>`);
        break;
      }

      case 'bulletListItem': {
        const items = [`<li>${inner}</li>`];
        let j = i + 1;
        while (j < blocks.length && blocks[j].type === 'bulletListItem') {
          items.push(`<li>${inlineToHtml(blocks[j].content)}</li>`);
          j++;
        }
        parts.push(`<ul>${items.join('')}</ul>`);
        i = j - 1;
        break;
      }

      case 'numberedListItem': {
        const items = [`<li>${inner}</li>`];
        let j = i + 1;
        while (j < blocks.length && blocks[j].type === 'numberedListItem') {
          items.push(`<li>${inlineToHtml(blocks[j].content)}</li>`);
          j++;
        }
        parts.push(`<ol>${items.join('')}</ol>`);
        i = j - 1;
        break;
      }

      case 'quote':
        parts.push(`<blockquote>${inner}</blockquote>`);
        break;

      case 'image':
        if (props.url) {
          const cap = props.caption ? `<figcaption>${esc(String(props.caption))}</figcaption>` : '';
          parts.push(`<figure><img src="${esc(String(props.url))}" alt="${esc(String(props.caption || ''))}" />${cap}</figure>`);
        }
        break;

      case 'editorialImage':
        if (props.url) {
          let cap = `<figcaption>${esc(String(props.caption || ''))}`;
          if (props.credit) cap += ` <cite>${esc(String(props.credit))}</cite>`;
          cap += '</figcaption>';
          const layout = String(props.layoutHint || 'full');
          parts.push(
            `<figure class="editorial-${esc(layout)}">` +
            `<img src="${esc(String(props.url))}" alt="${esc(String(props.caption || ''))}" />` +
            `${cap}</figure>`
          );
        }
        break;

      case 'codeBlock': {
        const code = Array.isArray(block.content)
          ? block.content.map((c) => ('text' in c ? c.text : '')).join('')
          : '';
        parts.push(`<pre><code>${esc(code)}</code></pre>`);
        break;
      }

      default:
        if (inner) parts.push(`<p>${inner}</p>`);
        break;
    }
    i++;
  }

  return parts.join('\n');
}

/**
 * Attempt to parse simple HTML into BlockNote blocks.
 * This is a best-effort converter for legacy articles.
 */
export function tryParseHtmlToBlocks(html: string): EditorBlock[] {
  const blocks: EditorBlock[] = [];

  // Use DOMParser if available (browser)
  if (typeof DOMParser === 'undefined') {
    // Fallback: wrap in a single paragraph
    return [{ type: 'paragraph', content: [{ type: 'text', text: html.replace(/<[^>]+>/g, ''), styles: {} }] }];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const elements = doc.body.children;

  function nodeToInline(node: Node): InlineContent[] {
    const result: InlineContent[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text) result.push({ type: 'text', text, styles: {} });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();

        if (tag === 'a') {
          result.push({
            type: 'link',
            href: el.getAttribute('href') || '',
            content: nodeToInline(el),
          });
        } else if (tag === 'strong' || tag === 'b') {
          const inner = nodeToInline(el);
          inner.forEach((item) => {
            if (item.type === 'text') item.styles = { ...item.styles, bold: true };
          });
          result.push(...inner);
        } else if (tag === 'em' || tag === 'i') {
          const inner = nodeToInline(el);
          inner.forEach((item) => {
            if (item.type === 'text') item.styles = { ...item.styles, italic: true };
          });
          result.push(...inner);
        } else if (tag === 'u') {
          const inner = nodeToInline(el);
          inner.forEach((item) => {
            if (item.type === 'text') item.styles = { ...item.styles, underline: true };
          });
          result.push(...inner);
        } else if (tag === 'code') {
          const inner = nodeToInline(el);
          inner.forEach((item) => {
            if (item.type === 'text') item.styles = { ...item.styles, code: true };
          });
          result.push(...inner);
        } else {
          result.push(...nodeToInline(el));
        }
      }
    });
    return result;
  }

  for (let idx = 0; idx < elements.length; idx++) {
    const el = elements[idx];
    const tag = el.tagName.toLowerCase();

    if (tag === 'p') {
      blocks.push({ type: 'paragraph', content: nodeToInline(el) });
    } else if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: 'heading', props: { level: parseInt(tag[1], 10) }, content: nodeToInline(el) });
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', content: nodeToInline(el) });
    } else if (tag === 'ul') {
      el.querySelectorAll(':scope > li').forEach((li) => {
        blocks.push({ type: 'bulletListItem', content: nodeToInline(li) });
      });
    } else if (tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li) => {
        blocks.push({ type: 'numberedListItem', content: nodeToInline(li) });
      });
    } else if (tag === 'figure') {
      const img = el.querySelector('img');
      const figcaption = el.querySelector('figcaption');
      const cite = figcaption?.querySelector('cite');
      if (img) {
        const className = el.getAttribute('class') || '';
        const layoutMatch = className.match(/editorial-(\w+)/);
        blocks.push({
          type: layoutMatch ? 'editorialImage' : 'image',
          props: {
            url: img.getAttribute('src') || '',
            caption: figcaption ? (figcaption.textContent || '').replace(cite?.textContent || '', '').trim() : '',
            ...(layoutMatch ? { credit: cite?.textContent || '', layoutHint: layoutMatch[1] } : {}),
          },
        });
      }
    } else if (tag === 'pre') {
      const code = el.querySelector('code');
      blocks.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: code?.textContent || el.textContent || '', styles: {} }],
      });
    } else {
      // Fallback: treat as paragraph
      const text = el.textContent?.trim();
      if (text) {
        blocks.push({ type: 'paragraph', content: nodeToInline(el) });
      }
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [{ type: 'text', text: '', styles: {} }] }];
}
