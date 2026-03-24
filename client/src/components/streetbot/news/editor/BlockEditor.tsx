/**
 * BlockEditor — Main BlockNote editor wrapper with custom schema and glassmorphism theme.
 */
import { useEffect, useMemo } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, type Block, type PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import EditorialImageBlock from './EditorialImageBlock';
import { editorThemeCSS } from './editorTheme';

// Custom schema with editorialImage block added
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    editorialImage: EditorialImageBlock(),
  },
});

export type EditorSchema = typeof schema;
export type EditorBlock = Block<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

interface BlockEditorProps {
  initialBlocks?: PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>[];
  onChange?: (blocks: EditorBlock[]) => void;
  editable?: boolean;
}

export default function BlockEditor({ initialBlocks, onChange, editable = true }: BlockEditorProps) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
  });

  // Sync editable state
  useEffect(() => {
    editor.isEditable = editable;
  }, [editor, editable]);

  const memoizedStyle = useMemo(
    () => ({
      minHeight: '400px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      overflow: 'hidden',
    }),
    [],
  );

  return (
    <div>
      <style>{editorThemeCSS}</style>
      <div style={memoizedStyle}>
        <BlockNoteView
          editor={editor}
          onChange={() => {
            onChange?.(editor.document as EditorBlock[]);
          }}
          theme="dark"
          data-theming-css-variables-demo
        />
      </div>
    </div>
  );
}

export { schema };
