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

// Column Metadata for enhanced table rendering
export interface ColumnMetadata {
  name: string;
  type: "string" | "number" | "currency" | "percentage" | "date" | "datetime" | "boolean" | "url" | "email";
  unit?: string;               // e.g., "USD", "kg", "%"
  description?: string;
  format?: string;             // e.g., "0.2f" for decimals
}

export interface TableData {
  id?: string;                 // NEW (optional)
  title: string;
  description?: string;        // NEW (optional)
  columns?: ColumnMetadata[];  // NEW (preferred)
  headers?: string[];          // DEPRECATED (kept for backward compat)
  rows: string[][];
  footer?: string | null;
}

// New: Insights
export interface Insight {
  id?: string;
  text: string;
  category?: string;           // e.g., "recommendation", "finding", "warning"
  confidence?: number;         // 0.0 to 1.0
}

// New: Artifacts
export interface Artifact {
  type: string;                // e.g., "product", "score", "signal"
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

// Optional: Debug Response (only if X-Debug: true header sent)
export interface StageExecutionInfo {
  stage: string;
  tokens?: number;
  latency_ms?: number;
  success: boolean;
  error?: string;
}

export interface DebugResponse {
  execution_path: string[];
  complexity?: string;
  stages: StageExecutionInfo[];
  models_used: Record<string, string>;
  web_search_triggered: boolean;
  enhancement_applied: boolean;
  total_latency_ms?: number;
  latency_per_stage?: Record<string, number>;
  warnings: string[];
}

// Updated v1 Response
export interface ChatResponse {
  version?: "v1";              // NEW (optional, defaults to v1)
  session_id: string;
  answer: string;
  tables?: TableData[];
  explanation?: string | null;
  insights?: Insight[];         // NEW (optional)
  artifacts?: Artifact[];      // NEW (optional)
  timestamp?: string;          // NEW (optional)
  debug?: DebugResponse;       // NEW (optional, only if X-Debug header)
  // Legacy fields (deprecated, kept for backward compatibility)
  structured_output?: any[];   // DEPRECATED
  usage?: {                    // DEPRECATED (removed from user-facing response)
    tokens: number;
    tokens_per_stage?: Record<string, number>;
    estimated_cost_usd: number;
  };
  meta?: {                     // DEPRECATED (removed from user-facing response)
    llm_calls?: number;
    execution_path?: string[];
    complexity?: string;
    models_used?: Record<string, string>;
    fallback?: boolean;
    parse_error?: boolean;
    [key: string]: any;
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
  // Extended fields for streaming responses
  tables?: TableData[];
  insights?: Insight[];
  artifacts?: Artifact[];
  explanation?: string | null;
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
  private getHeaders(requestId?: string, includeDebug?: boolean): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',  // Optional, but explicit
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add idempotency header if request_id is provided
    if (requestId) {
      headers['X-Request-ID'] = requestId;
    }

    // Add debug header if requested (for development)
    if (includeDebug) {
      headers['X-Debug'] = 'true';
    }

    return headers;
  }

  /**
   * Normalize table data to ensure all cell values are strings
   * Supports both new (columns) and legacy (headers) format
   */
  private normalizeTableData(tables: any[]): TableData[] {
    if (!Array.isArray(tables)) return [];
    
    return tables.map((table: any) => {
      const normalized: TableData = {
        id: table.id ? String(table.id) : undefined,
        title: String(table.title || ''),
        description: table.description ? String(table.description) : undefined,
        rows: Array.isArray(table.rows)
          ? table.rows.map((row: any) => 
              Array.isArray(row)
                ? row.map((cell: any) => String(cell ?? ''))
                : []
            )
          : [],
        footer: table.footer ? String(table.footer) : null,
      };

      // Support new columns format (preferred)
      if (Array.isArray(table.columns)) {
        normalized.columns = table.columns.map((col: any) => ({
          name: String(col.name || ''),
          type: col.type || 'string',
          unit: col.unit ? String(col.unit) : undefined,
          description: col.description ? String(col.description) : undefined,
          format: col.format ? String(col.format) : undefined,
        }));
      }

      // Support legacy headers format (backward compatibility)
      if (Array.isArray(table.headers)) {
        normalized.headers = table.headers.map((h: any) => String(h ?? ''));
      } else if (!normalized.columns) {
        // If neither columns nor headers, create empty headers
        normalized.headers = [];
      }

      return normalized;
    });
  }

