import { getBackendBaseUrl } from "./backend";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FeedbackPayload = {
  sessionId: string;
  rating: "up" | "down";
  messageId?: string;
  agent?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  conversation?: ConversationMessage[];
};

export type FeedbackResponse = {
  success: boolean;
  feedback_id: string | null;
};

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
  const baseUrl = getBackendBaseUrl();

  // Build metadata with conversation if provided
  const metadata: Record<string, unknown> = { ...payload.metadata };
  if (payload.conversation) {
    metadata.conversation = payload.conversation;
  }

  const response = await fetch(`${baseUrl}/api/chat/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message_id: payload.messageId ?? crypto.randomUUID(),
      conversation_id: payload.sessionId,
      rating: payload.rating,
      comment: payload.comment,
      agent: payload.agent,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Feedback request failed (${response.status})`);
  }

  return response.json();
}
