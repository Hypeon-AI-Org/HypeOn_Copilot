# Frontend Integration Guide

Complete guide for integrating the HypeOn Copilot Backend API with your frontend application.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Session Management](#session-management)
5. [Chat Flow](#chat-flow)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## Overview

This backend provides:
- **Chat API** - Multi-stage LLM pipeline for intelligent responses
- **Session Management** - Persistent conversation history
- **Authentication** - JWT token-based authentication continuation
- **User Isolation** - Users can only access their own sessions

**Base URL:** `https://your-backend-url.com` (or `http://localhost:8080` for development)

---

## Authentication

### How It Works

This backend uses **authentication continuation** from your main backend. The frontend should:

1. **Get JWT token** from main backend (login/signup)
2. **Include token** in Authorization header for protected endpoints
3. **Token structure** should match:
   ```json
   {
     "sub": "user_id",
     "type": "access",
     "user": {
       "id": "user_id",
       "name": "User Name",
       "email": "user@example.com",
       "role": "user"
     },
     "exp": 1234567890
   }
   ```

### Token Usage

**Protected Endpoints** (require token):
- `GET /api/v1/sessions` - List user sessions
- `GET /api/v1/sessions/{session_id}` - Get session details
- `GET /api/v1/sessions/{session_id}/messages` - Get chat history
- `GET /api/v1/me` - Get user info

**Optional Authentication** (work with or without token):
- `POST /api/v1/chat` - Chat endpoint
- `POST /api/v1/chat/stream` - Streaming chat

### Headers

Always include the token in the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00",
  "version": "1.0.0"
}
```

**Usage:** Check if backend is running

---

### 2. Chat Endpoint

**Endpoint:** `POST /api/v1/chat`

**Authentication:** Optional (recommended)

**Request:**
```json
{
  "message": "Hello! How are you?",
  "session_id": "optional-session-uuid",  // Omit for new conversation
  "user_id": "optional-user-id",           // Ignored if token provided
  "plan": "basic",                         // Optional, defaults to "basic"
  "request_id": "optional-idempotency-key" // Optional, for retry safety
}
```

**Response:**
```json
{
  "session_id": "uuid-of-session",
  "answer": "I'm doing well, thank you! How can I help you today?",
  "structured_output": [
    {
      "stage": "routing",
      "content": {
        "complexity": "simple",
        "stages_to_run": ["enhance", "compose"]
      }
    },
    {
      "stage": "enhance",
      "content": {
        "enhanced_prompt": "...",
        "clarifications_added": false
      }
    },
    {
      "stage": "compose",
      "content": {
        "answer": "I'm doing well, thank you!..."
      }
    }
  ],
  "usage": {
    "tokens": 1234,
    "tokens_per_stage": {
      "routing": 50,
      "enhance": 100,
      "compose": 1084
    },
    "estimated_cost_usd": 0.012
  },
  "meta": {
    "llm_calls": 3,
    "execution_path": ["routing", "enhance", "compose"],
    "complexity": "simple",
    "models_used": {
      "routing": "claude-3-5-haiku-20241022",
      "enhance": "claude-3-5-haiku-20241022",
      "compose": "claude-3-5-haiku-20241022"
    }
  }
}
```

**Important Notes:**
- First message: Omit `session_id` to create new conversation
- Continue conversation: Include `session_id` from previous response
- With authentication: Token's `user_id` is used automatically
- Without authentication: Uses `user_id` from request body or "anonymous"

---

### 3. Streaming Chat

**Endpoint:** `POST /api/v1/chat/stream`

**Authentication:** Optional

**Request:** Same as `/api/v1/chat`

**Response:** Server-Sent Events (SSE)

**Event Format:**
```
data: {"type": "chunk", "content": "Hello", "done": false}

data: {"type": "chunk", "content": " there", "done": false}

data: {"type": "done", "session_id": "uuid", "usage": {"tokens": 1234}, "done": true}
```

---

### 4. List User Sessions (History)

**Endpoint:** `GET /api/v1/sessions`

**Authentication:** **Required** (JWT token)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "session_id": "uuid-1",
    "user_id": "user123",
    "plan": "basic",
    "title": "Chat about AI",
    "created_at": "2024-01-01T00:00:00",
    "last_active_at": "2024-01-01T12:00:00"
  },
  {
    "session_id": "uuid-2",
    "user_id": "user123",
    "plan": "basic",
    "title": "Python help",
    "created_at": "2024-01-01T10:00:00",
    "last_active_at": "2024-01-01T10:30:00"
  }
]
```

**Usage:** Display conversation history/sidebar

---

### 5. Get Session Details

**Endpoint:** `GET /api/v1/sessions/{session_id}`

**Authentication:** **Required**

**Response:**
```json
{
  "session_id": "uuid",
  "user_id": "user123",
  "plan": "basic",
  "title": "Chat about AI",
  "created_at": "2024-01-01T00:00:00",
  "last_active_at": "2024-01-01T12:00:00"
}
```

**Error:** Returns `403 Forbidden` if session doesn't belong to user

---

### 6. Get Session Messages (Chat History)

**Endpoint:** `GET /api/v1/sessions/{session_id}/messages`

**Authentication:** **Required**

**Query Parameters:**
- `limit` (optional): Limit number of messages (default: all)

**Response:**
```json
[
  {
    "message_id": "msg-1",
    "session_id": "uuid",
    "role": "user",
    "content": "Hello!",
    "token_count": 5,
    "created_at": "2024-01-01T00:00:00"
  },
  {
    "message_id": "msg-2",
    "session_id": "uuid",
    "role": "assistant",
    "content": "Hi there! How can I help you?",
    "token_count": 20,
    "created_at": "2024-01-01T00:00:05"
  }
]
```

**Usage:** Load conversation history when user opens a session

---

### 7. Get User Info

**Endpoint:** `GET /api/v1/me`

**Authentication:** **Required**

**Response:**
```json
{
  "user_id": "user123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "plan": "basic",
  "limits": {
    "max_tokens": 10000,
    "max_turns": 50,
    "max_requests_per_minute": 60,
    "max_sessions": 100
  }
}
```

**Usage:** Display user profile, plan limits, etc.

---

## Session Management

### Creating a New Session

**Method 1:** Send first message without `session_id`
```javascript
const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Hello!"
  })
});

const data = await response.json();
const sessionId = data.session_id; // Save this for continuing conversation
```

### Continuing a Session

Include `session_id` in subsequent messages:
```javascript
const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Tell me more about that",
    session_id: savedSessionId
  })
});
```

### Loading Session History

```javascript
// Get all sessions
const sessionsResponse = await fetch('/api/v1/sessions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const sessions = await sessionsResponse.json();

// Get messages for a specific session
const messagesResponse = await fetch(`/api/v1/sessions/${sessionId}/messages`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const messages = await messagesResponse.json();
```

---

## Chat Flow

### Complete Chat Flow Example

```javascript
class ChatService {
  constructor(apiBaseUrl, jwtToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.token = jwtToken;
    this.currentSessionId = null;
  }

  async sendMessage(message, sessionId = null) {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        session_id: sessionId || this.currentSessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Save session ID for continuing conversation
    if (!this.currentSessionId) {
      this.currentSessionId = data.session_id;
    }

    return {
      answer: data.answer,
      sessionId: data.session_id,
      tokens: data.usage.tokens,
      cost: data.usage.estimated_cost_usd
    };
  }

  async getSessions() {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }

    return await response.json();
  }

  async getSessionMessages(sessionId) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/sessions/${sessionId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return await response.json();
  }

  async switchSession(sessionId) {
    this.currentSessionId = sessionId;
    return await this.getSessionMessages(sessionId);
  }

  newChat() {
    this.currentSessionId = null;
  }
}
```

---

## Error Handling

### HTTP Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request (e.g., missing message)
- **401 Unauthorized** - Missing or invalid token
- **403 Forbidden** - Token valid but no permission (e.g., accessing other user's session)
- **404 Not Found** - Session not found
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error
- **503 Service Unavailable** - LLM API quota exceeded

### Error Response Format

```json
{
  "detail": "Error message here"
}
```

### Error Handling Example

```javascript
async function handleChatRequest(message, sessionId) {
  try {
    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, session_id: sessionId })
    });

    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      window.location.href = '/login';
      return;
    }

    if (response.status === 403) {
      // Permission denied - show error
      throw new Error('You do not have permission to access this session');
    }

    if (response.status === 429) {
      // Rate limited - show retry message
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Chat error:', error);
    // Show user-friendly error message
    return { error: error.message };
  }
}
```

---

## Code Examples

### React Example

```jsx
import { useState, useEffect } from 'react';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('jwt_token');
  const apiUrl = 'https://your-backend-url.com';

  const sendMessage = async (userMessage) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Update session ID if new conversation
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      // Add messages to chat
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: data.answer }
      ]);

    } catch (error) {
      console.error('Error:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const sessions = await response.json();
      return sessions;
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  };

  const loadSessionMessages = async (sid) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sessions/${sid}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const messages = await response.json();
      setMessages(messages);
      setSessionId(sid);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  return (
    <div>
      {/* Chat UI */}
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      
      {/* Input */}
      <input
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !loading) {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
        disabled={loading}
      />
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div class="chat-container">
    <div class="messages">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.role]"
      >
        {{ msg.content }}
      </div>
    </div>
    
    <div class="input-area">
      <input
        v-model="inputMessage"
        @keyup.enter="sendMessage"
        :disabled="loading"
        placeholder="Type your message..."
      />
      <button @click="sendMessage" :disabled="loading || !inputMessage">
        Send
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      messages: [],
      inputMessage: '',
      sessionId: null,
      loading: false,
      apiUrl: 'https://your-backend-url.com',
      token: localStorage.getItem('jwt_token')
    };
  },
  methods: {
    async sendMessage() {
      if (!this.inputMessage || this.loading) return;
      
      const userMessage = this.inputMessage;
      this.inputMessage = '';
      this.loading = true;
      
      // Add user message to UI immediately
      this.messages.push({
        role: 'user',
        content: userMessage
      });

      try {
        const response = await fetch(`${this.apiUrl}/api/v1/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: userMessage,
            session_id: this.sessionId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        
        if (!this.sessionId) {
          this.sessionId = data.session_id;
        }

        this.messages.push({
          role: 'assistant',
          content: data.answer
        });

      } catch (error) {
        console.error('Error:', error);
        this.$toast.error('Failed to send message');
      } finally {
        this.loading = false;
      }
    },
    
    async loadSessions() {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/sessions`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        return await response.json();
      } catch (error) {
        console.error('Failed to load sessions:', error);
        return [];
      }
    }
  }
};
</script>
```

### JavaScript (Vanilla) Example

```javascript
class HypeonChatClient {
  constructor(apiBaseUrl, jwtToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.token = jwtToken;
    this.sessionId = null;
  }

  async chat(message, onProgress = null) {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        session_id: this.sessionId
      })
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    const data = await response.json();
    
    if (!this.sessionId) {
      this.sessionId = data.session_id;
    }

    return data;
  }

  async getSessions() {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/sessions`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get sessions');
    }

    return await response.json();
  }

  async getMessages(sessionId) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/sessions/${sessionId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get messages');
    }

    return await response.json();
  }

  setSession(sessionId) {
    this.sessionId = sessionId;
  }

  newChat() {
    this.sessionId = null;
  }
}