  /**
   * Handle fetch errors with better error messages
   */
  private handleFetchError(error: any, endpoint?: string): never {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const fullUrl = endpoint ? `${this.apiBaseUrl}${endpoint}` : this.apiBaseUrl;
      const errorMessage = `Failed to connect to backend at ${fullUrl}. ` +
        `Possible causes:\n` +
        `1. Backend URL is incorrect (current: ${this.apiBaseUrl})\n` +
        `2. Backend server is not running\n` +
        `3. CORS is not configured on backend (backend must allow origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'})\n` +
        `4. Network connectivity issues\n` +
        `5. SSL certificate issues (if using HTTPS)`;
      
      console.error('Fetch Error Details:', {
        error,
        apiBaseUrl: this.apiBaseUrl,
        endpoint,
        fullUrl,
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        hasToken: !!this.token,
      });
      
      throw new Error(errorMessage);
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

      const responseData = await response.json();
      
      // Handle fallback response format with raw_content
      if (responseData.raw_content && typeof responseData.raw_content === 'string') {
        try {
          // Parse the JSON string in raw_content
          const parsedContent = JSON.parse(responseData.raw_content);
          
          // Extract the actual response data
          // The parsed content should have: answer, tables, explanation, etc.
          // Normalize tables to ensure all cell values are strings
          const normalizedTables = this.normalizeTableData(parsedContent.tables || []);
          
          const fallbackResponse: ChatResponse = {
            version: parsedContent.version || 'v1',
            session_id: parsedContent.session_id || responseData.session_id || `fallback-${Date.now()}`,
            answer: parsedContent.answer || parsedContent.summary || 'Response received',
            tables: normalizedTables,
            explanation: parsedContent.explanation || null,
            insights: parsedContent.insights || [],
            artifacts: parsedContent.artifacts || [],
            timestamp: parsedContent.timestamp || responseData.timestamp,
            debug: parsedContent.debug || responseData.debug,
            // Legacy fields (optional, for backward compatibility)
            structured_output: parsedContent.structured_output,
            usage: parsedContent.usage || responseData.usage,
            meta: parsedContent.meta || responseData.meta ? {
              ...(parsedContent.meta || responseData.meta || {}),
              fallback: true,
              parse_error: responseData.parse_error || false,
            } : undefined,
          };
          
          return fallbackResponse;
        } catch (parseError: any) {
          console.warn('Failed to parse raw_content:', parseError);
          // Fallback: try to extract what we can
          return {
            version: 'v1',
            session_id: responseData.session_id || `fallback-${Date.now()}`,
            answer: responseData.raw_content || 'Unable to parse response',
            tables: [],
            explanation: null,
          };
        }
      }
      
      // Normal response format - normalize tables to ensure all values are strings
      if (responseData.tables && Array.isArray(responseData.tables)) {
        responseData.tables = this.normalizeTableData(responseData.tables);
      }
      
      // Ensure version is set (defaults to v1)
      if (!responseData.version) {
        responseData.version = 'v1';
      }
      
      return responseData as ChatResponse;
    } catch (error: any) {
      this.handleFetchError(error, '/api/v1/chat');
    }
  }

