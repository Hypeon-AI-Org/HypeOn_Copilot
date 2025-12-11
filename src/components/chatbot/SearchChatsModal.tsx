// components/chat/SearchChatsModal.tsx
"use client";

import styles from "../../styles/SearchChatsModal.module.css";

type ChatItem = {
  id: string;
  title: string;
  group: "today" | "yesterday";
};

type SearchChatsModalProps = {
  onClose: () => void;
  chats: ChatItem[];
};

export default function SearchChatsModal({
  onClose,
  chats,
}: SearchChatsModalProps) {
  const todayChats = chats.filter((c) => c.group === "today");
  const yesterdayChats = chats.filter((c) => c.group === "yesterday");

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Top search bar row */}
        <div className={styles.topRow}>
          <input
            className={styles.searchInput}
            placeholder="Search chats..."
          />
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* New chat row */}
        <button className={styles.newChatRow}>
          <span className={styles.newChatIcon}>+</span>
          <span>New chat</span>
        </button>

        {/* Scrollable list */}
        <div className={styles.listWrapper}>
          {todayChats.length > 0 && (
            <>
              <div className={styles.groupLabel}>Today</div>
              {todayChats.map((chat) => (
                <div key={chat.id} className={styles.chatRow}>
                  <span className={styles.chatBullet} />
                  <span className={styles.chatTitle}>{chat.title}</span>
                </div>
              ))}
            </>
          )}

          {yesterdayChats.length > 0 && (
            <>
              <div className={styles.groupLabel}>Yesterday</div>
              {yesterdayChats.map((chat) => (
                <div key={chat.id} className={styles.chatRow}>
                  <span className={styles.chatBullet} />
                  <span className={styles.chatTitle}>{chat.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
