"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import SearchChatsModal from "@/components/chatbot/SearchChatsModal";
import { useHypeonChat } from "@/hooks/useHypeonChat";
import { getToken, listenForTokenUpdates, requestTokenFromParent, getTokenInfo } from "@/lib/auth";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
import { ProgressContainer } from "@/components/chatbot/ProgressContainer";
import { ResearchPlanIndicator } from "@/components/chatbot/ResearchPlanIndicator";
import { DataTable } from "@/components/chatbot/DataTable";
import { ChatResponse, TableData } from "@/lib/chatService";
import styles from "../../styles/chat.module.css";
import ThemeToggle from "../../components/ThemeToggle";

const ChatSidebar = dynamic(
  () => import("@/components/chatbot/ChatSidebar"),
  { ssr: false }
);

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      summary: string;
      table: {
        type: "product_table" | "keyword_table";
        columns: string[];
        rows: (string | number)[][];
      };
      isNew?: boolean;
      // New format support
      chatResponse?: ChatResponse;
    };

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

function TypingSummary({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const words = text.split(" ");

    const timer = setInterval(() => {
      setDisplayed((prev) => prev + (prev ? " " : "") + words[i]);
      i++;

      if (i >= words.length) {
        clearInterval(timer);
        onDone();
      }
    }, 45);

    return () => clearInterval(timer);
  }, [text, onDone]);

  return <p>{displayed}</p>;
}

// Wrapper component for ChatMessage with typing animation
function TypingChatMessage({
  response,
  shouldAnimate,
  onAnimationComplete,
}: {
  response: ChatResponse;
  shouldAnimate: boolean;
  onAnimationComplete: () => void;
}) {
  return (
    <ChatMessage
      response={response}
      isUser={false}
      animate={shouldAnimate}
      animationSpeed={10}
      onAnimationComplete={onAnimationComplete}
    />
  );
}

function StreamingTable({
  rows,
  onDone,
  delay = 140,
}: {
  rows: any[];
  onDone: () => void;
  delay?: number;
}) {
  const [visibleRows, setVisibleRows] = useState<any[]>([]);

  useEffect(() => {
    if (!Array.isArray(rows)) return;

    setVisibleRows([]);
    let i = 0;

    const timer = setInterval(() => {
      const row = rows[i];

      const safeRow =
        Array.isArray(row)
          ? row
          : row && typeof row === "object"
          ? Object.values(row)
          : [];

      setVisibleRows((prev) => [...prev, safeRow]);
      i++;

      if (i >= rows.length) {
        clearInterval(timer);
        onDone();
      }
    }, delay);

    return () => clearInterval(timer);
  }, [rows, delay, onDone]);

  return (
    <>
      {visibleRows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell: any, ci: number) => (
            <td key={ci}>{String(cell ?? "")}</td>
          ))}
        </tr>
      ))}
    </>
  );
}


