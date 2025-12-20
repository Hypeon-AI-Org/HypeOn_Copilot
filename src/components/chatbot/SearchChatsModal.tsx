"use client";

import { useState } from "react";
import styles from "../../styles/SearchChatsModal.module.css";

type SearchChatsModalProps = {
  onClose: () => void;

  //  ADDED
  chats: { id: string; title: string }[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
};

export default function SearchChatsModal({
  onClose,
  chats,
  onSelectChat,
  onNewChat,
}: SearchChatsModalProps) {
  const [query, setQuery] = useState("");

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.topRow}>
          <input
            className={styles.searchInput}
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

<button
  className={styles.newChatRow}
  onClick={() => {
    onNewChat(); 
    onClose();   
  }}
>

          <span className={styles.newChatIcon}>+</span>
          <span>New chat</span>
        </button>

        <div className={styles.listWrapper}>
          {filtered.map((chat) => (
            <div
              key={chat.id}
              className={styles.chatRow}
              onClick={() => {
                onSelectChat(chat.id);
                onClose();
              }}
            >
              <span className={styles.chatBullet} />
              <span className={styles.chatTitle}>{chat.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

