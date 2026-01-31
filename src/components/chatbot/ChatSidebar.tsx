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

  isMobile?: boolean;
  mobileOpen?: boolean;
  onRequestClose?: () => void;

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
    width="18"
    height="18"
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

const SidebarToggleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M9 5.6V18.4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6.25 8.2H7.75M6.25 12H7.75M6.25 15.8H7.75"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

/* ================= COMPONENT ================= */

export default function ChatGPTSidebar({
  collapsed,
  onToggle,
  onOpenSearch,
  isMobile = false,
  mobileOpen = true,
  onRequestClose,
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

  // Mobile: show as an overlay drawer controlled by parent
  if (isMobile) {
    if (!mobileOpen) return null;

    return (
      <>
        <div
          className={styles.mobileOverlay}
          onClick={() => onRequestClose?.()}
        />
        <aside className={`${styles.sidebar} ${styles.sidebarOpen}`}>
          {/* TOP */}
          <div className={styles.topRow}>
            <div className={styles.headerLeft}>
              <div className={styles.logoWrapper}>
                <Image
                  src="/images/hypeon.png"
                  alt="HypeOn Logo"
                  width={32}
                  height={32}
                  className={styles.logoImg}
                />
              </div>
            </div>

            <button
              className={styles.topToggle}
              onClick={onToggle}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <SidebarToggleIcon />
            </button>
          </div>

          {/* ACTIONS */}
          <div className={styles.section}>
            <button
              className={styles.newChat}
              onClick={() => {
                onNewChat();
                onRequestClose?.();
              }}
            >
              <PlusIcon />
              <span>New chat</span>
            </button>

            <button
              className={`${styles.menuBtn} ${styles.searchPill}`}
              onClick={() => {
                onOpenSearch();
                onRequestClose?.();
              }}
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
                  onClick={() => {
                    onSelectChat(c.id);
                    onRequestClose?.();
                  }}
                >
                  {/* TITLE / RENAME */}
                  {renamingChatId === c.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim() && renameValue !== c.title) {
                          onRenameChat(c.id, renameValue);
                        }
                        setRenamingChatId(null);
                        setRenameValue("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (renameValue.trim() && renameValue !== c.title) {
                            onRenameChat(c.id, renameValue);
                          }
                          setRenamingChatId(null);
                          setRenameValue("");
                        } else if (e.key === "Escape") {
                          setRenamingChatId(null);
                          setRenameValue("");
                        }
                      }}
                      className={styles.renameInput}
                    />
                  ) : (
                    <span className={styles.chatTitle} title={c.title}>
                      {c.title}
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
      </>
    );
  }

  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.railTop}>
          <button
            type="button"
            className={styles.logoMini}
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <Image
              src="/images/hypeon.png"
              alt="HypeOn Logo"
              width={40}
              height={40}
              className={styles.logoImg}
            />
            <span className={styles.logoMiniArrow}>
              <SidebarToggleIcon />
            </span>
          </button>

          <button
            type="button"
            className={styles.railIconBtn}
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <PlusIcon />
          </button>

          <button
            type="button"
            className={styles.railIconBtn}
            onClick={onOpenSearch}
            aria-label="Search chats"
            title="Search chats"
          >
            <SearchIcon />
          </button>
        </div>

        <div className={styles.railDivider} aria-hidden="true" />

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
  <div className={styles.headerLeft}>
    <div className={styles.logoWrapper}>
      <Image
        src="/images/hypeon.png"
        alt="HypeOn Logo"
        width={32}
        height={32}
        className={styles.logoImg}
      />
    </div>

  </div>


        <button
          className={styles.topToggle}
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <SidebarToggleIcon />
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
                    if (renameValue.trim() && renameValue !== c.title) {
                      onRenameChat(c.id, renameValue);
                    }
                    setRenamingChatId(null);
                    setRenameValue("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (renameValue.trim() && renameValue !== c.title) {
                        onRenameChat(c.id, renameValue);
                      }
                      setRenamingChatId(null);
                      setRenameValue("");
                    } else if (e.key === "Escape") {
                      setRenamingChatId(null);
                      setRenameValue("");
                    }
                  }}
                  className={styles.renameInput}
                />
              ) : (
                <span className={styles.chatTitle} title={c.title}>
                  {c.title}
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
