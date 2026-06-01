import { useEffect, useRef } from 'react';
import { useResetRecoilState } from 'recoil';
import { logger } from '~/utils';
import store from '~/store';

/**
 * Hook to reset visible artifacts when the conversation ID changes
 * @param conversationId - The current conversation ID
 */
export default function useIdChangeEffect(conversationId: string) {
  const lastConvoId = useRef<string | null>(null);
  const resetVisibleArtifacts = useResetRecoilState(store.visibleArtifacts);
  const resetLatestMessage = useResetRecoilState(store.latestMessageFamily(0));
  const resetSubmission = useResetRecoilState(store.submissionByIndex(0));

  useEffect(() => {
    if (conversationId !== lastConvoId.current) {
      logger.log('conversation', 'Conversation ID change');
      resetVisibleArtifacts();
      resetLatestMessage();
      resetSubmission();
    }
    lastConvoId.current = conversationId;
  }, [conversationId, resetLatestMessage, resetSubmission, resetVisibleArtifacts]);
}
