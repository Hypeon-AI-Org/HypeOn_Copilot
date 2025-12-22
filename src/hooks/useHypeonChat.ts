/**
 * React Hook for HypeOn Chat Integration
 * Based on FRONTEND_INTEGRATION.md
 */

import { useState, useCallback, useEffect } from 'react';
import { ChatService, ChatRequest, ChatResponse, Session, Message } from '@/lib/chatService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export interface UseHypeonChatOptions {
  apiUrl?: string;
  token?: string | null;
  autoLoadSessions?: boolean;
}

export interface UseHypeonChatReturn {
  // State
  messages: Message[];
  sessionId: string | null;
  sessions: Session[];
  loading: boolean;
  error: string | null;
  currentSession: Session | null;
  progress: {
    stage: string;
    progress: number;
    message: string;
  } | null;

  // Actions
  sendMessage: (message: string) => Promise<ChatResponse | null>;
  sendMessageStream: (
    message: string,
    onChunk: (chunk: string) => void,
    onProgress?: (stage: string, progress: number, message: string) => void
  ) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newChat: () => void;
  setSession: (sessionId: string | null) => void;
  refreshSessions: () => Promise<void>;
}

export function useHypeonChat(options: UseHypeonChatOptions = {}): UseHypeonChatReturn {
  const { apiUrl, token, autoLoadSessions = false } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<{ stage: string; progress: number; message: string } | null>(null);

  const chatService = new ChatService(apiUrl || API_BASE_URL, token);

  // Load sessions on mount if autoLoadSessions is true
  useEffect(() => {
    if (autoLoadSessions && token) {
      loadSessions().catch(console.error);
    }
  }, [autoLoadSessions, token]);

  // Load session from localStorage on mount
  useEffect(() => {
    if (token) {
      const savedSessionId = localStorage.getItem('current_session_id');
      if (savedSessionId && savedSessionId !== 'new') {
        loadSession(savedSessionId).catch(console.error);
      }
    }
  }, [token]);

  const sendMessage = useCallback(
    async (message: string): Promise<ChatResponse | null> => {
      if (!message.trim() || loading) return null;

      setLoading(true);
      setError(null);

      // Add user message optimistically
      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        session_id: sessionId || 'temp',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const request: ChatRequest = {
          message,
          session_id: sessionId,
          plan: 'basic',
          request_id: `req-${Date.now()}-${Math.random()}`,
        };

        const response = await chatService.chat(request);

        // Update session ID if new conversation
        if (!sessionId) {
          setSessionId(response.session_id);
          localStorage.setItem('current_session_id', response.session_id);
        }

        // Add assistant message
        const assistantMessage: Message = {
          message_id: `msg-${Date.now()}`,
          session_id: response.session_id,
          role: 'assistant',
          content: response.answer,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Refresh sessions to update last_active_at
        if (token) {
          refreshSessions().catch(console.error);
        }

        return response;
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        // Remove optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.message_id !== userMessage.message_id));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, token, chatService]
  );

  const sendMessageStream = useCallback(
    async (
      message: string, 
      onChunk: (chunk: string) => void,
      onProgress?: (stage: string, progress: number, message: string) => void
    ): Promise<void> => {
      if (!message.trim() || loading) return;

      setLoading(true);
      setError(null);
      setProgress({ stage: 'routing', progress: 0, message: 'Connecting...' });

      // Add user message optimistically
      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        session_id: sessionId || 'temp',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      let assistantContent = '';

      try {
        const request: ChatRequest = {
          message,
          session_id: sessionId,
          plan: 'basic',
          request_id: `req-${Date.now()}-${Math.random()}`,
        };

        await chatService.chatStream(
          request,
          (chunk: string, done: boolean) => {
            assistantContent += chunk;
            onChunk(chunk);
          },
          (newSessionId: string, tables, explanation, insights, artifacts) => {
            // Update session ID if new conversation
            if (!sessionId) {
              setSessionId(newSessionId);
              localStorage.setItem('current_session_id', newSessionId);
            }

            // Add assistant message when complete
            const assistantMessage: Message = {
              message_id: `msg-${Date.now()}`,
              session_id: newSessionId,
              role: 'assistant',
              content: assistantContent,
              created_at: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setProgress(null); // Clear progress when done

            // Refresh sessions
            if (token) {
              refreshSessions().catch(console.error);
            }
          },
          (stage: string, progressValue: number, statusMessage: string) => {
            setProgress({ stage, progress: progressValue, message: statusMessage });
            if (onProgress) {
              onProgress(stage, progressValue, statusMessage);
            }
          }
        );
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        setProgress(null);
        // Remove optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.message_id !== userMessage.message_id));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, token, chatService]
  );

  const loadSessions = useCallback(async () => {
    if (!token) {
      setSessions([]);
      return;
    }

    try {
      const loadedSessions = await chatService.getSessions();
      setSessions(loadedSessions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
      setSessions([]);
    }
  }, [token, chatService]);

  const loadSession = useCallback(
    async (sid: string) => {
      // If no token, silently fail - session management requires auth
      if (!token) {
        console.warn('Cannot load session: Authentication required. Chat will work without session history.');
        setSessionId(sid);
        setMessages([]);
        setCurrentSession(null);
        localStorage.setItem('current_session_id', sid);
        return;
      }

      try {
        const [session, sessionMessages] = await Promise.all([
          chatService.getSession(sid),
          chatService.getSessionMessages(sid),
        ]);

        setSessionId(sid);
        setMessages(sessionMessages);
        setCurrentSession(session);
        localStorage.setItem('current_session_id', sid);
        setError(null);
      } catch (err: any) {
        // Don't show error if it's just missing auth - user can still chat
        if (err.message?.includes('Authentication required')) {
          console.warn('Session history unavailable: Authentication required. Chat will work without session history.');
          setSessionId(sid);
          setMessages([]);
          setCurrentSession(null);
        } else {
          setError(err.message || 'Failed to load session');
          throw err;
        }
      }
    },
    [token, chatService]
  );

  const newChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setCurrentSession(null);
    localStorage.setItem('current_session_id', 'new');
  }, []);

  const setSession = useCallback((sid: string | null) => {
    setSessionId(sid);
    if (sid) {
      localStorage.setItem('current_session_id', sid);
    } else {
      localStorage.setItem('current_session_id', 'new');
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  return {
    messages,
    sessionId,
    sessions,
    loading,
    error,
    currentSession,
    progress,
    sendMessage,
    sendMessageStream,
    loadSessions,
    loadSession,
    newChat,
    setSession,
    refreshSessions,
  };
}

