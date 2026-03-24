import { useState, useCallback, useRef } from 'react';
import { sbFetch } from '../shared/sbFetch';
import type { GrantOpportunity, ChatMessage } from './grantTypes';

// Initial grants from the pipeline
const INITIAL_GRANTS: GrantOpportunity[] = [
  {
    id: 'yof-scale-2026',
    name: 'Youth Innovations Scale Grant',
    funder: 'Ontario Trillium Foundation',
    funderAbbrev: 'OTF',
    amount: 'Up to $150K/yr × 2-3 years',
    deadline: 'April 15, 2026 (EOI)',
    stage: 'identified',
    url: 'https://otf.ca/our-grants/youth-opportunities-fund/youth-innovations-scale-grant',
    assessment: {
      missionAlignment: 4,
      competitiveness: 3,
      effortToReward: 4,
      strategicValue: 5,
      capacity: 3,
      recommendation: 'pursue',
    },
    documents: {
      opportunity: true,
      narrative: false,
      budget: false,
      projectPlan: false,
    },
  },
  {
    id: 'tgrip-extension',
    name: 'TGRIP — Organizational Capacity Development',
    funder: 'Toronto Grants',
    funderAbbrev: 'TGRIP',
    stage: 'active',
    documents: {
      opportunity: true,
      narrative: true,
      budget: true,
      projectPlan: true,
    },
  },
];

let msgCounter = 0;
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function useGrantData() {
  const [grants] = useState<GrantOpportunity[]>(INITIAL_GRANTS);
  const [activeGrantId, setActiveGrantId] = useState<string>(INITIAL_GRANTS[0].id);
  const [messagesByGrant, setMessagesByGrant] = useState<Record<string, ChatMessage[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const activeGrant = grants.find(g => g.id === activeGrantId) || grants[0];
  const messages = messagesByGrant[activeGrantId] || [];

  const addMessage = useCallback((grantId: string, msg: ChatMessage) => {
    setMessagesByGrant(prev => ({
      ...prev,
      [grantId]: [...(prev[grantId] || []), msg],
    }));
  }, []);

  const updateLastAssistantMessage = useCallback((grantId: string, updater: (msg: ChatMessage) => ChatMessage) => {
    setMessagesByGrant(prev => {
      const msgs = prev[grantId] || [];
      const lastIdx = msgs.length - 1;
      if (lastIdx < 0 || msgs[lastIdx].role !== 'assistant') return prev;
      const updated = [...msgs];
      updated[lastIdx] = updater(updated[lastIdx]);
      return { ...prev, [grantId]: updated };
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const grantId = activeGrantId;

    // Add user message
    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    addMessage(grantId, userMsg);

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
      isStreaming: true,
    };
    addMessage(grantId, assistantMsg);

    setIsStreaming(true);
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      // Build conversation history for context
      const currentMsgs = messagesByGrant[grantId] || [];
      const apiMessages = [
        ...currentMsgs
          .filter(m => !m.isStreaming)
          .map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text.trim() },
      ];

      const resp = await sbFetch('/sbapi/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'agent/grant_manager',
          messages: apiMessages,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`API error ${resp.status}: ${errText}`);
      }

      if (!resp.body) throw new Error('Streaming not supported');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const line = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') break;

            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices?.[0]?.delta;

              if (delta?.content) {
                const content = delta.content;

                // Check if this is a tool call progress line (⏳ prefix)
                if (content.includes('⏳')) {
                  const toolLine = content.replace(/⏳\s*/g, '').trim();
                  if (toolLine) {
                    updateLastAssistantMessage(grantId, msg => ({
                      ...msg,
                      toolCalls: [...(msg.toolCalls || []), toolLine],
                    }));
                  }
                } else {
                  updateLastAssistantMessage(grantId, msg => ({
                    ...msg,
                    content: msg.content + content,
                  }));
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }

          boundary = buffer.indexOf('\n');
        }
      }
      reader.releaseLock();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        updateLastAssistantMessage(grantId, msg => ({
          ...msg,
          content: msg.content || `Error: ${err instanceof Error ? err.message : 'Request failed'}`,
        }));
      }
    } finally {
      updateLastAssistantMessage(grantId, msg => ({
        ...msg,
        isStreaming: false,
      }));
      setIsStreaming(false);
      controllerRef.current = null;
    }
  }, [activeGrantId, isStreaming, messagesByGrant, addMessage, updateLastAssistantMessage]);

  const cancelStream = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const selectGrant = useCallback((grantId: string) => {
    if (isStreaming) return;
    setActiveGrantId(grantId);
  }, [isStreaming]);

  return {
    grants,
    activeGrant,
    activeGrantId,
    messages,
    isStreaming,
    sendMessage,
    cancelStream,
    selectGrant,
  };
}
