/**
 * HypeOn Copilot Backend API Client
 * Based on FRONTEND_INTEGRATION.md
 */

import { chatRateLimiter, sessionRateLimiter, generalRateLimiter } from './rateLimiter';
import { log } from './logger';

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
  type: "string" | "number" | "currency" | "percentage" | "date" | "datetime" | "boolean" | "url" | "email" | "image";
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

// Research Plan interfaces
export interface ResearchPlan {
  searchTerms: string[];
  objectives: string[];
  dataPoints: string[];
  sources: string[];
  timeSensitivity?: string;
  geographicScope?: string;
  note?: string;
}

export interface SearchTermStatus {
  term: string;
  status: 'pending' | 'searching' | 'completed' | 'skipped';
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
  // Optional section titles/labels (dynamic from backend)
  sectionTitles?: {
    insights?: string;
    artifacts?: string;
    explanation?: string;
  };
  metadata?: {
    [key: string]: any;
  };
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
  isStreaming?: boolean; // True if message is currently streaming tokens in real-time
  metadata?: {
    cached?: boolean;
    search_entry_point?: string;
    [key: string]: any;
  };
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
   * Check if authentication is disabled (development mode)
   */
  private isAuthDisabled(): boolean {
    // Only allow auth bypass in development with explicit flag
    // Production always requires authentication
    return process.env.NODE_ENV === 'development' && 
           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  }

