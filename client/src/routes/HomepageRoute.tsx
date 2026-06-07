import { useEffect } from 'react';
import { Spinner } from '@librechat/client';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { useSearchParams } from 'react-router-dom';
import { EModelEndpoint, type TPreset, type TStartupConfig } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import { useNewConvo, useAppStartup, useAssistantListMap, useAuthContext } from '~/hooks';
import { getDefaultModelSpec, getModelSpecPreset, logger } from '~/utils';
import { ToolCallsMapProvider } from '~/Providers';
import HomepageChatView from '~/components/Chat/HomepageChatView';
import PublicLanding from '~/components/Chat/PublicLanding';
import temporaryStore from '~/store/temporary';
import store from '~/store';
import { isStreetBot } from '~/config/appVariant';

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

export default function HomepageRoute() {
  const { data: startupConfig } = useGetStartupConfig();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, roles } = useAuthContext();
  const requestedAgentPreset = getRequestedAgentPreset(
    startupConfig,
    searchParams.get('agentModel') ?? '',
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
      const preset = requestedAgentPreset ?? (spec ? getModelSpecPreset(spec) : undefined);
      logger.log('conversation', 'HomepageRoute, new convo effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
        skipNavigation: true,
      });
      hasSetConversation.current = true;
    } else if (
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      const preset = requestedAgentPreset ?? (spec ? getModelSpecPreset(spec) : undefined);
      logger.log('conversation', 'HomepageRoute new convo, assistants effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
        skipNavigation: true,
      });
      hasSetConversation.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, startupConfig, endpointsQuery.data, modelsQuery.data, assistantListMap]);

  if (!isAuthenticated) {
    return isStreetBot ? <PublicLanding /> : null;
  }

  if (endpointsQuery.isLoading || modelsQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
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
