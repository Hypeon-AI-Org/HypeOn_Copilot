/**
 * HypeOn Copilot Backend API Client
 * Based on FRONTEND_INTEGRATION.md
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export interface ChatRequest {
  message: string;
  session_id?: string | null;
  user_id?: string;
  plan?: 'basic' | 'pro';
  request_id?: string;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string | null;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  tables?: TableData[];
  explanation?: string | null;
  structured_output?: any[];
  usage: {
    tokens: number;
    tokens_per_stage?: Record<string, number>;
    estimated_cost_usd: number;
  };
  meta?: {
    llm_calls: number;
    execution_path: string[];
    complexity: string;
    models_used?: Record<string, string>;
  };
}

export interface Session {
  session_id: string;
  user_id: string;
  plan: string;
  title: string;
  created_at: string;
  last_active_at: string;
}

export interface Message {
  message_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  token_count?: number;
  created_at: string;
}

export interface UserInfo {
  user_id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  limits: {
    max_tokens: number;
    max_turns: number;
    max_requests_per_minute: number;
    max_sessions: number;
  };
}

export class ChatService {
  private apiBaseUrl: string;
  private token: string | null;

  constructor(apiBaseUrl?: string, token?: string | null) {
    // Normalize URL: remove trailing slash
    const baseUrl = (apiBaseUrl || API_BASE_URL).trim();
    this.apiBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token || null;
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Get authentication headers
   */
  private getHeaders(requestId?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add idempotency header if request_id is provided
    if (requestId) {
      headers['X-Request-ID'] = requestId;
    }

    return headers;
  }

  /**
   * Handle fetch errors with better error messages
   */
  private handleFetchError(error: any): never {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Failed to connect to backend at ${this.apiBaseUrl}. ` +
        `Please check: 1) Backend URL is correct, 2) Backend is running, 3) CORS is configured on backend.`
      );
    }
    throw error;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Send a chat message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = `${this.apiBaseUrl}/api/v1/chat`;
    
    // Log URL in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Chat API Request:', {
        url,
        method: 'POST',
        hasToken: !!this.token,
      });
    }
    
    try {
      const requestId = request.request_id || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(requestId),
        body: JSON.stringify({
          message: request.message,
          session_id: request.session_id || undefined,
          user_id: request.user_id,
          plan: request.plan || 'basic',
          request_id: requestId,
        }),
      });

      if (response.status === 401) {
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        const errorMessage = error.detail || `Request failed: ${response.statusText}`;
        // Include URL in error for debugging
        throw new Error(
          `${errorMessage} (Status: ${response.status}, URL: ${this.apiBaseUrl}/api/v1/chat)`
        );
      }

      return await response.json();
    } catch (error: any) {
      this.handleFetchError(error);
    }
  }

  /**
   * Send a chat message with streaming
   */
  async chatStream(
    request: ChatRequest,
    onChunk: (chunk: string, done: boolean) => void,
    onComplete?: (sessionId: string, usage: any, tables?: TableData[], explanation?: string | null) => void
  ): Promise<void> {
    try {
      const requestId = request.request_id || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const response = await fetch(`${this.apiBaseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(requestId),
        body: JSON.stringify({
          message: request.message,
          session_id: request.session_id || undefined,
          user_id: request.user_id,
          plan: request.plan || 'basic',
          request_id: requestId,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `Request failed: ${response.statusText}`);
      }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              onChunk(data.content, false);
            } else if (data.type === 'done' && onComplete) {
              onComplete(
                data.session_id, 
                data.usage,
                data.tables,
                data.explanation
              );
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.type === 'done' && onComplete) {
          onComplete(
            data.session_id, 
            data.usage,
            data.tables,
            data.explanation
          );
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    } catch (error: any) {
      this.handleFetchError(error);
    }
  }

  /**
   * Get all user sessions
   */
  async getSessions(): Promise<Session[]> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<Session> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to access this session');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const url = new URL(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}/messages`);
    if (limit) {
      url.searchParams.set('limit', limit.toString());
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to access this session');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfo> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/v1/me`, {
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await fetch(`${this.apiBaseUrl}/health`);

    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return await response.json();
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

/**
 * Get or create chat service instance
 */
export function getChatService(token?: string | null): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }

  if (token !== undefined) {
    chatServiceInstance.setToken(token);
  }

  return chatServiceInstance;
}

