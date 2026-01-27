/**
 * HypeOn Copilot API Types
 * Based on FRONTEND_INTEGRATION.md
 */

// Request Types
export interface ChatRequest {
  message: string;
  session_id?: string;
  user_id?: string;
  plan?: 'basic' | 'pro';
  request_id?: string;
}

// Stream Event Types
export type StreamEventType = 
  | 'status'        // Real-time status updates (thinking, searching, writing)
  | 'token'         // Text content chunks
  | 'table'         // Structured table data
  | 'insight'       // Key insights
  | 'done'          // Stream complete
  | 'error';        // Error occurred

export type StreamEvent = 
  | StatusEvent 
  | TokenEvent 
  | TableEvent 
  | InsightEvent
  | DoneEvent 
  | ErrorEvent;

// Status Event - Immediate feedback
export interface StatusEvent {
  type: 'status';
  status: 'thinking' | 'searching' | 'writing' | 'generating' | 'web_search';
  message: string;      // Human-readable: "Processing your request..."
  icon?: string;        // UI hint: 'spinner' | 'search' | 'pencil'
  timestamp: string;
}

// Token Event - Content chunks
export interface TokenEvent {
  type: 'token';
  content: string;      // Markdown text chunk
  done?: boolean;
  timestamp: string;
}

// Table Column Definition
export interface TableColumn {
  name: string;
  type: 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'url' | 'image';
  unit?: string;
  description?: string;
}

// Table Data Structure
export interface TableData {
  id?: string;
  title: string;
  description?: string;
  columns: TableColumn[];
  rows: any[][];
  footer?: string;
}

// Table Event - Structured data
export interface TableEvent {
  type: 'table';
  table: TableData;
  timestamp: string;
}

// Insight Structure
export interface Insight {
  id?: string;
  text: string;
  category?: string;    // e.g., "recommendation", "finding", "warning"
  confidence?: number;  // 0.0 to 1.0
}

// Insight Event
export interface InsightEvent {
  type: 'insight';
  insight: Insight;
  timestamp: string;
}

// Done Event - Stream complete
export interface DoneEvent {
  type: 'done';
  session_id: string;
  tables: TableData[];
  insights: Insight[];
  explanation?: string;
  metadata?: {
    web_search_used?: boolean;
    grounding_chunks_count?: number;
    sectionTitles?: {
      insights?: string;
      artifacts?: string;
      explanation?: string;
    };
    [key: string]: any;
  };
  done: true;
  timestamp: string;
}

// Error Event
export interface ErrorEvent {
  type: 'error';
  error: string;
  code?: 'STREAM_ERROR' | 'STREAM_CANCELLED' | 'RATE_LIMIT' | 'AUTH_ERROR';
  done: true;
  timestamp: string;
}

// Status icons mapping for UI
export const STATUS_ICONS: Record<string, string> = {
  thinking: '🤔',
  searching: '🔍',
  writing: '✍️',
  generating: '⚡',
  web_search: '🌐',
  connecting: '🔌',
  error: '❌',
  complete: '✅',
};

// HTTP Error Codes
export const HTTP_ERRORS: Record<number, string> = {
  400: 'Bad request - Check request format',
  401: 'Unauthorized - Refresh/obtain JWT',
  429: 'Rate limited - Wait and retry',
  500: 'Server error - Retry with backoff',
  503: 'API quota exceeded - Contact support',
};