  /**
   * Get authentication headers
   */
  private getHeaders(requestId?: string, includeDebug?: boolean): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',  // Optional, but explicit
    };

    // Skip auth in development if disabled
    if (this.isAuthDisabled()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔓 Development mode: Authentication disabled');
      }
    } else if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      
      // Log token info in development mode
      if (process.env.NODE_ENV === 'development') {
        try {
          const payload = JSON.parse(atob(this.token.split('.')[1]));
          const expDate = payload.exp ? new Date(payload.exp * 1000) : null;
          console.log('🔐 Token being sent to backend:', {
            hasToken: true,
            userId: payload.sub || payload.user?.id,
            expiresAt: expDate?.toISOString() || 'Unknown',
            expired: payload.exp ? payload.exp * 1000 < Date.now() : true,
          });
        } catch (e) {
          console.warn('⚠️ Could not decode token for logging:', e);
        }
      }
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
      const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      
      // Only log detailed error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('🔴 Backend Connection Error:', {
          endpoint: endpoint || 'root',
          apiBaseUrl: this.apiBaseUrl,
          fullUrl,
          origin,
          hasToken: !!this.token,
          errorType: error.constructor.name,
        });
      }
      
      const errorMessage = `Backend unavailable at ${this.apiBaseUrl}. ` +
        `Please ensure the backend server is running.`;
      
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
    // Rate limiting check
    if (!chatRateLimiter.isAllowed('chat')) {
      const waitTime = chatRateLimiter.getTimeUntilNext('chat');
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message.`);
    }

    const url = `${this.apiBaseUrl}/api/v1/chat`;
    const startTime = Date.now();
    
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

      const durationMs = Date.now() - startTime;
      log.apiRequest('POST', '/api/v1/chat', response.status, durationMs);

      if (response.status === 401 && !this.isAuthDisabled()) {
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
    onComplete?: (sessionId: string, tables?: TableData[], explanation?: string | null, insights?: Insight[], artifacts?: Artifact[], metadata?: any) => void,
    onProgress?: (stage: string, progress: number, message: string) => void,
    onTable?: (table: TableData) => void,
    onInsight?: (insight: Insight) => void,
    onArtifact?: (artifact: Artifact) => void,
    onStageStart?: (stage: string, stageIndex: number, totalStages: number) => void,
    onStageComplete?: (stage: string, success: boolean, latencyMs?: number | null, error?: string) => void,
    onResearchPlan?: (plan: ResearchPlan) => void,
    onError?: (error: string, code?: string) => void
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

      // TEMPORARY: Log all raw SSE lines for debugging
      if (process.env.NODE_ENV === 'development' && lines.length > 0) {
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            console.log('📥 Raw SSE line:', line.substring(0, 200));
          }
        });
      }

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Log ALL events to see what's coming from backend
            if (process.env.NODE_ENV === 'development') {
              console.log('📨 SSE Event received:', {
                type: data.type,
                stage: data.stage,
                hasMessage: !!data.message,
                message: data.message?.substring(0, 100), // First 100 chars
                progress: data.progress
              });
            }
            
            // Handle new typed events
            switch (data.type) {
              case 'stage_start':       // Stage started
                if (onStageStart) {
                  onStageStart(
                    data.stage || 'unknown',
                    data.stage_index ?? 0,
                    data.total_stages ?? 1
                  );
                }
                // Only update progress if no detailed message is provided
                // Don't override detailed progress messages with generic "Starting..." message
                // The backend will send detailed progress events immediately after stage_start
                if (onProgress && data.message) {
                  // Use backend message if provided, otherwise use generic
                  onProgress(
                    data.stage || 'unknown',
                    0,
                    data.message || `Starting ${data.stage || 'processing'}...`
                  );
                }
                console.debug('Stage started:', data.stage, `(${data.stage_index + 1}/${data.total_stages})`);
                break;
              
              case 'progress':           // NEW - Real-time progress updates
                if (onProgress) {
                  // IMPORTANT: Always use data.message if provided, even if it's a detailed message
                  // The backend sends detailed messages like "Searching: 'top 10 smartphone brands'..."
                  const message = data.message?.trim() || 'Processing...';
                  
                  // Use console.log instead of console.debug for visibility
                  if (process.env.NODE_ENV === 'development') {
                    console.log('🔵 Progress event received:', {
                      stage: data.stage,
                      progress: data.progress,
                      message: message,
                      hasDetailedMessage: !!data.message && data.message !== 'Processing...',
                      rawData: data // Log full event data
                    });
                  }
                  
                  onProgress(
                    data.stage || 'unknown',
                    data.progress || 0,
                    message
                  );
                }
                break;
              
              case 'token':              // Text content chunks (NEW - true streaming)
              case 'chunk':              // Legacy support
                // Token events stream live as LLM generates them
                // data.content: the token text to append (plain text tokens from LLM)
                // data.done: true if this is the final token (content may be empty), false if more tokens are coming
                // Backend sends plain text tokens - no need to filter
                const tokenContent = data.content || '';
                const isDone = data.done || false;
                
                // Always call onChunk to signal completion, even if content is empty (final token)
                if (tokenContent || isDone) {
                  onChunk(tokenContent, isDone);
                }
                
                // Don't override progress during token streaming - let compose stage progress handle it
                // Progress updates should come from 'progress' events, not token events
                break;
              
              case 'stage_complete':     // Stage finished
                if (onStageComplete) {
                  onStageComplete(
                    data.stage || 'unknown',
                    data.success !== false,
                    data.latency_ms,
                    data.error
                  );
                }
                // IMPORTANT: Don't call onProgress on stage_complete
                // This prevents generic completion messages from overriding detailed progress messages
                // The last detailed progress message should remain visible until the next stage starts
                // Only update the stage status in the stages map, don't update the main progress state
                // This ensures users see the detailed messages like "Found 48 sources..." instead of generic "Research complete"
                console.debug('Stage completed:', data.stage, data.success, data.latency_ms, data.error);
                break;
              
              case 'table':              // Structured table data - progressive display
                if (onTable && data.table) {
                  const normalizedTable = this.normalizeTableData([data.table])[0];
                  onTable(normalizedTable);
                }
                console.debug('Table received:', data.table);
                break;
              
              case 'insight':            // Insight data - progressive display
                if (onInsight && data.insight) {
                  onInsight(data.insight);
                }
                console.debug('Insight received:', data.insight);
                break;
              
              case 'artifact':           // Artifact data - progressive display
                if (onArtifact && data.artifact) {
                  onArtifact(data.artifact);
                }
                console.debug('Artifact received:', data.artifact);
                break;
              
              case 'research_plan':      // Research plan with suggested search terms
                if (onResearchPlan) {
                  onResearchPlan({
                    searchTerms: data.search_terms || [],
                    objectives: data.objectives || [],
                    dataPoints: data.data_points || [],
                    sources: data.sources || [],
                    timeSensitivity: data.time_sensitivity,
                    geographicScope: data.geographic_scope,
                    note: data.note
                  });
                }
                if (process.env.NODE_ENV === 'development') {
                  console.log('📋 Research plan received:', {
                    searchTermsCount: data.search_terms?.length || 0,
                    objectives: data.objectives?.length || 0,
                    dataPoints: data.data_points?.length || 0
                  });
                }
                break;
              
              case 'done':               // Final completion
                if (onProgress) {
                  onProgress('done', 1.0, 'Complete');
                }
                if (onComplete) {
                  const normalizedTables = data.tables 
                    ? this.normalizeTableData(data.tables)
                    : undefined;
                  // Extract sectionTitles from metadata or top-level data
                  const metadata = data.metadata || {};
                  if (data.sectionTitles) {
                    metadata.sectionTitles = data.sectionTitles;
                  }
                  onComplete(
                    data.session_id,
                    normalizedTables,
                    data.explanation || null,
                    data.insights || [],
                    data.artifacts || [],
                    metadata
                  );
                }
                break;
              
              case 'error':              // Error occurred
                const errorMessage = data.error || 'Unknown error';
                const errorCode = data.code;
                
                if (onError) {
                  onError(errorMessage, errorCode);
                } else {
                  if (onProgress) {
                    onProgress('error', 0, `Error: ${errorMessage}`);
                  }
                  throw new Error(errorMessage);
                }
                break;
              
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
          // Extract sectionTitles from metadata or top-level data
          const metadata = data.metadata || {};
          if (data.sectionTitles) {
            metadata.sectionTitles = data.sectionTitles;
          }
          onComplete(
            data.session_id,
            normalizedTables,
            data.explanation || null,
            data.insights || [],
            data.artifacts || [],
            metadata
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
    // Rate limiting check
    if (!sessionRateLimiter.isAllowed('sessions')) {
      const waitTime = sessionRateLimiter.getTimeUntilNext('sessions');
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    const startTime = Date.now();
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
        headers: this.getHeaders(),
      });

      const durationMs = Date.now() - startTime;
      log.apiRequest('GET', '/api/v1/sessions', response.status, durationMs);

      if (response.status === 401 && !this.isAuthDisabled()) {
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
    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        headers: this.getHeaders(),
      });

      if (response.status === 401 && !this.isAuthDisabled()) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        if (this.isAuthDisabled()) {
          // In development with auth disabled, treat 403 as session not found
          throw new Error('Session not found');
        } else {
          throw new Error('You do not have permission to access this session');
        }
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
   * Get session messages
   */
  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    if (!this.isAuthDisabled() && !this.token) {
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

      if (response.status === 401 && !this.isAuthDisabled()) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        if (this.isAuthDisabled()) {
          // In development with auth disabled, treat 403 as session not found
          throw new Error('Session not found');
        } else {
          throw new Error('You do not have permission to access this session');
        }
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
          error.message === 'Session not found' ||
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
    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });

      if (response.status === 401 && !this.isAuthDisabled()) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        if (this.isAuthDisabled()) {
          // In development with auth disabled, treat 403 as session not found
          throw new Error('Session not found');
        } else {
          throw new Error('You do not have permission to access this session');
        }
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
          error.message === 'Session not found' ||
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
  async deleteSession(sessionId: string): Promise<{ message: string; deleted_count?: number }> {
    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (response.status === 401 && !this.isAuthDisabled()) {
        throw new Error('Authentication required');
      }

      if (response.status === 403) {
        if (this.isAuthDisabled()) {
          // In development with auth disabled, treat 403 as session not found
          throw new Error('Session not found');
        } else {
          throw new Error('You do not have permission to access this session');
        }
      }

      if (response.status === 404) {
        // If auth is disabled, treat 404 as success (session already deleted or doesn't exist)
        if (this.isAuthDisabled()) {
          return { message: 'Session deleted', deleted_count: 1 };
        }
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
    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (response.status === 401 && !this.isAuthDisabled()) {
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
    if (!this.isAuthDisabled() && !this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/me`, {
        headers: this.getHeaders(),
      });

      if (response.status === 401 && !this.isAuthDisabled()) {
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

