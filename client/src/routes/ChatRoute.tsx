import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import {
  Constants,
  EModelEndpoint,
  type TStartupConfig,
  type TPreset,
} from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { useGetConvoIdQuery, useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import { useNewConvo, useAppStartup, useAssistantListMap, useIdChangeEffect } from '~/hooks';
import { getDefaultModelSpec, getModelSpecPreset, logger } from '~/utils';
import { ToolCallsMapProvider } from '~/Providers';
import ChatView from '~/components/Chat/ChatView';
import useAuthRedirect from './useAuthRedirect';
import temporaryStore from '~/store/temporary';
import store from '~/store';

function getRequestedAgentPreset(
  startupConfig: TStartupConfig | undefined,
  requestedAgentModel: string,
): TPreset | undefined {
  const model = requestedAgentModel.trim();
  if (!model.startsWith('agent/')) {
    return undefined;
  }

  const spec = startupConfig?.modelSpecs?.list?.find(
    (modelSpec) => modelSpec.name === model || modelSpec.preset?.model === model,
  );
  if (spec) {
    return getModelSpecPreset(spec);
  }

  return {
    endpoint: 'Street Bot',
    endpointType: EModelEndpoint.custom,
    model,
    spec: model,
  };
}

export default function ChatRoute() {
  const { data: startupConfig } = useGetStartupConfig();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, roles } = useAuthRedirect();
  const requestedAgentModel = searchParams.get('agentModel') ?? searchParams.get('spec') ?? '';
  const requestedAgentPreset = getRequestedAgentPreset(
    startupConfig,
    requestedAgentModel,
  );

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
  const { conversationId = '' } = useParams();
  useIdChangeEffect(conversationId);
  const { hasSetConversation, conversation } = store.useCreateConversationAtom(index);
  const { newConversation } = useNewConvo();
  const lastConversationIdRef = useRef(conversationId);

  useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      hasSetConversation.current = false;
      lastConversationIdRef.current = conversationId;
    }
  }, [conversationId, hasSetConversation]);

  const modelsQuery = useGetModelsQuery({
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  });
  const initialConvoQuery = useGetConvoIdQuery(conversationId, {
    enabled:
      isAuthenticated && conversationId !== Constants.NEW_CONVO && !hasSetConversation.current,
  });
  const endpointsQuery = useGetEndpointsQuery({ enabled: isAuthenticated });
  const assistantListMap = useAssistantListMap();

  const isTemporaryChat = conversation && conversation.expiredAt ? true : false;

  useEffect(() => {
    if (conversationId === Constants.NEW_CONVO) {
      setIsTemporary(defaultTemporaryChat);
    } else if (isTemporaryChat) {
      setIsTemporary(isTemporaryChat);
    } else {
      setIsTemporary(false);
    }
  }, [conversationId, isTemporaryChat, setIsTemporary, defaultTemporaryChat]);

  /** This effect is mainly for the first conversation state change on first load of the page.
   *  Adjusting this may have unintended consequences on the conversation state.
   */
  useEffect(() => {
    // Wait for roles when available, but do not block authenticated local sessions forever.
    const rolesLoaded = roles?.USER != null || isAuthenticated;
    const requestedSpecMismatch =
      conversationId === Constants.NEW_CONVO &&
      requestedAgentModel.startsWith('agent/') &&
      conversation?.spec !== requestedAgentModel;
    const shouldSetConvo =
      (startupConfig &&
        rolesLoaded &&
        (!hasSetConversation.current || requestedSpecMismatch) &&
        !modelsQuery.data?.initial) ??
      false;
    /* Early exit if startupConfig is not loaded and conversation is already set and only initial models have loaded */
    if (!shouldSetConvo) {
      return;
    }

    if (conversationId === Constants.NEW_CONVO && endpointsQuery.data && modelsQuery.data) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      const preset = requestedAgentPreset ?? (spec ? getModelSpecPreset(spec) : undefined);
      logger.log('conversation', 'ChatRoute, new convo effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
      });

      hasSetConversation.current = true;
    } else if (initialConvoQuery.data && endpointsQuery.data && modelsQuery.data) {
      logger.log('conversation', 'ChatRoute initialConvoQuery', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        /* this is necessary to load all existing settings */
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
        keepLatestMessage: true,
      });
      hasSetConversation.current = true;
    } else if (
      conversationId === Constants.NEW_CONVO &&
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      const preset = requestedAgentPreset ?? (spec ? getModelSpecPreset(spec) : undefined);
      logger.log('conversation', 'ChatRoute new convo, assistants effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
      });
      hasSetConversation.current = true;
    } else if (
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      logger.log('conversation', 'ChatRoute convo, assistants effect', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
        keepLatestMessage: true,
      });
      hasSetConversation.current = true;
    }
    /* Creates infinite render if all dependencies included due to newConversation invocations exceeding call stack before hasSetConversation.current becomes truthy */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    roles,
    startupConfig,
    requestedAgentModel,
    conversation?.spec,
    initialConvoQuery.data,
    endpointsQuery.data,
    modelsQuery.data,
    assistantListMap,
  ]);

  if (!isAuthenticated) {
    return null;
  }

  // if not a conversation
  if (conversation?.conversationId === Constants.SEARCH) {
    return null;
  }
  // if conversationId is null
  if (!conversationId) {
    return null;
  }

  return (
    <ToolCallsMapProvider conversationId={conversation?.conversationId ?? conversationId ?? ''}>
      <ChatView index={index} />
    </ToolCallsMapProvider>
  );
}
