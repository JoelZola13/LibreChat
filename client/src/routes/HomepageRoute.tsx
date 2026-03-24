import { useEffect } from 'react';
import { Spinner } from '@librechat/client';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { Constants, EModelEndpoint } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import { useNewConvo, useAppStartup, useAssistantListMap, useAuthContext } from '~/hooks';
import { getDefaultModelSpec, getModelSpecPreset, logger } from '~/utils';
import { ToolCallsMapProvider } from '~/Providers';
import HomepageChatView from '~/components/Chat/HomepageChatView';
import temporaryStore from '~/store/temporary';
import store from '~/store';

export default function HomepageRoute() {
  const { data: startupConfig } = useGetStartupConfig();
  const { isAuthenticated, user, roles } = useAuthContext();

  const defaultTemporaryChat = useRecoilValue(temporaryStore.defaultTemporaryChat);
  const setIsTemporary = useRecoilCallback(
    ({ set }) =>
      (value: boolean) => {
        set(temporaryStore.isTemporary, value);
      },
    [],
  );
  useAppStartup({ startupConfig, user });

  const index = 0;
  const conversationId = Constants.NEW_CONVO;
  const { hasSetConversation, conversation } = store.useCreateConversationAtom(index);
  const { newConversation } = useNewConvo();

  const modelsQuery = useGetModelsQuery({
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  });
  const endpointsQuery = useGetEndpointsQuery({ enabled: isAuthenticated });
  const assistantListMap = useAssistantListMap();

  useEffect(() => {
    setIsTemporary(defaultTemporaryChat);
  }, [setIsTemporary, defaultTemporaryChat]);

  useEffect(() => {
    const rolesLoaded = roles?.USER != null;
    const shouldSetConvo =
      (startupConfig && rolesLoaded && !hasSetConversation.current && !modelsQuery.data?.initial) ??
      false;
    if (!shouldSetConvo) {
      return;
    }

    if (endpointsQuery.data && modelsQuery.data) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      logger.log('conversation', 'HomepageRoute, new convo effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        template: conversation ? conversation : undefined,
        ...(spec ? { preset: getModelSpecPreset(spec) } : {}),
        skipNavigation: true,
      });
      hasSetConversation.current = true;
    } else if (
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      logger.log('conversation', 'HomepageRoute new convo, assistants effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        template: conversation ? conversation : undefined,
        ...(spec ? { preset: getModelSpecPreset(spec) } : {}),
        skipNavigation: true,
      });
      hasSetConversation.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roles,
    startupConfig,
    endpointsQuery.data,
    modelsQuery.data,
    assistantListMap,
  ]);

  if (endpointsQuery.isLoading || modelsQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  return (
    <ToolCallsMapProvider conversationId={conversation.conversationId ?? ''}>
      <HomepageChatView index={index} />
    </ToolCallsMapProvider>
  );
}
