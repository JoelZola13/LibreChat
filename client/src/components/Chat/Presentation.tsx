import { useRecoilValue } from 'recoil';
import { useEffect, useMemo } from 'react';
import { FileSources, LocalStorageKeys } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { useDeleteFilesMutation } from '~/data-provider';
import DragDropWrapper from '~/components/Chat/Input/Files/DragDropWrapper';
import { EditorProvider, SidePanelProvider, ArtifactsProvider } from '~/Providers';
import Artifacts from '~/components/Artifacts/Artifacts';
import { SidePanelGroup } from '~/components/SidePanel';
import { useSetFilesToDelete } from '~/hooks';
import { logger } from '~/utils';
import store from '~/store';
import { isStreetBot } from '~/config/appVariant';

const parseStoredJSON = <T,>(key: string, fallback: T): T => {
  const value = localStorage.getItem(key);
  if (!value || value === 'undefined' || value === 'null') {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn('presentation', `Resetting invalid localStorage JSON for ${key}`, { error });
    localStorage.removeItem(key);
    return fallback;
  }
};

export default function Presentation({ children }: { children: React.ReactNode }) {
  const artifacts = useRecoilValue(store.artifactsState);
  const artifactsVisibility = useRecoilValue(store.artifactsVisibility);

  const setFilesToDelete = useSetFilesToDelete();

  const { mutateAsync } = useDeleteFilesMutation({
    onSuccess: () => {
      console.log('Temporary Files deleted');
      setFilesToDelete({});
    },
    onError: (error) => {
      console.log('Error deleting temporary files:', error);
    },
  });

  useEffect(() => {
    const map = parseStoredJSON<Record<string, ExtendedFile>>(LocalStorageKeys.FILES_TO_DELETE, {});
    const files = Object.values(map)
      .filter(
        (file) =>
          file.filepath != null && file.source && !(file.embedded ?? false) && file.temp_file_id,
      )
      .map((file) => ({
        file_id: file.file_id,
        filepath: file.filepath as string,
        source: file.source as FileSources,
        embedded: !!(file.embedded ?? false),
      }));

    if (files.length === 0) {
      return;
    }
    mutateAsync({ files });
  }, [mutateAsync]);

  const defaultLayout = useMemo(() => {
    return parseStoredJSON<unknown>('react-resizable-panels:layout', undefined);
  }, []);
  const defaultCollapsed = useMemo(() => {
    return parseStoredJSON<boolean>('react-resizable-panels:collapsed', true);
  }, []);
  const fullCollapse = useMemo(() => localStorage.getItem('fullPanelCollapse') === 'true', []);

  /**
   * Memoize artifacts JSX to prevent recreating it on every render
   * This is critical for performance - prevents entire artifact tree from re-rendering
   */
  const artifactsElement = useMemo(() => {
    if (artifactsVisibility === true && Object.keys(artifacts ?? {}).length > 0) {
      return (
        <ArtifactsProvider>
          <EditorProvider>
            <Artifacts />
          </EditorProvider>
        </ArtifactsProvider>
      );
    }
    return null;
  }, [artifactsVisibility, artifacts]);

  const content = (
    <main className="flex h-full flex-col overflow-y-auto" role="main">
      {children}
    </main>
  );

  if (isStreetBot) {
    return (
      <DragDropWrapper className="relative flex w-full grow overflow-hidden bg-transparent">
        {content}
      </DragDropWrapper>
    );
  }

  return (
    <DragDropWrapper className="relative flex w-full grow overflow-hidden bg-presentation">
      <SidePanelProvider>
        <SidePanelGroup
          defaultLayout={defaultLayout}
          fullPanelCollapse={fullCollapse}
          defaultCollapsed={defaultCollapsed}
          artifacts={artifactsElement}
        >
          {content}
        </SidePanelGroup>
      </SidePanelProvider>
    </DragDropWrapper>
  );
}