// Usage
const client = new HypeonChatClient(
  'https://your-backend-url.com',
  localStorage.getItem('jwt_token')
);

// Send message
const response = await client.chat('Hello!');
console.log(response.answer);

// Get all sessions
const sessions = await client.getSessions();
console.log(sessions);
```

---

## Best Practices

### 1. Token Management

```javascript
// Store token securely
localStorage.setItem('jwt_token', token);

// Check token expiration
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Refresh token if expired
if (isTokenExpired(token)) {
  // Redirect to login or refresh token
  window.location.href = '/login';
}
```

### 2. Session Management

```javascript
// Save session ID in localStorage
localStorage.setItem('current_session_id', sessionId);

// Load session on page load
const savedSessionId = localStorage.getItem('current_session_id');
if (savedSessionId) {
  // Load messages for this session
  await loadSessionMessages(savedSessionId);
}
```

### 3. Error Handling

```javascript
async function safeApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.message.includes('429')) {
      // Show rate limit message
      showToast('Too many requests. Please wait a moment.');
    } else {
      // Show generic error
      showToast('Something went wrong. Please try again.');
    }
    throw error;
  }
}
```

### 4. Loading States

```javascript
// Show loading indicator during chat
const [loading, setLoading] = useState(false);

const sendMessage = async (message) => {
  setLoading(true);
  try {
    const response = await chat(message);
    // Handle response
  } finally {
    setLoading(false);
  }
};
```

### 5. Optimistic Updates

```javascript
// Add user message immediately (optimistic update)
setMessages(prev => [...prev, { role: 'user', content: message }]);

