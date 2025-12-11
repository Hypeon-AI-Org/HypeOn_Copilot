// app/chat/page.tsx
"use client";

import { useState } from "react";
import ChatSidebar from "@/components/chatbot/ChatSidebar";
import SearchChatsModal from "@/components/chatbot/SearchChatsModal";
import styles from "../../styles/chat.module.css";

const MOCK_CHATS = [
  { id: "1", title: "Top-right corner cut", group: "today" as const },
  { id: "2", title: "Light mode sidebar code", group: "today" as const },
  { id: "3", title: "Icon SVGs provided", group: "today" as const },
  { id: "4", title: "Robots txt for wallpaper store", group: "yesterday" as const },
  { id: "5", title: "Code update for header", group: "yesterday" as const },
];

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [openModelMenu, setOpenModelMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className={styles.chatRoot}>
      <ChatSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className={styles.main}>
        {/* MODEL SELECTOR =================================================== */}
        <div className={styles.modelSelectorWrapper}>
          <button
            className={styles.modelSelector}
            onClick={() => setOpenModelMenu((prev) => !prev)}
          >
            <span className={styles.modelName}>HypeOn Basic</span>
            <svg
              className={styles.arrow}
              width="12"
              height="12"
              viewBox="0 0 24 24"
            >
              <path fill="currentColor" d="M7 10l5 5 5-5z" />
            </svg>
          </button>

          {openModelMenu && (
            <div className={styles.modelDropdown}>
              <div className={styles.modelItem}>
                <div className={styles.modelTitle}>HypeOn Pro</div>
                <div className={styles.modelDesc}>Our smartest model</div>
              </div>

              <div className={styles.modelItemSelected}>
                <div className={styles.modelTitle}>HypeOn 5.1</div>
                <div className={styles.modelDesc}>Flagship model</div>
                <div className={styles.check}>✔</div>
              </div>
            </div>
          )}
        </div>

        {/* ========================== MAIN HERO ============================ */}
        <section className={styles.center}>
          <div className={styles.heroBlock}>
            <h1 className={styles.heading}>What should I explore for you?</h1>
            <p className={styles.subHeading}>
              Ask HypeOn Copilot anything about trends, products, keywords or
              creatives – it’s powered by our Hypeon Intelligence engine.
            </p>

            <div className={styles.inputCard}>
              <div className={styles.inputRow}>
                <span className={styles.placeholderLabel}>Ask anything</span>
                <div className={styles.inputActions}>
               
                  <button className={styles.sendBtn}>↑</button>
                </div>
              </div>
            </div>
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
