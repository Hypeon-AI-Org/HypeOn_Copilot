"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import SearchChatsModal from "@/components/chatbot/SearchChatsModal";
import { useHypeonChat } from "@/hooks/useHypeonChat";
import { getToken, listenForTokenUpdates, requestTokenFromParent } from "@/lib/auth";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
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
    sendMessage: backendSendMessage,
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
  const [model, setModel] = useState<"basic" | "pro" | null>(null);
  
  // Convert backend messages to UI format
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingDone, setTypingDone] = useState<Record<number, boolean>>({});
  const [tableDone, setTableDone] = useState<Record<number, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hasChat = messages.length > 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 60);
  }, []);

  // Sync backend sessions with local chats
  useEffect(() => {
    if (backendSessions.length > 0) {
      const convertedChats: ChatSession[] = backendSessions.map((s) => ({
        id: s.session_id,
        title: s.title || 'Untitled Chat',
        messages: [],
        updatedAt: new Date(s.last_active_at).getTime(),
      }));
      setChats(convertedChats);
    }
  }, [backendSessions]);

  // Sync backend session ID with local active chat
  useEffect(() => {
    if (backendSessionId) {
      setActiveChatId(backendSessionId);
      localStorage.setItem("hypeon_active_chat", backendSessionId);
    }
  }, [backendSessionId]);

  // Store ChatResponse data for assistant messages (keyed by session_id + message content hash)
  const [chatResponses, setChatResponses] = useState<Map<string, ChatResponse>>(new Map());

  // Convert backend messages to UI format
  useEffect(() => {
    const convertedMessages: Message[] = backendMessages.map((msg) => {
      if (msg.role === 'user') {
        return { role: 'user', text: msg.content };
      } else {
        // Try to parse assistant message for structured data
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

        if (parsedData && parsedData.summary && parsedData.table) {
          return {
            role: 'assistant',
            summary: parsedData.summary,
            table: parsedData.table,
            isNew: false,
          };
        } else {
          // Plain text response - create a simple summary and empty table
          return {
            role: 'assistant',
            summary: msg.content,
            table: {
              type: 'product_table' as const,
              columns: [],
              rows: [],
            },
            isNew: false,
          };
        }
      }
    });
    setMessages(convertedMessages);
  }, [backendMessages]);

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
      backendLoadSessions().catch((err) => {
        // Silently handle auth errors - user can still chat
        if (!err.message?.includes('Authentication required')) {
          console.error('Failed to load sessions:', err);
        }
      });
      
      const savedActive = localStorage.getItem("hypeon_active_chat");
      if (savedActive && savedActive !== "new") {
        backendLoadSession(savedActive).catch((err) => {
          // Silently handle auth errors - user can still chat
          if (!err.message?.includes('Authentication required')) {
            console.error('Failed to load session:', err);
          }
        });
      }
    } else {
      // Fallback to local storage if no token
      const savedChats = localStorage.getItem("hypeon_chats");
      if (savedChats) {
        try {
          const parsed: ChatSession[] = JSON.parse(savedChats);
          setChats(parsed);
        } catch (e) {
          console.error('Failed to parse saved chats:', e);
        }
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
    if (!text.trim() || loading) return;

    try {
      // Use backend API
      const response = await backendSendMessage(text);
      
      if (response) {
        // Store ChatResponse for rendering with new format
        // Use answer content as key to match with messages later
        if (response.tables || response.explanation) {
          setChatResponses((prev) => {
            const newMap = new Map(prev);
            // Use answer content as key (first 100 chars should be unique enough)
            const key = `${response.session_id}-${response.answer.substring(0, 100)}`;
            newMap.set(key, response);
            return newMap;
          });
        }

        // Update chat title if new session
        if (!activeChatId && response.session_id) {
          const newChat: ChatSession = {
            id: response.session_id,
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
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      // Fallback to local API if backend fails
      if (!token) {
        await sendMessageLocal(text);
      } else {
        alert(err.message || 'Failed to send message. Please try again.');
      }
    }

    setInput("");
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
    setTypingDone({});
    setTableDone({});
    localStorage.setItem("hypeon_active_chat", "new");
  }

  async function selectChat(id: string) {
    if (token) {
      // Load from backend
      try {
        await backendLoadSession(id);
        setActiveChatId(id);
        setTypingDone({});
        setTableDone({});
      } catch (err: any) {
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
      setMessages(
        chat.messages.map((m) =>
          m.role === "assistant" ? { ...m, isNew: false } : m
        )
      );
      setTypingDone({});
      setTableDone({});
      localStorage.setItem("hypeon_active_chat", id);
    }
  }

  async function renameChat(id: string, title: string) {
    // Update local state optimistically
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );

    // Update backend if we have a token
    if (token) {
      try {
        const { ChatService } = await import('@/lib/chatService');
        const chatService = new ChatService(apiUrl, token);
        await chatService.updateSessionTitle(id, title);
        // Refresh sessions to get updated data
        await backendLoadSessions();
      } catch (err: any) {
        // Revert on error
        console.error('Failed to update session title:', err);
        // Reload sessions to revert
        if (token) {
          await backendLoadSessions();
        }
      }
    }
  }

  async function deleteChat(id: string) {
    // Update local state optimistically
    setChats((prev) => prev.filter((c) => c.id !== id));

    if (id === activeChatId) {
      setActiveChatId(null);
      setMessages([]);
      setTypingDone({});
      setTableDone({});
      localStorage.setItem("hypeon_active_chat", "new");
    }

    // Delete from backend if we have a token
    if (token) {
      try {
        const { ChatService } = await import('@/lib/chatService');
        const chatService = new ChatService(apiUrl, token);
        await chatService.deleteSession(id);
        // Refresh sessions list
        await backendLoadSessions();
      } catch (err: any) {
        // Revert on error
        console.error('Failed to delete session:', err);
        // Reload sessions to revert
        if (token) {
          await backendLoadSessions();
        }
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
    onClick={() =>
      setModel(model === "basic" ? null : "basic")
    }
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
                  
                  // Use new ChatMessage component if we have new format data
                  if (chatResponse && (chatResponse.tables || chatResponse.explanation)) {
                    return (
                      <div key={i}>
                        <ChatMessage response={chatResponse} isUser={false} />
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
          {safeRow.map((cell, ci) => (
            <td key={ci}>{String(cell ?? "")}</td>
          ))}
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

                {loading && (
                  <div className={styles.loading}>Analyzing…</div>
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
        />
      )}
    </div>
  );
}
