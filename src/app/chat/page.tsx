"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import SearchChatsModal from "@/components/chatbot/SearchChatsModal";
import styles from "../../styles/chat.module.css";

// Sidebar (client-only)
const ChatSidebar = dynamic(() => import("@/components/chatbot/ChatSidebar"), {
  ssr: false,
});

const MOCK_CHATS = [
  { id: "1", title: "Top-right corner cut", group: "today" as const },
  { id: "2", title: "Light mode sidebar code", group: "today" as const },
  { id: "3", title: "Icon SVGs provided", group: "today" as const },
  { id: "4", title: "Robots txt for wallpaper store", group: "yesterday" as const },
  { id: "5", title: "Code update for header", group: "yesterday" as const },
];

export default function ChatPage() {
  /* ---------------- Sidebar ---------------- */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem("sidebar-collapsed") === "true"
      );
    } catch {
      return false;
    }
  });

  const [searchOpen, setSearchOpen] = useState(false);

  /* ---------------- Input + Model ---------------- */
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [model, setModel] = useState<"basic" | "pro">("basic");
  const [modelOpen, setModelOpen] = useState(false);

  const actionsRef = useRef<HTMLDivElement | null>(null);

  /* ---------------- Mount animation ---------------- */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  /* ---------------- Animated Placeholder ---------------- */
  const PLACEHOLDER_TEXT = " Describe what you want to analyze…";
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isTypingActive, setIsTypingActive] = useState(true);

  useEffect(() => {
    if (!isTypingActive || input.length > 0) return;

    let i = 0;
    let direction: "forward" | "backward" = "forward";
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      if (!isTypingActive || input.length > 0) return;

      if (direction === "forward") {
        setAnimatedPlaceholder(PLACEHOLDER_TEXT.slice(0, i + 1));
        i++;

        if (i === PLACEHOLDER_TEXT.length) {
          timeoutId = setTimeout(() => {
            direction = "backward";
          }, 1200);
        }
      } else {
        setAnimatedPlaceholder(PLACEHOLDER_TEXT.slice(0, i - 1));
        i--;

        if (i === 0) {
          direction = "forward";
        }
      }

      timeoutId = setTimeout(tick, direction === "forward" ? 55 : 35);
    };

    timeoutId = setTimeout(tick, 500);

    return () => clearTimeout(timeoutId);
  }, [isTypingActive, input]);

  /* ---------------- Send message ---------------- */
  function sendMessage(text: string) {
    if (!text.trim()) return;
    console.log("MODEL:", model, "MESSAGE:", text);
    setInput("");
    setTimeout(() => {
      inputRef.current?.focus();
      setIsTypingActive(true);
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  /* ---------------- Close dropdowns ---------------- */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setModelOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className={styles.chatRoot}>
      <ChatSidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className={`${styles.main} ${mounted ? styles.mounted : ""}`}>
        <section className={styles.center}>
          <div className={styles.heroBlock}>
            {/* LOGO */}
            <div
              className={`${styles.heroLogo} ${
                mounted ? styles.heroLogoMounted : ""
              }`}
            >
              <Image
                src="/images/hypeonai_logo.jpg"
                alt="HypeOn logo"
                width={85}
                height={85}
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

            {/* ================= INPUT CARD ================= */}
            <div className={styles.inputCard}>
              
              <div className={styles.inputRow} ref={actionsRef}>
                <span className={styles.textareaIcon}>✨︎</span>
                <textarea
                
                  ref={inputRef}
                  className={styles.textarea}
                  placeholder={animatedPlaceholder}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setIsTypingActive(false);
                  }}
                  onFocus={() => setIsTypingActive(false)}
                  onBlur={() => {
                    if (input.length === 0) setIsTypingActive(true);
                  }}
                  onKeyDown={onKeyDown}
                  rows={2}
                />

                <div className={styles.BottomBar}>
                  <div className={styles.Left}>
                    <button
                      className={styles.ModelBtn}
                      onClick={() => setModelOpen((v) => !v)}
                    >
                      {model === "basic" ? "HypeOn Basic" : "HypeOn Pro"}
                      <span className={styles.Arrow}>▾</span>
                    </button>

                    {modelOpen && (
                      <div className={styles.ModelMenu}>
                        <button
                          onClick={() => {
                            setModel("basic");
                            setModelOpen(false);
                          }}
                        >
                          <strong>HypeOn Basic</strong>
                          <span>Everyday insights</span>
                        </button>

                        <button
                          onClick={() => {
                            setModel("pro");
                            setModelOpen(false);
                          }}
                        >
                          <strong>HypeOn Pro</strong>
                          <span>Advanced analysis</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    className={styles.SendBtn}
                    aria-label="Send"
                    onClick={() => sendMessage(input)}
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
            {/* ================= END INPUT CARD ================= */}
          </div>
          
        </section>
      </main>

      {searchOpen && (
        <SearchChatsModal
          onClose={() => setSearchOpen(false)}
          chats={MOCK_CHATS}
        />
      )}
    </div>
  );
}
