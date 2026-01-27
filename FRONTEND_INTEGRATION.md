# HypeOn Copilot - Frontend Integration Guide

## Base URL
```
Production: https://your-api-domain.com
Development: http://localhost:8000
```

---

## API Endpoints

| Endpoint | Method | Description | Use Case |
|----------|--------|-------------|----------|
| `/api/v1/chat` | POST | Non-streaming chat | Simple requests, testing |
| `/api/v1/chat/stream` | POST | Standard streaming | Full-featured streaming |
| `/api/v1/chat/stream/fast` | POST | **Optimized streaming** | **Production recommended** |

---

## Authentication

JWT token in Authorization header (optional for dev, required for production):

```typescript
headers: {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
}
```

---

## Request Format

```typescript
interface ChatRequest {
  message: string;          // Required: User's message (1-10000 chars)
  session_id?: string;      // Optional: Continue existing session
  user_id?: string;         // Optional: User identifier (uses JWT if authenticated)
  plan?: 'basic' | 'pro';   // Optional: User plan (default: 'basic')
  request_id?: string;      // Optional: Idempotency key
}
```

**Example:**
```json
{
  "message": "What are the top Shopify apps for inventory management?",
  "session_id": "abc123",
  "user_id": "user_456"
}
```

---

## Streaming Response (SSE)

The `/api/v1/chat/stream/fast` endpoint returns Server-Sent Events (SSE).

### Event Types

```typescript
// All possible event types
type StreamEventType = 
  | 'status'        // Real-time status updates (thinking, searching, writing)
  | 'token'         // Text content chunks
  | 'table'         // Structured table data
  | 'insight'       // Key insights
  | 'done'          // Stream complete
  | 'error';        // Error occurred
```

### Event Schemas

```typescript
// Status Event - Immediate feedback
interface StatusEvent {
  type: 'status';
  status: 'thinking' | 'searching' | 'writing' | 'generating' | 'web_search';
  message: string;      // Human-readable: "Processing your request..."
  icon?: string;        // UI hint: 'spinner' | 'search' | 'pencil'
  timestamp: string;
}

// Token Event - Content chunks
interface TokenEvent {
  type: 'token';
  content: string;      // Markdown text chunk
  done?: boolean;
  timestamp: string;
}

// Table Event - Structured data
interface TableEvent {
  type: 'table';
  table: {
    id?: string;
    title: string;
    description?: string;
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'url';
      unit?: string;
    }>;
    rows: any[][];
    footer?: string;
  };
  timestamp: string;
}

// Done Event - Stream complete
interface DoneEvent {
  type: 'done';
  session_id: string;
  tables: TableEvent['table'][];
  insights: Array<{ text: string; category?: string; confidence?: number }>;
  explanation?: string;
  metadata?: {
    web_search_used?: boolean;
    grounding_chunks_count?: number;
  };
  done: true;
  timestamp: string;
}

// Error Event
interface ErrorEvent {
  type: 'error';
  error: string;
  code?: 'STREAM_ERROR' | 'STREAM_CANCELLED' | 'RATE_LIMIT' | 'AUTH_ERROR';
  done: true;
  timestamp: string;
}
```

---

## TypeScript Integration

### Complete Types

```typescript
// types/copilot.ts

export interface ChatRequest {
  message: string;
  session_id?: string;
  user_id?: string;
  plan?: 'basic' | 'pro';
  request_id?: string;
}

export type StreamEvent = 
  | StatusEvent 
  | TokenEvent 
  | TableEvent 
  | DoneEvent 
  | ErrorEvent;

export interface StatusEvent {
  type: 'status';
  status: string;
  message: string;
  icon?: string;
  timestamp: string;
}

export interface TokenEvent {
  type: 'token';
  content: string;
  done?: boolean;
  timestamp: string;
}

export interface TableColumn {
  name: string;
  type: 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'url';
  unit?: string;
  description?: string;
}

export interface TableData {
  id?: string;
  title: string;
  description?: string;
  columns: TableColumn[];
  rows: any[][];
  footer?: string;
}

export interface TableEvent {
  type: 'table';
  table: TableData;
  timestamp: string;
}

export interface Insight {
  id?: string;
  text: string;
  category?: string;
  confidence?: number;
}

export interface DoneEvent {
  type: 'done';
  session_id: string;
  tables: TableData[];
  insights: Insight[];
  explanation?: string;
  metadata?: Record<string, any>;
  done: true;
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
  code?: string;
  done: true;
  timestamp: string;
}
```

---

## React Integration Example

### Hook: useCopilotChat

```typescript
// hooks/useCopilotChat.ts
import { useState, useCallback, useRef } from 'react';
import type { ChatRequest, StreamEvent, TableData, Insight } from '@/types/copilot';

interface ChatState {
  isLoading: boolean;
  status: string | null;
  statusMessage: string | null;
  content: string;
  tables: TableData[];
  insights: Insight[];
  sessionId: string | null;
  error: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useCopilotChat() {
  const [state, setState] = useState<ChatState>({
    isLoading: false,
    status: null,
    statusMessage: null,
    content: '',
    tables: [],
    insights: [],
    sessionId: null,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (request: ChatRequest) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    // Reset state
    setState(prev => ({
      ...prev,
      isLoading: true,
      status: 'connecting',
      statusMessage: 'Connecting...',
      content: '',
      tables: [],
      insights: [],
      error: null,
    }));

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/stream/fast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth if available
          // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch (e) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }
      setState(prev => ({
        ...prev,
        isLoading: false,
        status: 'error',
        error: error.message || 'An error occurred',
      }));
    }
  }, []);

  const handleEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'status':
        setState(prev => ({
          ...prev,
          status: event.status,
          statusMessage: event.message,
        }));
        break;

      case 'token':
        setState(prev => ({
          ...prev,
          status: 'writing',
          content: prev.content + event.content,
        }));
        break;

      case 'table':
        setState(prev => ({
          ...prev,
          tables: [...prev.tables, event.table],
        }));
        break;

      case 'done':
        setState(prev => ({
          ...prev,
          isLoading: false,
          status: 'complete',
          statusMessage: null,
          sessionId: event.session_id,
          tables: event.tables || prev.tables,
          insights: event.insights || [],
        }));
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          isLoading: false,
          status: 'error',
          error: event.error,
        }));
        break;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        isLoading: false,
        status: 'cancelled',
      }));
    }
  }, []);

  return {
    ...state,
    sendMessage,
    cancel,
  };
}
```

