"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Portal from "@/components/Portal";
import { useUserInfo } from "@/hooks/useUserInfo";
import styles from "../../styles/ChatSidebar.module.css";

/* ================= TYPES ================= */

type ChatGPTSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onOpenSearch: () => void;

  chats: { id: string; title: string }[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;

  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
};

/* ================= ICONS ================= */

const PlusIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
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
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ================= HELPERS ================= */

function truncateWords(text: string, maxWords = 3) {
  if (!text) return "";
  const words = text.trim().split(/\s+/);

  return words.length <= maxWords
    ? text
    : `${words.slice(0, maxWords).join(" ")}…`;
}

/* ================= COMPONENT ================= */

export default function ChatGPTSidebar({
  collapsed,
  onToggle,
  onOpenSearch,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
}: ChatGPTSidebarProps) {
  const { userInfo } = useUserInfo();
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userInfo?.name) {
      const names = userInfo.name.trim().split(/\s+/);
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return userInfo.name.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    return userInfo?.name || 'User';
  };

  // Get plan name
  const getPlanName = () => {
    return userInfo?.plan || 'Basic';
  };

  /* CLOSE CONTEXT MENU ON OUTSIDE CLICK */
  useEffect(() => {
    const close = () => setMenuChatId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  /* ================= COLLAPSED VIEW ================= */

  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.railTop}>
          <button className={styles.logoMini} onClick={onToggle}>
            <Image
              src="/images/hypeon.png"
              alt="HypeOn Logo"
              width={40}
              height={40}
            />
            <span className={styles.logoMiniArrow}>›</span>
          </button>

          <button className={styles.railIconBtn} onClick={onNewChat}>
            <PlusIcon />
          </button>

          <button className={styles.railIconBtn} onClick={onOpenSearch}>
            <SearchIcon />
          </button>
        </div>

        <div className={styles.railBottom}>
          <div className={styles.avatarRail}>{getUserInitials()}</div>
        </div>
      </aside>
    );
  }

  /* ================= EXPANDED VIEW ================= */

  return (
    <aside className={styles.sidebar}>
      {/* TOP */}
      <div className={styles.topRow}>
        <div className={styles.logoWrapper}>
            <Image
              src="/images/hypeon.png"
              alt="HypeOn Logo"
              width={40}
              height={40}
              className={styles.logoImg}
            />
          </div>

        <button className={styles.topToggle} onClick={onToggle}>
          <svg
  width="50"
  height="50"
  viewBox="0 0 50 50"
  xmlns="http://www.w3.org/2000/svg"
>
  
  <circle
    cx="25"
    cy="25"
    r="24"
    fill="rgba(255,255,255,0.25)"
    stroke="rgba(255,255,255,0.35)"
    strokeWidth="1"
  />

  
  <path
    d="M28 15 L20 25 L28 35"
    fill="none"
    stroke="#ec4899"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</svg>

        </button>
      </div>

      {/* ACTIONS */}
      <div className={styles.section}>
        <button className={styles.newChat} onClick={onNewChat}>
          <PlusIcon />
          <span>New chat</span>
        </button>

        <button
          className={`${styles.menuBtn} ${styles.searchPill}`}
          onClick={onOpenSearch}
        >
          <SearchIcon />
          <span>Search chats</span>
        </button>
      </div>

      {/* CHAT LIST */}
      <div className={styles.chatsWrapper}>
        <div className={styles.sectionTitle}>Your chats</div>

        <ul className={styles.list}>
          {chats.map((c) => (
            <li
              key={c.id}
              className={`${styles.listItem} ${
                activeChatId === c.id ? styles.active : ""
              }`}
              onClick={() => onSelectChat(c.id)}
            >
              {/* TITLE / RENAME */}
              {renamingChatId === c.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    onRenameChat(c.id, renameValue);
                    setRenamingChatId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRenameChat(c.id, renameValue);
                      setRenamingChatId(null);
                    }
                  }}
                  className={styles.renameInput}
                />
              ) : (
                <span className={styles.chatTitle}>
                  {truncateWords(c.title)}
                </span>
              )}

              {/* MORE BUTTON */}
              <button
                className={styles.moreBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();

                  setMenuPos({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 12,
                  });

                  setMenuChatId(menuChatId === c.id ? null : c.id);
                }}
              >
                ⋯
              </button>

              {/* CONTEXT MENU */}
              {menuChatId === c.id && menuPos && (
                <Portal>
                  <div
                    className={styles.contextMenu}
                    style={{
                      top: menuPos.top,
                      left: menuPos.left,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setRenamingChatId(c.id);
                        setRenameValue(c.title);
                        setMenuChatId(null);
                      }}
                    >
                      Rename
                    </button>

                    <button
                      className={styles.deleteBtn}
                      onClick={() => {
                        onDeleteChat(c.id);
                        setMenuChatId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </Portal>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.avatar}>{getUserInitials()}</div>
        <div>
          <div className={styles.username}>{getDisplayName()}</div>
          <div className={styles.plan}>{getPlanName()}</div>
        </div>
      </div>
    </aside>
  );
}
