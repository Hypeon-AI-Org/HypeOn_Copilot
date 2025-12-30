"use client";

import { useState } from "react";
import styles from "../../styles/SearchChatsModal.module.css";

type SearchChatsModalProps = {
  onClose: () => void;
  chats: { id: string; title: string }[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChats?: (ids: string[]) => void;
};

export default function SearchChatsModal({
  onClose,
  chats,
  onSelectChat,
  onNewChat,
  onDeleteChats,
}: SearchChatsModalProps) {
  const [query, setQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  const toggleSelection = (chatId: string) => {
    setSelectedChats((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedChats.size === filtered.length) {
      setSelectedChats(new Set());
    } else {
      setSelectedChats(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedChats.size === 0 || !onDeleteChats) return;
    
    const count = selectedChats.size;
    if (confirm(`Are you sure you want to delete ${count} chat${count > 1 ? 's' : ''}?`)) {
      onDeleteChats(Array.from(selectedChats));
      setSelectedChats(new Set());
      // Don't close modal - let user see the deletion happen
    }
  };

  const handleChatClick = (chatId: string, e: React.MouseEvent) => {
    // If clicking on checkbox, let the checkbox handle it
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    // If any chats are selected, clicking a row toggles its selection
    if (selectedChats.size > 0) {
      toggleSelection(chatId);
    } else {
      // If nothing is selected, clicking opens the chat
      onSelectChat(chatId);
      onClose();
    }
  };

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

        <div className={styles.actionBar}>
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

          {filtered.length > 0 && (
            <div className={styles.selectionControls}>
              <button
                className={styles.selectAllBtn}
                onClick={handleSelectAll}
              >
                {selectedChats.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedChats.size > 0 && onDeleteChats && (
                <button
                  className={styles.deleteSelectedBtn}
                  onClick={handleDeleteSelected}
                >
                  Delete ({selectedChats.size})
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.listWrapper}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              No chats found
            </div>
          ) : (
            filtered.map((chat) => {
              const isSelected = selectedChats.has(chat.id);
              return (
                <div
                  key={chat.id}
                  className={`${styles.chatRow} ${isSelected ? styles.chatRowSelected : ''}`}
                  onClick={(e) => handleChatClick(chat.id, e)}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isSelected}
                    onChange={() => toggleSelection(chat.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={styles.chatBullet} />
                  <span className={styles.chatTitle}>{chat.title}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

