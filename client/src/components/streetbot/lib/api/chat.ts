/**
 * Chat API client for Street Bot Pro
 * Handles communication with the backend chat endpoints for:
 * - Conversation history
 * - Message management
 * - Sharing
 * - Feedback
 * - Context management
 */

import { getBackendBaseUrl } from "../backend";

// =============================================================================
// Types
// =============================================================================

export interface ConversationListItem {
  id: string;
  title: string | null;
  preview: string | null;
  status: "active" | "archived" | "deleted";
  is_pinned: boolean;
  message_count: number;
  primary_agent: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ConversationHistoryResponse {
  conversations: ConversationListItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface Message {
  role: "user" | "assistant" | "system" | "agent";
  content: string;
  agent: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  status: string;
  is_pinned: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ShareResponse {
  success: boolean;
  share_token: string;
  share_url: string;
  expires_at: string | null;
}

export interface FeedbackResponse {
  success: boolean;
  feedback_id: string | null;
}

export interface UpdateConversationRequest {
  title?: string;
  is_pinned?: boolean;
  status?: "active" | "archived";
}

// =============================================================================
// API Client
// =============================================================================

class ChatApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBackendBaseUrl();
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `API request failed: ${response.status} ${response.statusText}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ===========================================================================
  // Conversation History
  // ===========================================================================

  /**
   * Get paginated conversation history for the current user.
   * Requires authentication.
   */
  async getHistory(
    page: number = 1,
    pageSize: number = 20,
    status?: "active" | "archived"
  ): Promise<ConversationHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (status) {
      params.set("status", status);
    }
    return this.fetch<ConversationHistoryResponse>(
      `/api/chat/history?${params.toString()}`
    );
  }

  /**
   * Get a specific conversation with all messages.
   */
  async getConversation(conversationId: string): Promise<ConversationDetail> {
    return this.fetch<ConversationDetail>(
      `/api/chat/history/${conversationId}`
    );
  }

  /**
   * Update conversation metadata (title, pin status, archive).
   */
  async updateConversation(
    conversationId: string,
    update: UpdateConversationRequest
  ): Promise<{ success: boolean; conversation_id: string }> {
    return this.fetch(`/api/chat/history/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
  }

  /**
   * Archive a conversation.
   */
  async archiveConversation(
    conversationId: string
  ): Promise<{ success: boolean }> {
    return this.updateConversation(conversationId, { status: "archived" });
  }

  /**
   * Unarchive a conversation.
   */
  async unarchiveConversation(
    conversationId: string
  ): Promise<{ success: boolean }> {
    return this.updateConversation(conversationId, { status: "active" });
  }

  /**
   * Pin a conversation.
   */
  async pinConversation(conversationId: string): Promise<{ success: boolean }> {
    return this.updateConversation(conversationId, { is_pinned: true });
  }

  /**
   * Unpin a conversation.
   */
  async unpinConversation(
    conversationId: string
  ): Promise<{ success: boolean }> {
    return this.updateConversation(conversationId, { is_pinned: false });
  }

  /**
   * Rename a conversation.
   */
  async renameConversation(
    conversationId: string,
    title: string
  ): Promise<{ success: boolean }> {
    return this.updateConversation(conversationId, { title });
  }

  /**
   * Delete a conversation (soft delete).
   */
  async deleteConversation(
    conversationId: string,
    metadata?: {
      title?: string;
      message_count?: number;
      preview?: string;
    }
  ): Promise<void> {
    await this.fetch("/api/chat/delete", {
      method: "POST",
      body: JSON.stringify({
        session_id: conversationId,
        ...metadata,
        client_deleted_at: new Date().toISOString(),
      }),
    });
  }

  // ===========================================================================
  // Sharing
  // ===========================================================================

  /**
   * Create a shareable link for a conversation.
   */
  async createShare(
    conversationId: string,
    options?: {
      title?: string;
      maxViews?: number;
      expiresInHours?: number;
    }
  ): Promise<ShareResponse> {
    return this.fetch<ShareResponse>("/api/chat/share", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        title: options?.title,
        max_views: options?.maxViews,
        expires_in_hours: options?.expiresInHours,
      }),
    });
  }

  /**
   * Get a shared conversation by its token.
   */
  async getSharedConversation(shareToken: string): Promise<ConversationDetail> {
    return this.fetch<ConversationDetail>(`/api/chat/shared/${shareToken}`);
  }

  /**
   * Revoke sharing for a conversation.
   */
  async revokeShare(conversationId: string): Promise<void> {
    await this.fetch(`/api/chat/share/${conversationId}`, {
      method: "DELETE",
    });
  }

  // ===========================================================================
  // Feedback
  // ===========================================================================

  /**
   * Submit feedback on a message.
   */
  async submitFeedback(
    messageId: string,
    conversationId: string,
    rating: "up" | "down",
    options?: {
      comment?: string;
      agent?: string;
    }
  ): Promise<FeedbackResponse> {
    return this.fetch<FeedbackResponse>("/api/chat/feedback", {
      method: "POST",
      body: JSON.stringify({
        message_id: messageId,
        conversation_id: conversationId,
        rating,
        comment: options?.comment,
        agent: options?.agent,
      }),
    });
  }

  // ===========================================================================
  // Message Editing
  // ===========================================================================

  /**
   * Edit a message's content.
   */
  async editMessage(
    messageId: string,
    newContent: string
  ): Promise<{
    success: boolean;
    message_id: string;
    new_content: string;
    edit_count: number;
  }> {
    return this.fetch(`/api/chat/message/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content: newContent }),
    });
  }

  // ===========================================================================
  // Context Management
  // ===========================================================================

  /**
   * Set a context value for a conversation.
   */
  async setContext(
    conversationId: string,
    key: string,
    value: unknown,
    expiresInSeconds?: number
  ): Promise<{ success: boolean; key: string }> {
    return this.fetch(`/api/chat/context/${conversationId}`, {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        expires_in_seconds: expiresInSeconds,
      }),
    });
  }

  /**
   * Get context for a conversation.
   */
  async getContext(
    conversationId: string,
    key?: string
  ): Promise<{ context: Record<string, unknown> }> {
    const params = key ? `?key=${encodeURIComponent(key)}` : "";
    return this.fetch(`/api/chat/context/${conversationId}${params}`);
  }

  /**
   * Delete context for a conversation.
   */
  async deleteContext(conversationId: string, key?: string): Promise<void> {
    const params = key ? `?key=${encodeURIComponent(key)}` : "";
    await this.fetch(`/api/chat/context/${conversationId}${params}`, {
      method: "DELETE",
    });
  }
}

// Export singleton instance
export const chatApi = new ChatApiClient();

// Also export the class for testing
export { ChatApiClient };
