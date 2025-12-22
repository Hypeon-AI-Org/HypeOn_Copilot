"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { DataTable } from './DataTable';
import { ChatResponse, Insight, Artifact } from '@/lib/chatService';
import styles from '../../styles/chat.module.css';

interface ChatMessageProps {
  response: ChatResponse;
  isUser?: boolean;
}

// Helper component for rendering insights
const InsightItem: React.FC<{ insight: Insight }> = ({ insight }) => {
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'recommendation':
        return '💡';
      case 'finding':
        return '🔍';
      case 'warning':
        return '⚠️';
      default:
        return '📌';
    }
  };

  return (
    <div className={styles.insightItem} data-category={insight.category}>
      <span className={styles.insightIcon}>{getCategoryIcon(insight.category)}</span>
      <span className={styles.insightText}>{insight.text}</span>
      {insight.confidence !== undefined && (
        <span className={styles.insightConfidence}>
          ({Math.round(insight.confidence * 100)}% confidence)
        </span>
      )}
    </div>
  );
};

// Helper component for rendering artifacts
const ArtifactItem: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  return (
    <div className={styles.artifactItem} data-type={artifact.type}>
      <div className={styles.artifactHeader}>
        <strong>Artifact: {artifact.type}</strong>
      </div>
      <div className={styles.artifactData}>
        <pre>{JSON.stringify(artifact.data, null, 2)}</pre>
      </div>
      {artifact.metadata && (
        <div className={styles.artifactMetadata}>
          <small>{JSON.stringify(artifact.metadata)}</small>
        </div>
      )}
    </div>
  );
};

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

      {/* Insights Section */}
      {response.insights && response.insights.length > 0 && (
        <div className={styles.insightsSection}>
          <h5 className={styles.insightsTitle}>Key Insights</h5>
          {response.insights.map((insight, idx) => (
            <InsightItem key={insight.id || idx} insight={insight} />
          ))}
        </div>
      )}

      {/* Tables Section */}
      {response.tables && response.tables.length > 0 && (
        <div className={styles.tablesSection}>
          {response.tables.map((table, idx) => (
            <DataTable key={table.id || idx} table={table} />
          ))}
        </div>
      )}

      {/* Artifacts Section */}
      {response.artifacts && response.artifacts.length > 0 && (
        <div className={styles.artifactsSection}>
          <h5 className={styles.artifactsTitle}>Data Artifacts</h5>
          {response.artifacts.map((artifact, idx) => (
            <ArtifactItem key={idx} artifact={artifact} />
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

