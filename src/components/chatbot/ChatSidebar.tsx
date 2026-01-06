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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ================= HELPERS ================= */

function truncateWords(text: string, maxWords = 3) {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}…`;
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  /* DELETE MODAL STATE */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  /* USER HELPERS */
  const getUserInitials = () => {
    if (userInfo?.name) {
      const n = userInfo.name.trim().split(/\s+/);
      return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : userInfo.name.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => userInfo?.name || "User";
  const getPlanName = () => userInfo?.plan || "Basic";

  /* CLOSE CONTEXT MENU */
  useEffect(() => {
    const close = () => setMenuChatId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  /* ================= COLLAPSED ================= */

  if (collapsed) {
    return (
      <aside className={styles.sidebarCollapsed}>
        <div className={styles.railTop}>
          <button className={styles.logoMini} onClick={onToggle}>
            <Image src="/images/hypeon.png" alt="HypeOn Logo" width={40} height={40} />
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

  /* ================= EXPANDED ================= */

  return (
    <aside className={styles.sidebar}>
      {/* TOP */}
      <div className={styles.topRow}>
        <div className={styles.logoWrapper}>
          <Image src="/images/hypeon.png" alt="HypeOn Logo" width={40} height={40} />
        </div>

        <button className={styles.topToggle} onClick={onToggle}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="24" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.35)" />
            <path d="M28 15 L20 25 L28 35" fill="none" stroke="#ec4899" strokeWidth={2} />
          </svg>
        </button>
      </div>

      {/* ACTIONS */}
      <div className={styles.section}>
        <button className={styles.newChat} onClick={onNewChat}>
          <PlusIcon /> <span>New chat</span>
        </button>

        <button className={`${styles.menuBtn} ${styles.searchPill}`} onClick={onOpenSearch}>
          <SearchIcon /> <span>Search chats</span>
        </button>
      </div>

      {/* CHAT LIST */}
      <div className={styles.chatsWrapper}>
        <div className={styles.sectionTitle}>Your chats</div>

        <ul className={styles.list}>
          {chats.map((c) => (
            <li
              key={c.id}
              className={`${styles.listItem} ${activeChatId === c.id ? styles.active : ""}`}
              onClick={() => onSelectChat(c.id)}
            >
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
                      onRenameChat(c.id, renameValue);
                      setRenamingChatId(null);
                      setRenameValue("");
                    }
                    if (e.key === "Escape") {
                      setRenamingChatId(null);
                      setRenameValue("");
                    }
                  }}
                  className={styles.renameInput}
                />
              ) : (
                <span className={styles.chatTitle}>{truncateWords(c.title)}</span>
              )}

              <button
                className={styles.moreBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenuPos({ top: r.top + r.height / 2, left: r.right + 12 });
                  setMenuChatId(menuChatId === c.id ? null : c.id);
                }}
              >
                ⋯
              </button>

              {menuChatId === c.id && menuPos && (
                <Portal>
                  <div className={styles.contextMenu} style={menuPos} onClick={(e) => e.stopPropagation()}>
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
                        setChatToDelete(c.id);
                        setShowDeleteModal(true);
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

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <Portal>
          <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center">
            <div className="bg-[#1a0f14] rounded-xl px-6 py-5 w-[360px] shadow-xl">
              <h3 className="text-white text-lg font-semibold mb-2">Delete chat?</h3>
              <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>

              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded-full bg-[#5a2435] text-white text-sm"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setChatToDelete(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  className="px-5 py-2 rounded-full bg-pink-400 text-black text-sm font-medium"
                  onClick={() => {
                    if (chatToDelete) onDeleteChat(chatToDelete);
                    setShowDeleteModal(false);
                    setChatToDelete(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </aside>
  );
}