export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Get token from parent app (app.hypeon.ai) cookie or local storage
  const token = getToken() || process.env.NEXT_PUBLIC_JWT_TOKEN || null;
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

  // Verify token in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && token) {
      const tokenInfo = getTokenInfo(token);
      if (tokenInfo) {
        console.log('🔍 Token Verification:', {
          valid: tokenInfo.valid,
          expired: tokenInfo.expired,
          expirationDate: tokenInfo.expirationDate?.toISOString() || 'Unknown',
          userId: tokenInfo.payload?.sub || tokenInfo.payload?.user?.id || 'Unknown',
          userEmail: tokenInfo.payload?.user?.email || 'Unknown',
        });
        
        if (tokenInfo.expired) {
          console.warn('⚠️ Token is expired! Please generate a new token.');
        }
      }
    }
  }, [token]);

  // Redirect to app.hypeon.ai if no token found
  useEffect(() => {
    // Skip redirect if auth is disabled in development or we have an env token
    const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    if (isAuthDisabled || process.env.NEXT_PUBLIC_JWT_TOKEN) {
      return;
    }

    // Check if token exists
    const currentToken = getToken();
    
    if (!currentToken) {
      // Check if we're in an iframe (give parent app time to send token)
      const isInIframe = typeof window !== 'undefined' && window !== window.parent;
      
      // Wait a bit longer if in iframe to allow parent app to send token
      const waitTime = isInIframe ? 2000 : 500;
      
      const redirectTimer = setTimeout(() => {
        // Check one more time before redirecting
        const finalToken = getToken();
        if (!finalToken) {
          // Redirect to app.hypeon.ai for authentication
          window.location.href = 'https://app.hypeon.ai';
        }
      }, waitTime);

      return () => clearTimeout(redirectTimer);
    }
  }, []);

  // Listen for token updates from parent app
  useEffect(() => {
    const cleanup = listenForTokenUpdates((newToken) => {
      if (newToken) {
        // Token updated from parent app - reload to use new token
        console.log('Token updated from parent app');
        window.location.reload();
      }
    });
    
    // Request token from parent if in iframe
    if (typeof window !== 'undefined' && window !== window.parent) {
      requestTokenFromParent();
    }
    
    return cleanup;
  }, []);

  // Use backend chat hook
  const {
    messages: backendMessages,
    sessionId: backendSessionId,
    sessions: backendSessions,
    loading: backendLoading,
    error: backendError,
    progress: backendProgress,
    stages: backendStages,
    stagesArray: backendStagesArray,
    progressUpdateCounter: backendProgressUpdateCounter,
    researchPlan,
    sendMessage: backendSendMessage,
    sendMessageStream: backendSendMessageStream,
    loadSessions: backendLoadSessions,
    loadSession: backendLoadSession,
    newChat: backendNewChat,
    setSession: backendSetSession,
  } = useHypeonChat({
    apiUrl,
    token,
    autoLoadSessions: !!token,
  });

  // Local state for UI compatibility
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [model, setModel] = useState<"basic" | "pro">("basic");

  
  // Convert backend messages to UI format
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingDone, setTypingDone] = useState<Record<number, boolean>>({});
  const [tableDone, setTableDone] = useState<Record<number, boolean>>({});
  
  // Track initial message count when session is loaded (to distinguish loaded vs new messages)
  const [initialMessageCount, setInitialMessageCount] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hasChat = messages.length > 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 60);
  }, []);

  // Sync backend sessions with local chats (but don't overwrite if we're in the middle of an operation)
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    if (!isUpdating) {
      if (backendSessions.length > 0) {
        const convertedChats: ChatSession[] = backendSessions.map((s) => ({
          id: s.session_id,
          title: s.title || 'Untitled Chat',
          messages: [],
          updatedAt: new Date(s.last_active_at).getTime(),
        }));
        setChats(convertedChats);
      } else {
        // No sessions exist - create a new chat automatically
        setChats([]);
        if (!activeChatId && messages.length === 0) {
          createNewChat();
        }
      }
    }
  }, [backendSessions, isUpdating]);

  // Sync backend session ID with local active chat
  useEffect(() => {
    if (backendSessionId) {
      setActiveChatId(backendSessionId);
      localStorage.setItem("hypeon_active_chat", backendSessionId);
    }
  }, [backendSessionId]);

  // Store ChatResponse data for assistant messages (keyed by session_id + message content hash)
  const [chatResponses, setChatResponses] = useState<Map<string, ChatResponse>>(new Map());
  
  // Track previous backend messages to detect new ones
  const prevBackendMessagesRef = useRef<typeof backendMessages>([]);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  // Convert backend messages to UI format
  useEffect(() => {
    // If we're loading a session, set initial count immediately to prevent animation
    if (isLoadingSession && backendMessages.length > 0) {
      setInitialMessageCount(backendMessages.length);
      setIsLoadingSession(false);
      // Clear any new message IDs since these are loaded messages
      setNewMessageIds(new Set());
      prevBackendMessagesRef.current = backendMessages;
      return; // Don't process new message detection for loaded sessions
    }
    
    // Detect new messages by comparing with previous state
    const prevIds = new Set(prevBackendMessagesRef.current.map(m => m.message_id));
    const currentIds = new Set(backendMessages.map(m => m.message_id));
    const newlyAddedIds = new Set(
      Array.from(currentIds).filter(id => !prevIds.has(id))
    );
    
    // Update new message IDs (only keep them for a short time to trigger animation)
    // Only track new messages if we're not loading a session
    if (newlyAddedIds.size > 0 && !isLoadingSession) {
      setNewMessageIds(newlyAddedIds);
      // Clear after animation would complete (estimate: 5 seconds max)
      setTimeout(() => {
        setNewMessageIds(prev => {
          const updated = new Set(prev);
          newlyAddedIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 5000);
    }
    
    // Update ref for next comparison
    prevBackendMessagesRef.current = backendMessages;
    
    const convertedMessages: Message[] = backendMessages.map((msg, index) => {
      if (msg.role === 'user') {
        return { role: 'user', text: msg.content };
      } else {
        // Check if message has tables directly (from streaming response)
        if (msg.tables && msg.tables.length > 0) {
          const firstTable = msg.tables[0];
          const tableColumns = firstTable?.headers || 
                              firstTable?.columns?.map((c: any) => c.name || c) || 
                              [];
          const tableRows = firstTable?.rows || [];
          
          return {
            role: 'assistant',
            summary: msg.content,
            table: {
              type: 'product_table' as const,
              columns: tableColumns,
              rows: tableRows,
            },
            // Only mark as new if it's not part of initial load
            isNew: newMessageIds.has(msg.message_id) && (index >= initialMessageCount),
            // Build chatResponse from message data
            chatResponse: {
              session_id: msg.session_id,
              answer: msg.content,
              tables: msg.tables,
              insights: msg.insights,
              artifacts: msg.artifacts,
              explanation: msg.explanation,
              metadata: (msg as any).metadata,
              sectionTitles: (msg as any).metadata?.sectionTitles,
            },
          };
        }

        // Fallback: Try to parse assistant message for structured data (legacy support)
        let parsedData: any = null;
        try {
          // Check if message contains JSON
          const jsonMatch = msg.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Not JSON, treat as plain text
        }

        // Handle legacy format (summary + table)
        if (parsedData && parsedData.summary && parsedData.table) {
          return {
            role: 'assistant',
            summary: parsedData.summary,
            table: parsedData.table,
            // Only mark as new if it's not part of initial load
            isNew: newMessageIds.has(msg.message_id) && (index >= initialMessageCount),
          };
        } 
        // Handle new API format (answer + tables from JSON)
        else if (parsedData && parsedData.answer) {
          // Extract table data if available
          const firstTable = parsedData.tables?.[0];
          const tableColumns = firstTable?.headers || 
                              firstTable?.columns?.map((c: any) => c.name || c) || 
                              [];
          const tableRows = firstTable?.rows || [];
          
          return {
            role: 'assistant',
            summary: parsedData.answer,
            table: {
              type: 'product_table' as const,
              columns: tableColumns,
              rows: tableRows,
            },
            // Only mark as new if it's not part of initial load
            isNew: newMessageIds.has(msg.message_id) && (index >= initialMessageCount),
            chatResponse: parsedData,
          };
        }
        else {
          // Plain text response - create a simple summary and empty table
          // Only mark as new if it's not part of initial load
          const isNewMessage = newMessageIds.has(msg.message_id) && (index >= initialMessageCount);
          return {
            role: 'assistant',
            summary: msg.content,
            table: {
              type: 'product_table' as const,
              columns: [],
              rows: [],
            },
            isNew: isNewMessage,
          };
        }
      }
    });
    setMessages(convertedMessages);
  }, [backendMessages, newMessageIds, isLoadingSession]);

  // Sync loading state
  useEffect(() => {
    setLoading(backendLoading);
  }, [backendLoading]);

  const PLACEHOLDER_TEXT = "Describe what you want to analyze…";
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isTypingActive, setIsTypingActive] = useState(true);

  // Load sessions from backend on mount
  useEffect(() => {
    if (token) {
      // Only try to load from backend if we have a token
      backendLoadSessions().then(() => {
        // After loading sessions, check if we need to create a new chat
        // This will be handled by the backendSessions effect
      }).catch((err) => {
        // Silently handle auth/connection errors - user can still chat
        const isConnectionError = err.message?.includes('Backend unavailable') || 
                                 err.message?.includes('Failed to connect') ||
                                 err.message?.includes('Failed to fetch');
        if (!err.message?.includes('Authentication required') && !isConnectionError) {
          console.error('Failed to load sessions:', err);
        }
        // If loading fails and no active chat, create a new one
        if (!activeChatId && messages.length === 0) {
          createNewChat();
        }
      });
      
      const savedActive = localStorage.getItem("hypeon_active_chat");
      if (savedActive && savedActive !== "new") {
        backendLoadSession(savedActive).catch((err) => {
          // Silently handle auth/connection errors - user can still chat
          const isConnectionError = err.message?.includes('Backend unavailable') || 
                                   err.message?.includes('Failed to connect') ||
                                   err.message?.includes('Failed to fetch');
          const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                                 process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
          
          // If session not found, create a new chat
          if (err.message?.includes('Session not found') || 
              (err.message?.includes('permission') && isAuthDisabled)) {
            console.warn('Saved session not found - creating new chat');
            createNewChat();
            return;
          }
          
          if (!err.message?.includes('Authentication required') && !isConnectionError) {
            console.error('Failed to load session:', err);
          }
          // If loading fails and no active chat, create a new one
          if (!activeChatId && messages.length === 0) {
            createNewChat();
          }
        });
      } else if (!savedActive || savedActive === "new") {
        // No saved session or explicitly "new" - create a new chat
        createNewChat();
      }
    } else {
      // Fallback to local storage if no token
      const savedChats = localStorage.getItem("hypeon_chats");
      if (savedChats) {
        try {
          const parsed: ChatSession[] = JSON.parse(savedChats);
          setChats(parsed);
          if (parsed.length === 0) {
            createNewChat();
          }
        } catch (e) {
          console.error('Failed to parse saved chats:', e);
          createNewChat();
        }
      } else {
        // No saved chats - create a new chat
        createNewChat();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isTypingActive || input.length > 0) return;

    let i = 0;
    let dir: "f" | "b" = "f";
    let t: NodeJS.Timeout;

    const run = () => {
      if (!isTypingActive || input.length > 0) return;

      if (dir === "f") {
        setAnimatedPlaceholder(PLACEHOLDER_TEXT.slice(0, ++i));
        if (i === PLACEHOLDER_TEXT.length)
          setTimeout(() => (dir = "b"), 1200);
      } else {
        setAnimatedPlaceholder(PLACEHOLDER_TEXT.slice(0, --i));
        if (i === 0) dir = "f";
      }

      t = setTimeout(run, dir === "f" ? 55 : 35);
    };

    t = setTimeout(run, 500);
    return () => clearTimeout(t);
  }, [isTypingActive, input]);

  async function sendMessage(text: string) {
    if (!text.trim() || backendLoading) return;

    const currentActiveChatId = activeChatId;
    
    // Clear input immediately for better UX
    setInput("");

    try {
      // Use streaming API for real-time progress updates
      await backendSendMessageStream(
        text,
        // onChunk - response text is accumulated by the hook
        (chunk: string) => {
          // Chunks are handled internally by the hook
        },
        // onProgress - progress is handled by the hook, updates backendProgress state
        undefined
      );
      
      // Streaming complete - response is handled by the hook (adds to backendMessages)
      // Update chat title if new session
      if (!currentActiveChatId && backendSessionId) {
        const newChat: ChatSession = {
          id: backendSessionId,
          title: text.slice(0, 50),
          messages: [],
          updatedAt: Date.now(),
        };
        setChats((prev) => [newChat, ...prev]);
      }

      // Refresh sessions to get updated list
      if (token) {
        await backendLoadSessions();
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      
      // Check if it's a CORS/network error
      if (err.message && (err.message.includes('Failed to connect') || err.message.includes('Failed to fetch'))) {
        console.error('⚠️ Network Error: Unable to connect to backend at', apiUrl);
      }
      
      // Fallback to local API if backend fails
      if (!token) {
        await sendMessageLocal(text);
      } else {
        alert(err.message || 'Failed to send message. Please try again.');
      }
    }
  }

  // Fallback local API function (for when backend is not available)
  async function sendMessageLocal(text: string) {
    let chatId = activeChatId;

    if (!chatId) {
      chatId = crypto.randomUUID();
      const newChat: ChatSession = {
        id: chatId,
        title: text,
        messages: [],
        updatedAt: Date.now(),
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(chatId);
      localStorage.setItem("hypeon_active_chat", chatId);
    }

    const userMsg: Message = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text, model }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        ...data,
        isNew: true,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [...c.messages, userMsg, assistantMsg],
                updatedAt: Date.now(),
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function createNewChat() {
    backendNewChat();
    setActiveChatId(null);
    setMessages([]);
    setInitialMessageCount(0); // Reset initial count for new chat
    setTypingDone({});
    setTableDone({});
    setIsLoadingSession(false);
    localStorage.setItem("hypeon_active_chat", "new");
  }

  async function selectChat(id: string) {
    setIsLoadingSession(true);
    
    if (token) {
      // Load from backend
      try {
        await backendLoadSession(id);
        setActiveChatId(id);
        setTypingDone({});
        setTableDone({});
        // initialMessageCount will be set by useEffect when messages load
        return;
      } catch (err: any) {
        // Handle session not found - create new chat
        const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                               process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
        
        if (err.message?.includes('Session not found') || 
            (err.message?.includes('permission') && isAuthDisabled)) {
          console.warn('Session not found - creating new chat');
          createNewChat();
          return;
        }
        
        // Don't show error if it's just missing auth - fall back to local
        if (err.message?.includes('Authentication required')) {
          console.warn('Session history unavailable without authentication. Using local storage.');
          // Fall through to local storage fallback
        } else {
          console.error('Failed to load session:', err);
          // Still try local fallback
        }
      }
    }
    
    // Fallback to local storage (works with or without token)
    const chat = chats.find((c) => c.id === id);
    if (chat) {
      setActiveChatId(id);
      const loadedMessages = chat.messages.map((m) =>
        m.role === "assistant" ? { ...m, isNew: false } : m
      );
      setMessages(loadedMessages);
      setInitialMessageCount(loadedMessages.length); // Track initial count
      setTypingDone({});
      setTableDone({});
      setIsLoadingSession(false);
      localStorage.setItem("hypeon_active_chat", id);
    } else {
      // Session doesn't exist in local storage either - create new chat
      console.warn('Session not found in local storage - creating new chat');
      setIsLoadingSession(false);
      createNewChat();
    }
  }

  async function renameChat(id: string, title: string) {
    // Validate title
    if (!title || title.trim().length === 0) {
      console.warn('Title cannot be empty');
      return;
    }

    const trimmedTitle = title.trim();
    
    // Update local state optimistically
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmedTitle } : c))
    );

    // Update backend if we have a token
    if (token) {
      setIsUpdating(true);
      try {
        const { ChatService } = await import('@/lib/chatService');
        const chatService = new ChatService(apiUrl, token);
        await chatService.updateSessionTitle(id, trimmedTitle);
        // Refresh sessions to get updated data
        await backendLoadSessions();
      } catch (err: any) {
        // Revert on error
        console.error('Failed to update session title:', err);
        // Reload sessions to revert
        await backendLoadSessions();
        // Show error to user
        alert(err.message || 'Failed to rename chat. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    }
  }

  async function deleteChat(id: string) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this chat?')) {
      return;
    }

    // Store original state for revert
    const originalChats = [...chats];
    const wasActive = id === activeChatId;

    // Update local state optimistically
    setChats((prev) => prev.filter((c) => c.id !== id));

    if (wasActive) {
      setActiveChatId(null);
      setMessages([]);
      setTypingDone({});
      setTableDone({});
      localStorage.setItem("hypeon_active_chat", "new");
    }

    // Delete from backend if we have a token
    const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    
    if (token || isAuthDisabled) {
      setIsUpdating(true);
      try {
        const { ChatService } = await import('@/lib/chatService');
        const chatService = new ChatService(apiUrl, token);
        await chatService.deleteSession(id);
        // Refresh sessions list
        if (token) {
          await backendLoadSessions();
        } else {
          // If no token, manually update the chats list
          setChats((prev) => prev.filter((c) => c.id !== id));
        }
        
        // If all sessions are deleted or this was the active session, create a new chat
        const remainingChats = chats.filter((c) => c.id !== id);
        if (remainingChats.length === 0 || wasActive) {
          createNewChat();
        }
      } catch (err: any) {
        // Handle "Session not found" gracefully when auth is disabled - session might not exist in backend
        if (isAuthDisabled && err.message?.includes('Session not found')) {
          // Session doesn't exist in backend, but we've already removed it from UI - that's fine
          console.log('Session not found in backend (auth disabled) - removed from local UI');
          
          // If all sessions are deleted or this was the active session, create a new chat
          const remainingChats = chats.filter((c) => c.id !== id);
          if (remainingChats.length === 0 || wasActive) {
            createNewChat();
          }
        } else {
          // Revert on other errors
          console.error('Failed to delete session:', err);
          setChats(originalChats);
          if (wasActive) {
            setActiveChatId(id);
            localStorage.setItem("hypeon_active_chat", id);
          }
          // Show error to user
          alert(err.message || 'Failed to delete chat. Please try again.');
        }
      } finally {
        setIsUpdating(false);
      }
    } else {
      // No token and auth not disabled - just update local state
      const remainingChats = chats.filter((c) => c.id !== id);
      if (remainingChats.length === 0 || wasActive) {
        createNewChat();
      }
    }
  }

  async function deleteChats(ids: string[]) {
    if (ids.length === 0) return;

    // Store original state for revert
    const originalChats = [...chats];
    const wasActive = ids.includes(activeChatId || '');

    // Update local state optimistically
    setChats((prev) => prev.filter((c) => !ids.includes(c.id)));

    if (wasActive) {
      setActiveChatId(null);
      setMessages([]);
      setTypingDone({});
      setTableDone({});
      localStorage.setItem("hypeon_active_chat", "new");
    }

    // Delete from backend if we have a token
    const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    
    if (token || isAuthDisabled) {
      setIsUpdating(true);
      try {
        const { ChatService } = await import('@/lib/chatService');
        const chatService = new ChatService(apiUrl, token);
        
        // Delete all sessions in parallel
        await Promise.all(ids.map(id => chatService.deleteSession(id).catch(err => {
          // Log individual errors but continue with others
          console.warn(`Failed to delete session ${id}:`, err);
          return null;
        })));
        
        // Refresh sessions list
        if (token) {
          await backendLoadSessions();
        } else {
          // If no token, manually update the chats list
          setChats((prev) => prev.filter((c) => !ids.includes(c.id)));
        }
        
        // If all sessions are deleted or active session was deleted, create a new chat
        const remainingChats = chats.filter((c) => !ids.includes(c.id));
        if (remainingChats.length === 0 || wasActive) {
          createNewChat();
        }
      } catch (err: any) {
        // Handle errors gracefully
        if (isAuthDisabled && err.message?.includes('Session not found')) {
          console.log('Some sessions not found in backend (auth disabled) - removed from local UI');
          const remainingChats = chats.filter((c) => !ids.includes(c.id));
          if (remainingChats.length === 0 || wasActive) {
            createNewChat();
          }
        } else {
          // Revert on critical errors
          console.error('Failed to delete sessions:', err);
          setChats(originalChats);
          if (wasActive) {
            const firstDeleted = chats.find(c => ids.includes(c.id));
            if (firstDeleted) {
              setActiveChatId(firstDeleted.id);
              localStorage.setItem("hypeon_active_chat", firstDeleted.id);
            }
          }
          // Show error to user
          alert(err.message || 'Failed to delete chats. Please try again.');
        }
      } finally {
        setIsUpdating(false);
      }
    } else {
      // No token and auth not disabled - just update local state
      const remainingChats = chats.filter((c) => !ids.includes(c.id));
      if (remainingChats.length === 0 || wasActive) {
        createNewChat();
      }
    }
  }

  const InputBox = (
    <div className={styles.inputCard}>
      <div className={styles.inputRow}>
        <span className={styles.textareaIcon}>✨︎</span>

        <textarea
          ref={inputRef}
          className={styles.textarea}
          placeholder={!hasChat ? animatedPlaceholder : ""}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setIsTypingActive(false);
          }}
          onFocus={() => setIsTypingActive(false)}
          onBlur={() => input.length === 0 && setIsTypingActive(true)}
          onKeyDown={onKeyDown}
          rows={2}
        />

        <div className={styles.BottomBar}>
<div className={styles.ModelRow}>
  {/* BASIC */}
  <button
    className={`${styles.ModelBox} ${
      model === "basic" ? styles.active : ""
    }`}
  onClick={() => setModel("basic")}
>
     Basic
  </button>

  {/* PRO */}
  <button
    className={`${styles.ModelBox} ${styles.locked}`}
  >
    <svg
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M7 10V7a5 5 0 0110 0v3"
    stroke="#000000"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
  <rect
    x="5"
    y="10"
    width="14"
    height="10"
    rx="2"
    stroke="#000000"
    strokeWidth={2}
  />
</svg>
  Pro
  </button>
</div>

  <button
    className={styles.SendBtn}
    onClick={() => sendMessage(input)}
  >
    ↑
  </button>
</div>

      </div>
    </div>
    
  );

  return (
     <><ThemeToggle /> 
    <div className={styles.chatRoot}>
      <ChatSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onOpenSearch={() => setSearchOpen(true)}
        chats={chats.map((c) => ({ id: c.id, title: c.title }))}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
      />

      <main className={`${styles.main} ${mounted ? styles.mounted : ""}`}>
        <section className={styles.center}>
          <div className={styles.contentWrapper}>
            {!hasChat && (
              <div className={styles.heroBlock}>
                <div
                  className={`${styles.heroLogo} ${
                    mounted ? styles.heroLogoMounted : ""
                  }`}
                >
                  <Image
                    src="/images/hypeon.png"
                    alt="HypeOn logo"
                    width={78}
                    height={78}
                    className={styles.heroLogoImg}
                    priority
                  />

                </div>

                <h1 className={styles.heading}>
                  What would you like to analyze?
                </h1>
                <p className={styles.subHeading}>
                  Explore products, trends, keywords, and market momentum.
                </p>

                {InputBox}
                
                <div className={styles.exampleSection}>
  <div className={styles.exampleTitle}>
    GET STARTED WITH AN EXAMPLE BELOW
  </div>

 <div className={styles.exampleGrid}>

  {/* Product Trends */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Analyze trending home decor products in the US market");
      inputRef.current?.focus();
    }}
  >
    <span className={styles.topNotch}>
      <span className={`${styles.notchIcon} ${styles.green}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 15l3-3 3 3 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </span>

    <span className={styles.exampleText}>Product trends</span>
    <span className={styles.examplePreview}>See which products are trending right now.</span>
  </button>

  {/* Keyword Insights */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Find high-intent keywords customers use to buy products");
      inputRef.current?.focus();
    }}
  >
    <span className={styles.topNotch}>
      <span className={`${styles.notchIcon} ${styles.blue}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
    </span>

    <span className={styles.exampleText}>Keyword insights</span>
    <span className={styles.examplePreview}>See what customers are searching for before they buy.</span>
  </button>

  {/* Competitor Analysis */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Compare top competitors in an e-commerce category");
      inputRef.current?.focus();
    }}
  >
    <span className={styles.topNotch}>
      <span className={`${styles.notchIcon} ${styles.orange}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 8h10l-2-2M17 16H7l2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>

    <span className={styles.exampleText}>Competitor analysis</span>
    <span className={styles.examplePreview}>See what your competitors sell and how they price it.</span>
  </button>

  {/* Market Summary */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Summarize key insights from current e-commerce market data");
      inputRef.current?.focus();
    }}
  >
    <span className={styles.topNotch}>
      <span className={`${styles.notchIcon} ${styles.purple}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 14v2M12 10v6M16 12v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
    </span>

    <span className={styles.exampleText}>Market summary</span>
    <span className={styles.examplePreview}>See what’s happening in the market at a glance.</span>
  </button>

</div>


</div>
              </div>
            )}

            {hasChat && (
              <div className={styles.chatArea}>
                {messages.map((msg, i) => {
                  if (msg.role === "user") {
                    return (
                      <div key={i} className={styles.userMsg}>
                        {msg.text}
                      </div>
                    );
                  }

                  // Check if we have a ChatResponse with new format (tables/explanation)
                  // Try to match by answer content
                  let chatResponse = msg.chatResponse;
                  if (!chatResponse && backendSessionId) {
                    // Find matching response by checking answer content
                    for (const [key, resp] of chatResponses.entries()) {
                      if (resp.answer === msg.summary || 
                          msg.summary.includes(resp.answer.substring(0, 50))) {
                        chatResponse = resp;
                        break;
                      }
                    }
                  }
                  
                  // Check if this is a streaming message (waiting for complete response)
                  const isStreaming = (msg as any).isStreaming === true;
                  
                  // Show loading indicator while streaming (waiting for complete response)
                  if (isStreaming) {
                    return (
                      <div key={i} className={styles.assistantMessage}>
                        <div className={styles.answerContent}>
                          <div className={styles.waitingMessage}>Generating response...</div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Use new ChatMessage component if we have new format data
                  if (chatResponse && (chatResponse.tables || chatResponse.explanation || chatResponse.answer)) {
                    // Show with animation for new messages
                    const shouldAnimate = msg.isNew === true && i >= initialMessageCount;
                    return (
                      <ChatMessage
                        key={i}
                        response={chatResponse}
                        isUser={false}
                        animate={shouldAnimate} // Animate new messages
                        animationSpeed={10}
                      />
                    );
                  }
                  
                  // Handle streaming messages without chatResponse (plain text streaming)
                  if (isStreaming) {
                    return (
                      <div key={i} className={styles.assistantMessage}>
                        <div className={styles.answerContent}>
                          <ReactMarkdown>{msg.summary || ''}</ReactMarkdown>
                          <span className={styles.streamingCursor}>▊</span>
                        </div>
                      </div>
                    );
                  }

                  // Fallback to old format rendering
                  return (
                    <div key={i}>
                      <div className={styles.plainText}>
                        {msg.isNew && !typingDone[i] ? (
                          <TypingSummary
                            text={msg.summary}
                            onDone={() =>
                              setTypingDone((p) => ({ ...p, [i]: true }))
                            }
                          />
                        ) : (
                          msg.summary
                            .split("\n")
                            .map((l, j) => <p key={j}>{l}</p>)
                        )}
                      </div>

                      {(!msg.isNew || typingDone[i]) && msg.table.columns.length > 0 && (
                        <div className={styles.dataCard}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                {msg.table.columns.map((c) => (
                                  <th key={c}>{c}</th>
                                ))}
                              </tr>
                            </thead>

                           <tbody>
  {msg.isNew && !tableDone[i] ? (
    <StreamingTable
      key={`stream-${i}`}
      rows={Array.isArray(msg.table.rows) ? msg.table.rows : []}
      delay={140}
      onDone={() => {
        setTableDone((p) => ({ ...p, [i]: true }));
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === i && m.role === "assistant"
              ? { ...m, isNew: false }
              : m
          )
        );
      }}
    />
  ) : (
    Array.isArray(msg.table.rows) &&
    msg.table.rows.map((row, ri) => {
      const safeRow =
        Array.isArray(row)
          ? row
          : row && typeof row === "object"
          ? Object.values(row)
          : [];

      return (
        <tr key={ri}>
          {safeRow.map((cell, ci) => {
            const cellValue = String(cell ?? "").trim();
            
            // Empty cell
            if (!cellValue) {
              return (
                <td key={ci}>
                  <span style={{ color: '#999' }}>—</span>
                </td>
              );
            }
            
            // Check if value is an image URL
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(cellValue) || 
                          cellValue.startsWith('data:image/');
            
            // Check if it's a regular URL (not an image)
            const isUrl = (cellValue.startsWith('http://') || cellValue.startsWith('https://')) && !isImage;
            
            return (
              <td key={ci}>
                {isImage ? (
                  <img 
                    src={cellValue} 
                    alt="Table image" 
                    style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
                    onError={(e) => {
                      // Fallback to text if image fails to load
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = document.createElement('span');
                      fallback.textContent = cellValue;
                      fallback.style.color = '#666';
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : isUrl ? (
                  <a href={cellValue} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline' }}>{cellValue}</a>
                ) : (
                  cellValue
                )}
              </td>
            );
          })}
        </tr>
      );
    })
  )}
</tbody>

                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {backendLoading && (
                  <>
                    {researchPlan && (
                      <ResearchPlanIndicator plan={researchPlan} />
                    )}
                    {backendProgress ? (
                      <ProgressContainer
                        key={`progress-${backendProgress.stage}-${backendProgressUpdateCounter}-${backendProgress.progress}-${(backendProgress.message || '').substring(0, 50)}`}
                        progress={backendProgress}
                        stagesArray={backendStagesArray}
                        loading={backendLoading}
                      />
                    ) : (
                      <div className={styles.loading}>Analyzing…</div>
                    )}
                  </>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </section>

        {hasChat && (
          <div className={styles.inputBottomWrapper}>{InputBox}</div>
        )}
      </main>

      {searchOpen && (
        <SearchChatsModal
          onClose={() => setSearchOpen(false)}
          chats={chats.map((c) => ({ id: c.id, title: c.title }))}
          onSelectChat={selectChat}
          onNewChat={createNewChat}
          onDeleteChats={deleteChats}
        />
      )}
    </div>
      </>
  );
}
