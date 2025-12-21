"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { DataTable, TableData } from './DataTable';
import styles from '../../styles/chat.module.css';

export interface ChatResponse {
  session_id: string;
  answer: string;
  tables?: TableData[];
  explanation?: string | null;
}

interface ChatMessageProps {
  response: ChatResponse;
  isUser?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  response, 
  isUser = false 
}) => {
  if (isUser) {
    return <div className={styles.userMessage}>{response.answer}</div>;
  }

  return (
    <div className={styles.assistantMessage}>
      {/* Main Answer with Markdown */}
      <div className={styles.answerContent}>
        <ReactMarkdown>{response.answer}</ReactMarkdown>
      </div>

      {/* Tables Section */}
      {response.tables && response.tables.length > 0 && (
        <div className={styles.tablesSection}>
          {response.tables.map((table, idx) => (
            <DataTable key={idx} table={table} />
          ))}
        </div>
      )}

      {/* Explanation */}
      {response.explanation && (
        <div className={styles.explanation}>
          <strong>💡 Key Insight:</strong>
          <p>{response.explanation}</p>
        </div>
      )}
    </div>
  );
};