  /**
   * Send a chat message with streaming
   */
  async chatStream(
    request: ChatRequest,
    onChunk: (chunk: string, done: boolean) => void,
    onComplete?: (sessionId: string, tables?: TableData[], explanation?: string | null, insights?: Insight[], artifacts?: Artifact[]) => void,
    onProgress?: (stage: string, progress: number, message: string) => void
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
            
            // Handle new typed events
            switch (data.type) {
              case 'progress':           // NEW - Real-time progress updates
                if (onProgress) {
                  onProgress(
                    data.stage || 'unknown',
                    data.progress || 0,
                    data.message || 'Processing...'
                  );
                }
                break;
              
              case 'token':              // Text content chunks
              case 'chunk':              // Legacy support
                onChunk(data.content, false);
                // Update progress during streaming (estimate 0.7-0.95)
                if (onProgress) {
                  onProgress('streaming', 0.7, 'Streaming response...');
                }
                break;
              
              case 'stage_complete':     // Stage finished
                if (onProgress) {
                  const stageMessages: Record<string, string> = {
                    routing: 'Request processed',
                    enhance: 'Question optimized',
                    research: 'Research complete',
                    analysis: 'Analysis complete',
                    compose: 'Response ready'
                  };
                  onProgress(
                    data.stage || 'unknown',
                    data.progress || 0.5,
                    stageMessages[data.stage] || 'Stage complete'
                  );
                }
                console.debug('Stage completed:', data.stage, data.success);
                break;
              
              case 'table':              // Structured table data
                // Optional: could render table incrementally
                console.debug('Table received:', data.table);
                break;
              
              case 'insight':            // Insight data
                // Optional: could render insights incrementally
                console.debug('Insight received:', data.insight);
                break;
              
              case 'done':               // Final completion
                if (onProgress) {
                  onProgress('done', 1.0, 'Complete');
                }
                if (onComplete) {
                  const normalizedTables = data.tables 
                    ? this.normalizeTableData(data.tables)
                    : undefined;
                  onComplete(
                    data.session_id,
                    normalizedTables,
                    data.explanation || null,
                    data.insights || [],
                    data.artifacts || []
                  );
                }
                break;
              
              case 'error':              // Error occurred
                if (onProgress) {
                  onProgress('error', 0, `Error: ${data.error || 'Unknown error'}`);
                }
                throw new Error(data.error || 'Streaming error occurred');
              
              default:
                // Unknown event type, ignore
                break;
            }
          } catch (e) {
            // Ignore parse errors for unknown formats
            console.warn('Failed to parse streaming event:', e);
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.type === 'done' && onComplete) {
          const normalizedTables = data.tables 
            ? this.normalizeTableData(data.tables)
            : undefined;
          onComplete(
            data.session_id,
            normalizedTables,
            data.explanation || null,
            data.insights || [],
            data.artifacts || []
          );
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    } catch (error: any) {
      this.handleFetchError(error, '/api/v1/chat/stream');
    }
  }

  /**
   * Get all user sessions
   */
  async getSessions(): Promise<Session[]> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
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
    } catch (error: any) {
      if (error.message === 'Authentication required' || error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, '/api/v1/sessions');
    }
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<Session> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
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
    } catch (error: any) {
      if (error.message === 'Authentication required' || 
          error.message === 'You do not have permission to access this session' ||
          error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, `/api/v1/sessions/${sessionId}`);
    }
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
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

      const messages: Message[] = await response.json();
      
      // Normalize tables in assistant messages
      return messages.map((msg) => {
        if (msg.role === 'assistant' && msg.tables && Array.isArray(msg.tables)) {
          return {
            ...msg,
            tables: this.normalizeTableData(msg.tables),
          };
        }
        return msg;
      });
    } catch (error: any) {
      if (error.message === 'Authentication required' || 
          error.message === 'You do not have permission to access this session' ||
          error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, `/api/v1/sessions/${sessionId}/messages`);
    }
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<Session> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });

      if (response.status === 401) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to access this session');
      }

      if (response.status === 400) {
        const error = await response.json().catch(() => ({ detail: 'Invalid title' }));
        throw new Error(error.detail || 'Title must be 1-200 characters');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `Request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.message === 'Authentication required' || 
          error.message === 'You do not have permission to access this session' ||
          error.message.includes('Title must be') ||
          error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, `/api/v1/sessions/${sessionId}`);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (response.status === 401) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to access this session');
      }

      if (response.status === 404) {
        throw new Error('Session not found');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `Request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.message === 'Authentication required' || 
          error.message === 'You do not have permission to access this session' ||
          error.message === 'Session not found' ||
          error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, `/api/v1/sessions/${sessionId}`);
    }
  }

  /**
   * Delete all sessions for the user
   */
  async deleteAllSessions(): Promise<{ message: string; deleted_count: number }> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
        method: 'DELETE',
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
    } catch (error: any) {
      if (error.message === 'Authentication required' || error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, '/api/v1/sessions');
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfo> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
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
    } catch (error: any) {
      if (error.message === 'Authentication required' || error.message.includes('Request failed')) {
        throw error;
      }
      this.handleFetchError(error, '/api/v1/me');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    try {
      const healthUrl = `${this.apiBaseUrl}/health`;
      console.log('Health check:', healthUrl);
      
      const response = await fetch(healthUrl);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Health check successful:', result);
      return result;
    } catch (error: any) {
      if (error.message.includes('Health check failed')) {
        throw error;
      }
      this.handleFetchError(error, '/health');
    }
  }

  /**
   * Test backend connection and CORS
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any; corsIssue?: boolean }> {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    
    try {
      console.log('Testing connection to:', this.apiBaseUrl);
      console.log('Frontend origin:', origin);
      
      const result = await this.healthCheck();
      return {
        success: true,
        message: 'Connection successful',
        details: result,
        corsIssue: false,
      };
    } catch (error: any) {
      const isCorsError = error.message.includes('Failed to fetch') || 
                         error.message.includes('CORS') ||
                         (error instanceof TypeError && error.message === 'Failed to fetch');
      
      return {
        success: false,
        message: error.message || 'Connection failed',
        corsIssue: isCorsError,
        details: {
          apiBaseUrl: this.apiBaseUrl,
          origin: origin,
          error: error.message,
          recommendation: isCorsError ? 
            `CORS Error: Backend at ${this.apiBaseUrl} must allow requests from ${origin}. ` +
            `Backend needs to set: Access-Control-Allow-Origin: ${origin}` :
            'Check backend connectivity and configuration',
        },
      };
    }
  }

  /**
   * Test CORS specifically with OPTIONS preflight
   */
  async testCORS(): Promise<{ allowed: boolean; details: any }> {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    
    try {
      // Try OPTIONS request (CORS preflight)
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });

      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
        'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
      };

      const allowed = corsHeaders['access-control-allow-origin'] === '*' || 
                     corsHeaders['access-control-allow-origin'] === origin;

      return {
        allowed,
        details: {
          origin,
          corsHeaders,
          status: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error: any) {
      return {
        allowed: false,
        details: {
          origin,
          error: error.message,
          note: 'OPTIONS request failed - CORS likely not configured',
        },
      };
    }
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

