// components/chat/ChatGPTSidebar.tsx
"use client";

import Image from "next/image";
import styles from "../../styles/ChatSidebar.module.css";

type ChatGPTSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onOpenSearch: () => void;
};

/* ICONS */
const PlusIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function truncateWords(text: string, maxWords = 6) {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

export default function ChatGPTSidebar({
  collapsed,
  onToggle,
  onOpenSearch,
}: ChatGPTSidebarProps) {
  const chats = [
    "Show trending wallpaper products in the US",
    "Find high-intent wallpaper keywords (US market)",
    "Generate ad creatives for wallpaper products",
    "Suggest best-selling wallpaper styles",
    "Write product descriptions for wallpaper items",
   
  ];

  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.railTop}>
          <button
            className={styles.logoMini}
            onClick={onToggle}
            title="Open sidebar"
          >
            <Image
              src="/images/hypeonai_logo.jpg"
              alt="HypeOn Logo"
              width={40}
              height={40}
              className={styles.logoImg}
            />
            <span className={styles.logoMiniArrow}>›</span>
          </button>

          <button className={styles.railIconBtn} title="New chat" aria-label="New chat">
            <PlusIcon />
          </button>

          <button
            className={styles.railIconBtn}
            title="Search chats"
            onClick={onOpenSearch}
            aria-label="Search chats"
          >
            <SearchIcon />
          </button>
        </div>

        <div className={styles.railBottom}>
          <div className={styles.avatarRail}>YM</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topRow}>
        <div className={styles.headerLeft}>
          <div className={styles.logoWrapper}>
            <Image
              src="/images/hypeonai_logo.jpg"
              alt="HypeOn Logo"
              width={40}
              height={40}
              className={styles.logoImg}
            />
          </div>
        </div>

        <button
          className={styles.topToggle}
          onClick={onToggle}
          aria-label="Close sidebar"
        >
          ‹
        </button>
      </div>

      <div className={styles.section}>
        <button className={styles.newChat} title="New chat">
          <span className={styles.iconWrap}>
            <PlusIcon />
          </span>
          <span className={styles.newChatText}>New chat</span>
        </button>

        <button
          className={`${styles.menuBtn} ${styles.searchPill}`}
          onClick={onOpenSearch}
        >
          <span className={styles.iconWrap}>
            <SearchIcon />
          </span>
          <span>Search chats</span>
        </button>
      </div>

      <div className={styles.chatsWrapper}>
        <div className={styles.sectionTitle}>Your chats</div>
        <ul className={styles.list}>
          {chats.map((c, i) => (
            <li
              key={i}
              className={styles.listItem}
              title={c}
              aria-label={`Open chat: ${c}`}
            >
              {truncateWords(c, 6)}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.footer}>
        <div className={styles.avatar}>N</div>
        <div>
          <div className={styles.username}>yash malviya</div>
          <div className={styles.plan}>Basic</div>
        </div>
      </div>
    </aside>
  );
}
