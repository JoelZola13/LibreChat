/**
 * Custom EditorialImage block for BlockNote.
 * Extends default image with caption, credit, and layout hint fields.
 */
import { createReactBlockSpec } from '@blocknote/react';
import { defaultProps } from '@blocknote/core';
import { useState } from 'react';

const EditorialImageBlock = createReactBlockSpec(
  {
    type: 'editorialImage' as const,
    propSchema: {
      backgroundColor: defaultProps.backgroundColor,
      url: { default: '' as const },
      caption: { default: '' as const },
      credit: { default: '' as const },
      layoutHint: {
        default: 'full' as const,
        values: ['full', 'wide', 'pair'] as const,
      },
    },
    content: 'none' as const,
  },
  {
    render: ({ block, editor }) => {
      const { url, caption, credit, layoutHint } = block.props;
      const [localUrl, setLocalUrl] = useState(url);

      const updateProp = (key: string, value: string) => {
        editor.updateBlock(block, { props: { [key]: value } as any });
      };

      if (!url) {
        return (
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              border: '2px dashed rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              Add an editorial image
            </div>
            <input
              type="text"
              placeholder="Paste image URL..."
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              onBlur={() => { if (localUrl) updateProp('url', localUrl); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && localUrl) updateProp('url', localUrl);
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
        );
      }

      return (
        <div
          style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <img
            src={url}
            alt={caption || ''}
            style={{
              width: '100%',
              maxHeight: '500px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Caption..."
              value={caption}
              onChange={(e) => updateProp('caption', e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '14px',
                outline: 'none',
                padding: '4px 0',
                fontStyle: 'italic',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Photo credit..."
                value={credit}
                onChange={(e) => updateProp('credit', e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '12px',
                  outline: 'none',
                  padding: '2px 0',
                  flex: 1,
                }}
              />
              <select
                value={layoutHint}
                onChange={(e) => updateProp('layoutHint', e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="full">Full Width</option>
                <option value="wide">Wide</option>
                <option value="pair">Pair (side-by-side)</option>
              </select>
            </div>
          </div>
        </div>
      );
    },
  },
);

export default EditorialImageBlock;