### Component: CopilotChat

```tsx
// components/CopilotChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useCopilotChat } from '@/hooks/useCopilotChat';
import ReactMarkdown from 'react-markdown';

// Status indicator component
const StatusIndicator: React.FC<{ status: string; message: string }> = ({ status, message }) => {
  const icons: Record<string, string> = {
    thinking: '🤔',
    searching: '🔍',
    writing: '✍️',
    generating: '⚡',
    web_search: '🌐',
  };
  
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse">
      <span>{icons[status] || '⏳'}</span>
      <span>{message}</span>
    </div>
  );
};

// Table component
const DataTable: React.FC<{ table: any }> = ({ table }) => (
  <div className="my-4 overflow-x-auto">
    <h4 className="font-semibold mb-2">{table.title}</h4>
    {table.description && <p className="text-sm text-gray-600 mb-2">{table.description}</p>}
    <table className="min-w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          {table.columns.map((col: any, i: number) => (
            <th key={i} className="border border-gray-300 px-4 py-2 text-left">
              {col.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row: any[], rowIndex: number) => (
          <tr key={rowIndex} className="hover:bg-gray-50">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {table.footer && <p className="text-xs text-gray-500 mt-1">{table.footer}</p>}
  </div>
);

export function CopilotChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    isLoading,
    status,
    statusMessage,
    content,
    tables,
    sessionId,
    error,
    sendMessage,
    cancel,
  } = useCopilotChat();

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content, tables]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    sendMessage({
      message: input.trim(),
      session_id: sessionId || undefined,
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status indicator */}
        {isLoading && status && statusMessage && (
          <StatusIndicator status={status} message={statusMessage} />
        )}
        
        {/* Streaming content */}
        {content && (
          <div className="prose max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        
        {/* Tables */}
        {tables.map((table, index) => (
          <DataTable key={index} table={table} />
        ))}
        
        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about e-commerce, products, markets..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
```

---

## Vanilla JavaScript Example

```javascript
async function sendChatMessage(message, sessionId = null) {
  const response = await fetch('http://localhost:8000/api/v1/chat/stream/fast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));
        
        switch (event.type) {
          case 'status':
            console.log(`Status: ${event.status} - ${event.message}`);
            updateStatusUI(event.status, event.message);
            break;
            
          case 'token':
            fullContent += event.content;
            updateContentUI(fullContent);
            break;
            
          case 'table':
            renderTable(event.table);
            break;
            
          case 'done':
            console.log('Complete!', event.session_id);
            hideLoadingUI();
            break;
            
          case 'error':
            console.error('Error:', event.error);
            showError(event.error);
            break;
        }
      }
    }
  }
}

// Usage
sendChatMessage('What are the best Shopify apps for SEO?');
```

---

## Event Flow Timeline

```
User sends message
        │
        ▼
┌───────────────────────────────────┐
│ status: "thinking"                │  ← Immediate (0ms)
│ message: "Processing request..."  │
└───────────────────────────────────┘
        │
        ▼ (if web search needed)
┌───────────────────────────────────┐
│ status: "searching"               │  ← ~500ms
│ message: "Searching the web..."   │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ status: "writing"                 │  ← Before first token
│ message: "Generating response..." │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ token: "Here are the"             │  ← First token (~750ms-5s)
│ token: " top recommendations"     │
│ token: "..."                      │
│ ... (continuous streaming)        │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ table: { title: "...", ... }      │  ← Optional structured data
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ done: { session_id, tables, ... } │  ← Complete
└───────────────────────────────────┘
```

---

## Error Handling

### HTTP Errors

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check request format |
| 401 | Unauthorized | Refresh/obtain JWT |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry with backoff |
| 503 | API quota exceeded | Contact support |

### Stream Errors

```typescript
if (event.type === 'error') {
  switch (event.code) {
    case 'RATE_LIMIT':
      // Show "Please wait before sending another message"
      break;
    case 'AUTH_ERROR':
      // Redirect to login
      break;
    case 'STREAM_CANCELLED':
      // User cancelled or server shutdown - can retry
      break;
    default:
      // Show generic error message
  }
}
```

---

## Best Practices

1. **Always use `/chat/stream/fast`** for production - it's optimized for speed
2. **Handle all event types** - especially `status` for immediate feedback
3. **Store `session_id`** from `done` event to continue conversations
4. **Implement cancel** - users should be able to stop long responses
5. **Show status immediately** - display "Thinking..." as soon as request starts
6. **Render markdown** - responses use markdown formatting
7. **Handle tables separately** - they need special rendering, not markdown

---

## CORS

The API allows cross-origin requests in development. For production, configure `ALLOWED_ORIGINS` in the backend.

---

## Support

For issues or questions, contact the backend team.