// Then send to API
const response = await chat(message);

// Add assistant response when received
setMessages(prev => [...prev, { role: 'assistant', content: response.answer }]);
```

### 6. Retry Logic

```javascript
async function chatWithRetry(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chat(message);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 7. Request Idempotency

```javascript
// Generate unique request ID for retry safety
const requestId = `${Date.now()}-${Math.random()}`;

const response = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Request-ID': requestId  // Optional but recommended
  },
  body: JSON.stringify({
    message,
    request_id: requestId  // Also in body
  })
});
```

---

## Complete Integration Example

### React Hook Example

```jsx
import { useState, useCallback } from 'react';

export function useHypeonChat(apiUrl, token) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (message) => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError(null);

    // Optimistic update
    const userMessage = { role: 'user', content: message, id: Date.now() };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          session_id: sessionId
        })
      });

      if (response.status === 401) {
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Request failed');
      }

      const data = await response.json();

      if (!sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem('current_session_id', data.session_id);
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer, id: Date.now() + 1 }
      ]);

      return data;
    } catch (err) {
      setError(err.message);
      // Remove optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, sessionId, loading]);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [apiUrl, token]);

  const loadSession = useCallback(async (sid) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sessions/${sid}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const messages = await response.json();
      setMessages(messages);
      setSessionId(sid);
      localStorage.setItem('current_session_id', sid);
    } catch (err) {
      setError(err.message);
    }
  }, [apiUrl, token]);

  const newChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    localStorage.removeItem('current_session_id');
  }, []);

  return {
    messages,
    sessionId,
    loading,
    error,
    sendMessage,
    loadSessions,
    loadSession,
    newChat
  };
}
```

**Usage:**
```jsx
function ChatApp() {
  const token = localStorage.getItem('jwt_token');
  const {
    messages,
    loading,
    sendMessage,
    loadSessions,
    loadSession,
    newChat
  } = useHypeonChat('https://your-backend-url.com', token);

  return (
    <div>
      {/* Your chat UI */}
    </div>
  );
}
```

---

## Testing Integration

### Test Checklist

1. **Authentication:**
   - [ ] Token is sent in Authorization header
   - [ ] Protected endpoints work with valid token
   - [ ] Protected endpoints return 401/403 without token
   - [ ] Token expiration is handled

2. **Chat:**
   - [ ] New conversation creates session
   - [ ] Continuing conversation uses existing session
   - [ ] Messages are displayed correctly
   - [ ] Error handling works

3. **Session Management:**
   - [ ] Sessions list loads correctly
   - [ ] Session messages load correctly
   - [ ] Switching between sessions works
   - [ ] New chat button clears current session

4. **Error Handling:**
   - [ ] Network errors are handled
   - [ ] API errors are displayed to user
   - [ ] Rate limiting is handled gracefully
   - [ ] Token expiration redirects to login

---

## Common Issues & Solutions

### Issue: "401 Unauthorized"

**Solution:**
- Check token is included in Authorization header
- Verify token format: `Bearer <token>`
- Check if token has expired
- Ensure token is from main backend

### Issue: "403 Forbidden" when accessing session

**Solution:**
- Verify session belongs to authenticated user
- Check token's `user_id` matches session's `user_id`
- Ensure you're using the correct session_id

### Issue: Chat creates new session every time

**Solution:**
- Make sure you're saving `session_id` from response
- Include `session_id` in subsequent requests
- Check localStorage/sessionStorage for saved session_id

### Issue: Messages not loading

**Solution:**
- Verify authentication token is valid
- Check session_id is correct
- Ensure API endpoint URL is correct
- Check browser console for errors

---

## Support

For issues or questions:
1. Check API documentation at `/docs` endpoint
2. Review error messages in browser console
3. Verify environment variables are set correctly
4. Check backend logs for detailed errors

---

## Quick Reference

### Base URL
```
Production: https://your-backend-url.com
Development: http://localhost:8080
```

### Required Headers
```javascript
{
  'Authorization': 'Bearer <jwt_token>',  // For protected endpoints
  'Content-Type': 'application/json'      // For POST requests
}
```

### Key Endpoints
- `POST /api/v1/chat` - Send message
- `GET /api/v1/sessions` - List sessions
- `GET /api/v1/sessions/{id}/messages` - Get messages
- `GET /api/v1/me` - Get user info

---

**Last Updated:** 2024
**API Version:** 1.0.0

