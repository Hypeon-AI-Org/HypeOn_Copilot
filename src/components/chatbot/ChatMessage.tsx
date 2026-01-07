"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DataTable } from './DataTable';
import { ChatResponse, Insight, Artifact } from '@/lib/chatService';
import styles from '../../styles/chat.module.css';

interface ChatMessageProps {
  response: ChatResponse;
  isUser?: boolean;
  animate?: boolean; // Enable typing animation
  animationSpeed?: number; // Words per second (default: 10)
  onAnimationComplete?: () => void; // Callback when animation completes
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
      {artifact.type && (
        <div className={styles.artifactHeader}>
          <strong>{artifact.type}</strong>
        </div>
      )}
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

// Typing animation component for markdown content
const TypingMarkdown: React.FC<{ 
  text: string; 
  speed?: number;
  onComplete?: () => void;
}> = ({ text, speed = 10, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    // Split text into words, preserving spaces and newlines
    const words = text.split(/(\s+)/);
    let currentIndex = 0;
    setIsComplete(false);
    setDisplayedText('');

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(prev => prev + words[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
      }
    }, 1000 / speed); // Convert words per second to interval

    return () => clearInterval(interval);
  }, [text, speed]);

  // Call onComplete when animation finishes
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedText}</ReactMarkdown>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  response, 
  isUser = false,
  animate = true,
  animationSpeed = 10,
  onAnimationComplete
}) => {
  const [typingComplete, setTypingComplete] = useState(!animate);

  // Reset typing state when animate prop changes
  useEffect(() => {
    if (animate) {
      setTypingComplete(false);
    } else {
      setTypingComplete(true);
    }
  }, [animate]);

  const handleAnimationComplete = () => {
    setTypingComplete(true);
    onAnimationComplete?.();
  };

  if (isUser) {
    return <div className={styles.userMessage}>{response.answer}</div>;
  }

  // Debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
    // Removed verbose logging for production
  }

  return (
    <div className={styles.assistantMessage}>
      {/* Main Answer with Markdown */}
      <div className={styles.answerContent}>
        {animate && !typingComplete ? (
          <TypingMarkdown 
            text={response.answer || ''} 
            speed={animationSpeed}
            onComplete={handleAnimationComplete}
          />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.answer}</ReactMarkdown>
        )}
      </div>

      {/* Insights Section - Show after typing completes */}
      {typingComplete && response.insights && response.insights.length > 0 && (
        <div className={styles.insightsSection}>
          {response.sectionTitles?.insights && (
            <h5 className={styles.insightsTitle}>{response.sectionTitles.insights}</h5>
          )}
          {response.insights.map((insight, idx) => (
            <InsightItem key={insight.id || idx} insight={insight} />
          ))}
        </div>
      )}

      {/* Tables Section - Show after typing completes */}
      {typingComplete && response.tables && response.tables.length > 0 && (
        <div className={styles.tablesSection}>
          {response.tables.map((table, idx) => (
            <DataTable key={table.id || idx} table={table} />
          ))}
        </div>
      )}

      {/* Artifacts Section - Show after typing completes */}
      {typingComplete && response.artifacts && response.artifacts.length > 0 && (
        <div className={styles.artifactsSection}>
          {response.sectionTitles?.artifacts && (
            <h5 className={styles.artifactsTitle}>{response.sectionTitles.artifacts}</h5>
          )}
          {response.artifacts.map((artifact, idx) => (
            <ArtifactItem key={idx} artifact={artifact} />
          ))}
        </div>
      )}

      {/* Explanation - Show after typing completes */}
      {typingComplete && response.explanation && (
        <div className={styles.explanation}>
          {response.sectionTitles?.explanation && (
            <strong>{response.sectionTitles.explanation}</strong>
          )}
          <p>{response.explanation}</p>
        </div>
      )}
    </div>
  );
};

