"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SearchChatsModal from "@/components/chatbot/SearchChatsModal";
import { useHypeonChat } from "@/hooks/useHypeonChat";
import { getToken, listenForTokenUpdates, requestTokenFromParent, getTokenInfo } from "@/lib/auth";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
import { ExportableMarkdownTable } from "@/components/chatbot/ExportableMarkdownTable";
import { ProgressContainer } from "@/components/chatbot/ProgressContainer";
import { ResearchPlanIndicator } from "@/components/chatbot/ResearchPlanIndicator";
import { DataTable } from "@/components/chatbot/DataTable";
import { ChatResponse, TableData } from "@/lib/chatService";
import styles from "../../styles/chat.module.css";

const ChatSidebar = dynamic(
  () => import("@/components/chatbot/ChatSidebar"),
  { ssr: false }
);

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      messageId?: string;
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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ table: ExportableMarkdownTable }}
    >
      {displayed}
    </ReactMarkdown>
  );
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
const [hasResponseStarted, setHasResponseStarted] = useState(false);
const [animateNewResponse, setAnimateNewResponse] = useState(false);

  // Get token from parent app (app.hypeon.ai) cookie or local storage
  const token = getToken() || process.env.NEXT_PUBLIC_JWT_TOKEN || null;
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

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
// 🔹 ChatGPT-style sidebar offset sync
useEffect(() => {
  document.documentElement.style.setProperty(
    "--sidebar-offset",
    isMobile ? "0px" : collapsed ? "50px" : "240px"
  );
}, [collapsed, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const update = () => {
      const mobile = mediaQuery.matches;
      setIsMobile(mobile);
      if (mobile) {
        setMobileSidebarOpen(false);
      }
    };

    update();

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    // Fallback for older browsers
    // @ts-expect-error - legacy API
    mediaQuery.addListener(update);
    // @ts-expect-error - legacy API
    return () => mediaQuery.removeListener(update);
  }, []);

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
        // Treat a fresh token as a "new login" -> start a fresh chat after reload
        try {
          localStorage.setItem("hypeon_active_chat", "new");
          localStorage.setItem("hypeon_force_new_chat", "1");
        } catch {}
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
    sendMessageStreamFast: backendSendMessageStreamFast,
    cancelRequest: backendCancelRequest,
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
  const responseStartTimeRef = useRef<number>(0);

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    // In a fresh tab/session, start with a fresh chat (don’t auto-open last chat).
    try {
      if (window.sessionStorage.getItem("hypeon_chat_session_boot") !== "1") {
        return null;
      }
    } catch {}
    const saved = localStorage.getItem("hypeon_active_chat");
    if (!saved || saved === "new") return null;
    return saved;
  });
  const [model, setModel] = useState<"basic" | "pro">("basic");

  
  // Convert backend messages to UI format
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingDone, setTypingDone] = useState<Record<number, boolean>>({});
  const [tableDone, setTableDone] = useState<Record<number, boolean>>({});
  
  // Track initial message count when session is loaded (to distinguish loaded vs new messages)
  const [initialMessageCount, setInitialMessageCount] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Rate limit error handling
  const [rateLimitError, setRateLimitError] = useState<{
    message: string;
    retryAfter: number; // seconds until retry is allowed
    lastMessage: string; // the message that was rate limited
  } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantRef = useRef<HTMLDivElement | null>(null);
  const prevBackendLoadingRef = useRef(false);
  const hasChat = activeChatId !== null || messages.length > 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setMounted(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Countdown timer for rate limit retry
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && rateLimitError) {
      // Countdown finished, user can retry
    }
  }, [retryCountdown, rateLimitError]);

  // Sync backend sessions with local chats (but don't overwrite if we're in the middle of an operation)
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    // Don't update chats if we're currently updating (deleting/renaming)
    // But allow updates during loading to show sessions as they load
    if (!isUpdating) {
      if (backendSessions.length > 0) {
        const convertedChats: ChatSession[] = backendSessions.map((s) => ({
          id: s.session_id,
          title: s.title || 'Untitled Chat',
          messages: [],
          updatedAt: new Date(s.last_active_at).getTime(),
        }));
        
        // Merge with existing chats instead of replacing, to preserve any local state
        setChats((prev) => {
          const existingIds = new Set(prev.map(c => c.id));
          const newChats = convertedChats.filter(c => !existingIds.has(c.id));
          // Update existing chats with backend data, add new ones
          const updated = prev.map(chat => {
            const backendChat = convertedChats.find(c => c.id === chat.id);
            return backendChat || chat;
          });
return [...updated, ...newChats].sort(
  (a, b) => b.updatedAt - a.updatedAt
);

        });
      } else if (!backendLoading) {
        // Only handle empty sessions when not loading
        // No sessions exist - only create a new chat if:
        // 1. We don't have an active session ID (no session was just created)
        // 2. We don't have any messages (not in the middle of a conversation)
        // 3. We don't have a backend session ID (session wasn't just created)
        if (!activeChatId && 
            !backendSessionId && 
            messages.length === 0) {
          createNewChat();
        }
      }
    }
  }, [backendSessions, isUpdating, activeChatId, backendSessionId, messages.length, backendLoading]);

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
  const prevBackendSessionIdRef = useRef<string | null>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  const lastAssistantIndex = (() => {
    for (let j = messages.length - 1; j >= 0; j--) {
      if (messages[j]?.role === "assistant") return j;
    }
    return -1;
  })();

  // Convert backend messages to UI format
  useEffect(() => {
    const normalizeBackendMessages = (items: typeof backendMessages) => {
      const result: typeof backendMessages = [];
      const seenMessageIds = new Set<string>();

      for (const msg of items) {
        const messageId = (msg as any)?.message_id as string | undefined;
        if (messageId) {
          if (seenMessageIds.has(messageId)) continue;
          seenMessageIds.add(messageId);
        }

        const prev = result[result.length - 1];
        const sameSession =
          !!prev &&
          (prev as any)?.session_id &&
          (prev as any)?.session_id === (msg as any)?.session_id;

        // Collapse exact consecutive duplicates (can happen with some backend save/stream strategies)
        if (prev && prev.role === msg.role && sameSession && prev.content === msg.content) {
          continue;
        }

        // Collapse progressive assistant snapshots (keep the newest/longest one)
        if (prev && prev.role === "assistant" && msg.role === "assistant" && sameSession) {
          const prevContent = String(prev.content ?? "");
          const nextContent = String(msg.content ?? "");
          const prevHasTables = Array.isArray((prev as any).tables) && (prev as any).tables.length > 0;
          const nextHasTables = Array.isArray((msg as any).tables) && (msg as any).tables.length > 0;

          if (
            nextContent.length >= prevContent.length &&
            nextContent.startsWith(prevContent) &&
            (nextHasTables || !prevHasTables)
          ) {
            result[result.length - 1] = msg;
            continue;
          }
        }

        result.push(msg);
      }

      return result;
    };

    const normalizedBackendMessages = normalizeBackendMessages(backendMessages);
    const currentSessionId = backendSessionId || null;

    // If we started loading a specific session, consider the load "complete" as soon as
    // the hook reports that same sessionId (even if it has 0 messages).
    if (
      isLoadingSession &&
      pendingSessionId &&
      (currentSessionId === pendingSessionId || activeChatId === pendingSessionId)
    ) {
      setInitialMessageCount(normalizedBackendMessages.length);
      setIsLoadingSession(false);
      setPendingSessionId(null);
      setNewMessageIds(new Set());
      prevBackendMessagesRef.current = normalizedBackendMessages;
      prevBackendSessionIdRef.current = currentSessionId;
    }

    // Always convert messages, even if empty (to clear previous messages)
    // If we're loading a session, set initial count immediately to prevent animation
    if (isLoadingSession && normalizedBackendMessages.length > 0) {
      setInitialMessageCount(normalizedBackendMessages.length);
      setIsLoadingSession(false);
      setPendingSessionId(null);
      // Clear any new message IDs since these are loaded messages
      setNewMessageIds(new Set());
      prevBackendMessagesRef.current = normalizedBackendMessages;
      prevBackendSessionIdRef.current = backendSessionId || null;
      // Continue to convert messages below - don't return early
    }
    const sessionChanged =
      prevBackendSessionIdRef.current !== null &&
      currentSessionId !== null &&
      prevBackendSessionIdRef.current !== currentSessionId;
    
    // Detect new messages by comparing with previous state
    const prevIds = new Set(prevBackendMessagesRef.current.map(m => m.message_id));
    const currentIds = new Set(normalizedBackendMessages.map(m => m.message_id));
    const newlyAddedIds = new Set(
      Array.from(currentIds).filter(id => !prevIds.has(id))
    );
    
    // Update new message IDs (only keep them for a short time to trigger animation)
    // Only track new messages if we're not loading a session AND not switching sessions
    const effectiveNewMessageIds =
      !isLoadingSession && !sessionChanged ? newlyAddedIds : new Set<string>();

    if (effectiveNewMessageIds.size > 0) {
      setNewMessageIds(effectiveNewMessageIds);
      // Clear after animation would complete (estimate: 5 seconds max)
      setTimeout(() => {
        setNewMessageIds(prev => {
          const updated = new Set(prev);
          effectiveNewMessageIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 5000);
    } else if (sessionChanged) {
      // Session switched: treat everything as loaded history (no animations)
      setNewMessageIds(new Set());
      setInitialMessageCount(normalizedBackendMessages.length);
    }
    
    // Update ref for next comparison
    prevBackendMessagesRef.current = normalizedBackendMessages;
    prevBackendSessionIdRef.current = currentSessionId;
    
    // Helper function to extract clean text from content
    const extractCleanContent = (content: any): string => {
      // If content is not a string, try to stringify it first
      if (typeof content !== 'string') {
        try {
          content = JSON.stringify(content);
        } catch (e) {
          return String(content);
        }
      }
      
      // Check if content contains raw response structures (like ResponseFunctionWebSearch)
      // These patterns indicate the backend sent raw structure instead of formatted text
      if (content.includes('ResponseFunction') || 
          content.includes('ResponseOutputMessage') || 
          content.includes('AnnotationURLCitation')) {
        
        // Try to extract the actual text from the structure
        // Look for text fields in the response structure
        const textMatch = content.match(/text['"]?\s*[:=]\s*['"]([^'"]+)['"]/i) ||
                         content.match(/content['"]?\s*[:=]\s*['"]([^'"]+)['"]/i) ||
                         content.match(/answer['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
        
        if (textMatch && textMatch[1]) {
          return textMatch[1];
        }
        
        // If no text found, try to parse as JSON and extract answer/text
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.text || parsed.content || parsed.answer || content;
          }
        } catch (e) {
          // If parsing fails, return a fallback message
          console.warn('Failed to parse response structure, using fallback');
          return 'Response received, but formatting issue detected. Please try again.';
        }
      }
      
      return content;
    };

    const newResponses = new Map<string, ChatResponse>();

    const convertedMessages: Message[] = normalizedBackendMessages.map((msg, index) => {
      const generatedId = msg.message_id || `${msg.session_id || 's'}-${index}`;
      if (msg.role === 'user') {
        return { role: 'user', messageId: generatedId, text: msg.content };
      } else {
        // Extract clean content from message
        const cleanContent = extractCleanContent(msg.content);
        
        // Check if message has tables directly (from streaming response)
        if (msg.tables && msg.tables.length > 0) {
          const firstTable = msg.tables[0];
          const tableColumns = firstTable?.headers || 
                              firstTable?.columns?.map((c: any) => c.name || c) || 
                              [];
          const tableRows = firstTable?.rows || [];
          const chatResp: ChatResponse = {
            session_id: msg.session_id,
            answer: cleanContent,
            tables: msg.tables,
            insights: msg.insights,
            artifacts: msg.artifacts,
            explanation: msg.explanation,
            metadata: (msg as any).metadata,
            sectionTitles: (msg as any).metadata?.sectionTitles,
          };

          newResponses.set(generatedId, chatResp);

          return {
            role: 'assistant',
            messageId: generatedId,
            summary: cleanContent,
            table: {
              type: 'product_table' as const,
              columns: tableColumns,
              rows: tableRows,
            },
            // Only mark as new if it's not part of initial load
            isNew: animateNewResponse && effectiveNewMessageIds.has(msg.message_id),
            chatResponse: chatResp,
          };
        }

        // Fallback: Try to parse assistant message for structured data (legacy support)
        let parsedData: any = null;
        try {
          // Check if message contains JSON
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
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
            messageId: generatedId,
            summary: parsedData.summary,
            table: parsedData.table,
            // Only mark as new if it's not part of initial load
            isNew: effectiveNewMessageIds.has(msg.message_id) && (index >= initialMessageCount),
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
          const chatResp: ChatResponse = parsedData;
          newResponses.set(generatedId, chatResp);

          return {
            role: 'assistant',
            messageId: generatedId,
            summary: parsedData.answer,
            table: {
              type: 'product_table' as const,
              columns: tableColumns,
              rows: tableRows,
            },
            // Only mark as new if it's not part of initial load
            isNew: effectiveNewMessageIds.has(msg.message_id) && (index >= initialMessageCount),
            chatResponse: chatResp,
          };
        }
        else {
          // Plain text response - create a simple summary and empty table
          // Only mark as new if it's not part of initial load
          const isNewMessage = effectiveNewMessageIds.has(msg.message_id) && (index >= initialMessageCount);
          return {
            role: 'assistant',
            messageId: generatedId,
            summary: cleanContent,
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
    // Save new chat responses for lookup in rendering
    if (newResponses.size > 0) {
      setChatResponses((prev) => {
        const merged = new Map(prev);
        for (const [k, v] of newResponses.entries()) merged.set(k, v);
        return merged;
      });
    }
    //  HANDLE canceled streams (user message only)
if (
  !isLoadingSession &&
  convertedMessages.length === 0 &&
  normalizedBackendMessages.length > 0
) {
  setMessages(
    normalizedBackendMessages.map(msg =>
      msg.role === "user"
        ? { role: "user", text: msg.content }
        : {
            role: "assistant",
            summary: String(msg.content ?? ""),
            table: { type: "product_table", columns: [], rows: [] },
            isNew: false,
          }
    )
  );
  return;
}

    setMessages(convertedMessages);
  }, [backendMessages, backendSessionId, isLoadingSession, pendingSessionId, activeChatId, initialMessageCount]);

  // Sync loading state
  useEffect(() => {
    setLoading(backendLoading);
  }, [backendLoading]);
//  Turn off animation after response finishes
useEffect(() => {
  if (!backendLoading && animateNewResponse) {
    setAnimateNewResponse(false);
  }
}, [backendLoading, animateNewResponse]);

  const PLACEHOLDER_TEXT = "Describe what you want to analyze…";
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isTypingActive, setIsTypingActive] = useState(true);

  // Load sessions from backend on mount
  useEffect(() => {
    if (token) {
      // New browser tab/session: always start fresh (don’t auto-open saved chat).
      // User can still pick history from the sidebar.
      try {
        if (window.sessionStorage.getItem("hypeon_chat_session_boot") !== "1") {
          window.sessionStorage.setItem("hypeon_chat_session_boot", "1");
          localStorage.setItem("hypeon_active_chat", "new");

          setActiveChatId(null);
          setPendingSessionId(null);
          setMessages([]);
          setTypingDone({});
          setTableDone({});
          setIsLoadingSession(false);
          setInitialMessageCount(0);

          return;
        }
      } catch {
        // If sessionStorage is unavailable, keep existing behavior.
      }

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
      
      // If we just received a fresh token (new login), start a fresh chat and don't auto-open history.
      const forceNewChat = (() => {
        try {
          return localStorage.getItem("hypeon_force_new_chat") === "1";
        } catch {
          return false;
        }
      })();
      if (forceNewChat) {
        try {
          localStorage.removeItem("hypeon_force_new_chat");
        } catch {}
        createNewChat();
        return;
      }

      const savedActive = localStorage.getItem("hypeon_active_chat");
      if (savedActive && savedActive !== "new") {
        // Treat initial session load as history (no typing re-animation)
        setIsLoadingSession(true);
        setPendingSessionId(savedActive);
        setActiveChatId(savedActive);
        setTypingDone({});
        setTableDone({});
        setMessages([]);
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
            setIsLoadingSession(false);
            setPendingSessionId(null);
            createNewChat();
            return;
          }
          
          if (!err.message?.includes('Authentication required') && !isConnectionError) {
            console.error('Failed to load session:', err);
          }
          // If loading fails and no active chat, create a new one
          if (!activeChatId && messages.length === 0) {
            setIsLoadingSession(false);
            setPendingSessionId(null);
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

  // Flag to use fast streaming (production recommended per FRONTEND_INTEGRATION.md)
  const useFastStreaming = process.env.NEXT_PUBLIC_USE_FAST_STREAMING !== 'false';

  const formatTimestampForFilename = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  };

  const sanitizeForFilename = (name: string) =>
    name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);

  const sanitizeSheetName = (name: string) =>
    name
      .trim()
      .replace(/[\[\]:*?/\\]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 31) || "Sheet1";

  const coerceCellForExport = (value: any) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number" || typeof value === "boolean") return value;
    const asNumber = Number(String(value).replace(/[, ]+/g, "").replace(/^\$/, ""));
    if (Number.isFinite(asNumber) && String(value).trim() !== "") return asNumber;
    return String(value);
  };

  const exportLegacyTableToExcel = async (
    columns: string[],
    rows: any[],
    title: string
  ) => {
    const XLSX = await import("xlsx");

    const safeRows = Array.isArray(rows)
      ? rows.map((row) =>
          Array.isArray(row)
            ? row
            : row && typeof row === "object"
            ? Object.values(row)
            : []
        )
      : [];

    const aoa: any[][] = [
      Array.isArray(columns) ? columns : [],
      ...safeRows.map((row) => row.map((cell) => coerceCellForExport(cell))),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();

    const sheetName = sanitizeSheetName(title || "Table");
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const base = sanitizeForFilename(title || "table") || "table";
    const filename = `${base}_${formatTimestampForFilename(new Date())}.xlsx`;
    XLSX.writeFile(workbook, filename, { compression: true });
  };

  async function sendMessage(text: string) {
    if (!text.trim() || backendLoading) return;
setHasResponseStarted(false);
setAnimateNewResponse(true);
  responseStartTimeRef.current = Date.now();
  const currentActiveChatId = activeChatId;
    
    // Clear input immediately for better UX
    setInput("");

    try {
      // Use fast streaming API (production recommended) or standard streaming
      if (useFastStreaming) {
        await backendSendMessageStreamFast(
  text,
  () => {
  const MIN_VISIBLE_MS = 400;
  

const elapsed = Date.now() - responseStartTimeRef.current;
  const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

  setTimeout(() => {
    setHasResponseStarted(true);
  }, remaining);
}

);

      } else {
        // Fallback to standard streaming
        await backendSendMessageStream(
          text,
          // onChunk - response text is accumulated by the hook
          (chunk: string) => {
            // Chunks are handled internally by the hook
          },
          // onProgress - progress is handled by the hook, updates backendProgress state
          undefined
        );
      }

      // Streaming complete - response is handled by the hook (adds to backendMessages)
      // Ensure activeChatId is set if we have a session ID
      if (backendSessionId) {
        // Always update activeChatId to ensure it's synced
        if (!currentActiveChatId || currentActiveChatId !== backendSessionId) {
          setActiveChatId(backendSessionId);
          localStorage.setItem("hypeon_active_chat", backendSessionId);
        }
        
        // Update chat title if new session - add to chats list
        if (!currentActiveChatId) {
          const newChat: ChatSession = {
            id: backendSessionId,
            title: text.slice(0, 50),
            messages: [],
            updatedAt: Date.now(),
          };
          setChats((prev) => {
            // Don't add if it already exists
            if (prev.find(c => c.id === backendSessionId)) {
              return prev;
            }
            return [newChat, ...prev];
          });
        }
      }

      // Refresh sessions to get updated list
      // Add a small delay to ensure backend has saved the session
      if (token) {
        setTimeout(async () => {
          await backendLoadSessions();
        }, 500);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      
      // Check for rate limit error
      const isRateLimitError = 
        err.message?.toLowerCase().includes('rate limit') ||
        err.message?.includes('429') ||
        err.message?.includes('too many requests') ||
        err.code === 'RATE_LIMIT';
      
      if (isRateLimitError) {
        // Extract retry time from error message if available, default to 30 seconds
        const retryMatch = err.message?.match(/(\d+)\s*seconds?/i);
        const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 30;
        
        setRateLimitError({
          message: 'You\'re sending messages too quickly. Please wait a moment.',
          retryAfter,
          lastMessage: text,
        });
        setRetryCountdown(retryAfter);
        return;
      }
      
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

  // Retry function for rate-limited messages
  async function retryRateLimitedMessage() {
    if (rateLimitError && retryCountdown === 0) {
      const messageToRetry = rateLimitError.lastMessage;
      setRateLimitError(null);
      setRetryCountdown(0);
      await sendMessage(messageToRetry);
    }
  }

  // Dismiss rate limit error
  function dismissRateLimitError() {
    setRateLimitError(null);
    setRetryCountdown(0);
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
        messageId: crypto.randomUUID?.() ?? `local-${Date.now()}`,
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
    const wasLoading = prevBackendLoadingRef.current;
    const isLoadingNow = backendLoading;
    prevBackendLoadingRef.current = isLoadingNow;

    // While generating/streaming, keep the bottom in view (chat-like behavior)
    if (isLoadingNow) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    // When a response finishes, land at the top of the report (last assistant message)
    if (wasLoading && !isLoadingNow) {
      lastAssistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [backendLoading, messages.length]);
//  Show progress only before first token
const showProgress = backendLoading && !hasResponseStarted;

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function createNewChat() {
    backendNewChat();
    setActiveChatId(null);
    setPendingSessionId(null);
    setMessages([]);
    setInitialMessageCount(0); // Reset initial count for new chat
    setTypingDone({});
    setTableDone({});
    setIsLoadingSession(false);
    
    localStorage.setItem("hypeon_active_chat", "new");
  }

  async function selectChat(id: string) {
    // Always load from backend if we have a token, even if it's the current session
    // This ensures messages are properly loaded and displayed
    setIsLoadingSession(true);
    setPendingSessionId(id);
    setActiveChatId(id);
    setTypingDone({});
    setTableDone({});
    localStorage.setItem("hypeon_active_chat", id);
    setAnimateNewResponse(false);

    setHasResponseStarted(false);

setNewMessageIds(new Set());

    // Clear messages immediately to show loading state
    setMessages([]);
    
    if (token) {
      // Load from backend - always reload to ensure messages are fresh
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('Loading session:', id);
        }
        await backendLoadSession(id);
        // Messages will be loaded by the hook and converted by the backendMessages effect.
        // Do NOT fall back to local storage here, or it can overwrite the backend session.
        return;
      } catch (err: any) {
        setIsLoadingSession(false);
        setPendingSessionId(null);
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load session:', err);
        }
        // Handle session not found - create new chat
        const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                               process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
        
        if (err.message?.includes('Session not found') || 
            (err.message?.includes('permission') && isAuthDisabled)) {
          console.warn('Session not found - creating new chat');
          setIsLoadingSession(false);
          setPendingSessionId(null);
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
      const loadedMessages = chat.messages.map((m) =>
        m.role === "assistant" ? { ...m, isNew: false } : m
      );
      setMessages(loadedMessages);
      setInitialMessageCount(loadedMessages.length); // Track initial count
      setIsLoadingSession(false);
      setPendingSessionId(null);
    } else {
      // Session doesn't exist in local storage either - create new chat
      console.warn('Session not found in local storage - creating new chat');
      setIsLoadingSession(false);
      setPendingSessionId(null);
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
            // Auto-grow textarea like ChatGPT
            const el = e.currentTarget;
            el.style.height = "auto";
            const nextHeight = Math.min(el.scrollHeight, 180);
            el.style.height = `${nextHeight}px`;
            el.style.overflowY = el.scrollHeight > 180 ? "auto" : "hidden";
          }}
          onFocus={() => setIsTypingActive(false)}
          onBlur={() => input.length === 0 && setIsTypingActive(true)}
          onKeyDown={onKeyDown}
          rows={2}
        />

        <div className={styles.BottomBar}>
<div className={styles.ModelRow}>
  <div className={styles.modelSwitch}>
    <span className={styles.modelLabel}>Model</span>

    <div
      className={styles.modelSegment}
      role="tablist"
      aria-label="Model"
    >
      <button
        type="button"
        className={`${styles.modelTab} ${
          model === "basic" ? styles.modelTabActive : ""
        }`}
        role="tab"
        aria-selected={model === "basic"}
        onClick={() => setModel("basic")}
      >
        Basic
      </button>

      <button
        type="button"
        className={`${styles.modelTab} ${styles.modelTabLocked}`}
        role="tab"
        aria-selected={false}
        aria-disabled="true"
        title="Pro coming soon"
        onClick={(e) => e.preventDefault()}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M7 10V7a5 5 0 0110 0v3"
            stroke="currentColor"
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
            stroke="currentColor"
            strokeWidth={2}
          />
        </svg>
        Pro
      </button>
    </div>
  </div>
</div>

  {backendLoading ? (
   <button
  className={`${styles.SendBtn} ${styles.cancelBtn}`}
  onClick={() => {
    // 1️⃣ Stop backend stream
    backendCancelRequest();

    // 2️⃣ IMMEDIATELY seal the conversation with an assistant message
    setMessages(prev => {
      if (prev.length === 0) return prev;

      const last = prev[prev.length - 1];
      if (last.role === "user") {
        return [
          ...prev,
          {
            role: "assistant",
            summary: "⏹️ Request stopped by user.",
            table: {
              type: "product_table",
              columns: [],
              rows: [],
            },
              messageId: crypto.randomUUID?.() ?? `stopped-${Date.now()}`,
              isNew: false,
          },
        ];
      }
      return prev;
    });

    //  Reset UI flags
    setHasResponseStarted(false);
    setAnimateNewResponse(false);
    setIsLoadingSession(false);
    setPendingSessionId(null);
    setTypingDone({});
    setTableDone({});
    setNewMessageIds(new Set());

    //  Sync backend AFTER UI is stable
    setTimeout(() => {
      backendLoadSessions();
    }, 0);
  }}
  title="Cancel request"
>
  <span className={styles.stopSquare} />
</button>


  ) : (
    <button
      className={styles.SendBtn}
      onClick={() => sendMessage(input)}
      disabled={!input.trim()}
    >
      ↑
    </button>
  )}
</div>

      </div>
    </div>
    
  );

  // Keep textarea height in sync when input is set programmatically (examples / restore)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 180 ? "auto" : "hidden";
  }, [input]);

  return (
    <div className={styles.chatRoot}>
      <ChatSidebar
        collapsed={isMobile ? false : collapsed}
        isMobile={isMobile}
        mobileOpen={isMobile ? mobileSidebarOpen : true}
        onRequestClose={() => setMobileSidebarOpen(false)}
        onToggle={() => (isMobile ? setMobileSidebarOpen(false) : setCollapsed(!collapsed))}
        onOpenSearch={() => setSearchOpen(true)}
        chats={chats.map((c) => ({ id: c.id, title: c.title }))}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
      />

   <main
  className={`${styles.main} ${
    collapsed ? styles.mainCollapsed : styles.mainExpanded
  } ${mounted ? styles.mounted : ""}`}
>
  
<div className={styles.topBar}>
  {isMobile && (
    <button
      type="button"
      className={styles.mobileMenuBtn}
      onClick={() => setMobileSidebarOpen(true)}
      aria-label="Open sidebar"
    >
      ☰
    </button>
  )}
  
  <div className={styles.mainLogo}>
    <span className={styles.logoGradient}>HypeOn</span>
   
  </div>
</div>

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
                {!isMobile && (
                <div className={styles.exampleSection}>
  <div className={styles.exampleTitle}>
    GET STARTED WITH AN EXAMPLE BELOW
  </div>

 <div className={styles.exampleGrid}>
    <div className={styles.exampleTrack}>

  {/* Product Trends */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Analyze trending home decor products in the Uk market");
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


  {/* Market Summary */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Provide a market summary showing where demand is strongest and weakest globally for premium skincare.");
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
  <button
  className={styles.exampleCard}
  onClick={() => {
    setInput(
      "Analyze the average customer rating of Nike.com"
    );
    inputRef.current?.focus();
  }}
>
  <span className={styles.topNotch}>
    <span className={`${styles.notchIcon} ${styles.purple}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M7 15c1.5-1 3-1 4.5 0s3 1 4.5 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
      </svg>
    </span>
  </span>

  <span className={styles.exampleText}>Brand review analysis</span>
  <span className={styles.examplePreview}>
    Understand how customers feel about your brand across channels.
  </span>
</button>


 <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Analyze trending home decor products in the Uk market");
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


  {/* Market Summary */}
  <button
    className={styles.exampleCard}
    onClick={() => {
      setInput("Provide a market summary showing where demand is strongest and weakest globally for premium skincare.");
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

  <button
  className={styles.exampleCard}
  onClick={() => {
    setInput(
      "Analyze the average customer rating of Nike.com"
    );
    inputRef.current?.focus();
  }}
>
  <span className={styles.topNotch}>
    <span className={`${styles.notchIcon} ${styles.purple}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M7 15c1.5-1 3-1 4.5 0s3 1 4.5 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
      </svg>
    </span>
  </span>

  <span className={styles.exampleText}>Brand review analysis</span>
  <span className={styles.examplePreview}>
    Understand how customers feel about your brand across channels.
  </span>
</button>


</div>

</div>
</div>
)}
              </div>
            )}

            {hasChat && (
              <div className={styles.chatArea}>
                {messages.map((msg, i) => {
                  const isLastAssistant = msg.role === "assistant" && i === lastAssistantIndex;

                  if (msg.role === "user") {
                    return (
                      <div key={(msg as any).messageId ?? `user-${i}`} className={styles.userMsg}>
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
                  
                  // Use new ChatMessage component if we have new format data
                  if (chatResponse && (chatResponse.tables || chatResponse.explanation || chatResponse.answer)) {
                    // Show with animation for new messages
                    const shouldAnimate = msg.isNew === true && animateNewResponse;

                    return (
                      <div key={(msg as any).messageId ?? `msg-${i}`} ref={isLastAssistant ? lastAssistantRef : null}>
                        <ChatMessage
                          response={chatResponse}
                          isUser={false}
                          animate={shouldAnimate} // Animate new messages
                          animationSpeed={10}
                        />
                      </div>
                    );
                  }
                  
                  // Handle streaming messages without chatResponse (plain text streaming)
                  if (isStreaming) {
                    return (
                      <div
                        key={(msg as any).messageId ?? `msg-${i}`}
                        className={styles.assistantMessage}
                        ref={isLastAssistant ? lastAssistantRef : null}
                      >
                        <div className={styles.answerContent}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{ table: ExportableMarkdownTable }}
                          >
                            {msg.summary || ""}
                          </ReactMarkdown>
                          <span className={styles.streamingCursor}>▊</span>
                        </div>
                      </div>
                    );
                  }

                  // Fallback to old format rendering
                  return (
                    <div key={(msg as any).messageId ?? `msg-${i}`} ref={isLastAssistant ? lastAssistantRef : null}>
                      <div className={styles.answerContent}>
                        {msg.isNew && animateNewResponse && !typingDone[i] ? (

                          <TypingSummary
                            text={msg.summary}
                            onDone={() =>
                              setTypingDone((p) => ({ ...p, [i]: true }))
                            }
                          />
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{ table: ExportableMarkdownTable }}
                          >
                            {msg.summary}
                          </ReactMarkdown>
                        )}
                      </div>

                      {(!msg.isNew || typingDone[i]) && msg.table.columns.length > 0 && (
                        <div className={styles.dataCard}>
                          <div className={styles.tableHeader}>
                            <h4 className={styles.tableTitle}>Table</h4>
                            <div className={styles.tableActions}>
                              <button
                                type="button"
                                className={styles.exportBtn}
                                onClick={() =>
                                  exportLegacyTableToExcel(
                                    msg.table.columns,
                                    msg.table.rows,
                                    `Table_${i + 1}`
                                  )
                                }
                                aria-label="Download Excel"
                                title="Export to Excel"
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden="true"
                                  focusable="false"
                                >
                                  <path
                                    d="M12 3v10"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M8 11l4 4 4-4"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M4 17v3h16v-3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                {msg.table.columns.map((c) => (
                                  <th key={c}>{c}</th>
                                ))}
                              </tr>
                            </thead>

                           <tbody>
{msg.isNew && animateNewResponse && !tableDone[i] ? (

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
                
{showProgress && (
  <>
    {researchPlan && <ResearchPlanIndicator plan={researchPlan} />}
    <ProgressContainer
      progress={backendProgress}
      stagesArray={backendStagesArray}
      loading
    />
  </>
)}



                {/* Rate Limit Error Display */}
                {rateLimitError && (
                  <div className={styles.rateLimitError}>
                    <div className={styles.rateLimitIcon}>⏳</div>
                    <div className={styles.rateLimitContent}>
                      <p className={styles.rateLimitMessage}>{rateLimitError.message}</p>
                      {retryCountdown > 0 ? (
                        <p className={styles.rateLimitCountdown}>
                          You can retry in <strong>{retryCountdown}</strong> second{retryCountdown !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <p className={styles.rateLimitReady}>Ready to retry!</p>
                      )}
                    </div>
                    <div className={styles.rateLimitActions}>
                      <button
                        className={styles.retryButton}
                        onClick={retryRateLimitedMessage}
                        disabled={retryCountdown > 0}
                      >
                        {retryCountdown > 0 ? `Wait ${retryCountdown}s` : 'Retry'}
                      </button>
                      <button
                        className={styles.dismissButton}
                        onClick={dismissRateLimitError}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
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
  );
} 
