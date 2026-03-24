import { memo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import { useAddedResponse, useResumeOnLoad, useAdaptiveSSE, useChatHelpers } from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import { useGetMessagesByConvoId } from '~/data-provider';
import { isDirectory } from '~/config/appVariant';
import DirectoryHomepage from './DirectoryHomepage';
import HomepageTopNav from './HomepageTopNav';
import HomepageFooter from './HomepageFooter';
import HomepageNews from './HomepageNews';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import { cn } from '~/utils';
import store from '~/store';

function HomepageChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="relative flex h-full w-full flex-col">
              {isLandingPage && <HomepageTopNav />}
              <>
                <div
                  className={cn(
                    'flex flex-col',
                    'flex-1 items-center justify-end sm:justify-center lg:justify-start lg:pt-[30vh] 2xl:justify-center 2xl:pt-0',
                  )}
                >
                  <Landing centerFormOnLanding={centerFormOnLanding} />
                  {isDirectory ? (
                    <DirectoryHomepage />
                  ) : (
                    <div
                      className={cn(
                        'w-full',
                        'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                      )}
                    >
                      <div style={{ transform: 'translateY(-5px)' }}>
                        <ChatForm index={index} />
                      </div>
                      <ConversationStarters />
                    </div>
                  )}
                </div>
                {isLandingPage && <HomepageNews />}
                {isLandingPage && <HomepageFooter />}
              </>
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(HomepageChatView);
