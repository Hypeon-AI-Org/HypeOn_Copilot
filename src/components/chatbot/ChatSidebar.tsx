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
const NewChatIconCollapsed = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 16l1-4 7-7a2 2 0 1 1 3 3l-7 7-4 1z" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="20"
    height="20"
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

export default function ChatGPTSidebar({
  collapsed,
  onToggle,
  onOpenSearch,
}: ChatGPTSidebarProps) {
  /* ================= COLLAPSED RAIL ================= */
  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.railTop}>
          {/* Logo = open sidebar button */}
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

          {/* Icons below logo */}
          <button className={styles.railIconBtn} title="New chat">
            <NewChatIconCollapsed />
          </button>

          <button
            className={styles.railIconBtn}
            title="Search chats"
            onClick={onOpenSearch}
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

  /* ================= OPEN SIDEBAR ================= */
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
        <button className={styles.newChat}>
          <NewChatIconCollapsed />
          <span>New chat</span>
        </button>

        <button className={styles.menuBtn} onClick={onOpenSearch}>
          <SearchIcon />
          <span>Search chats</span>
        </button>
      </div>

      <div className={styles.chatsWrapper}>
        <div className={styles.sectionTitle}>Your chats</div>
        <ul className={styles.list}>
       <li className={styles.listItem}>Show trending wallpaper products in the US</li>
<li className={styles.listItem}>Find high-intent wallpaper keywords (US market)</li>
<li className={styles.listItem}>Generate ad creatives for wallpaper products</li>
<li className={styles.listItem}>Suggest best-selling wallpaper styles</li>
<li className={styles.listItem}>Write product descriptions for wallpaper items</li>
<li className={styles.listItem}>Analyze competitor wallpaper brands</li>

        
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
