"use client";

import React from 'react';
import styles from '../../styles/chat.module.css';

interface ProgressIndicatorProps {
  progress: number;  // 0.0 to 1.0
  status: string;
  stage: string;
}

const stageIcons: Record<string, string> = {
  routing: '🔍',
  enhance: '✨',
  research: '🌐',
  analysis: '📊',
  compose: '✍️',
  streaming: '💬',
  done: '✅',
  error: '❌',
  unknown: '⏳',
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  progress, 
  status, 
  stage 
}) => {
  // Don't show if progress is 0 or complete
  if (progress === 0 || progress >= 1.0) {
    return null;
  }

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
      <div className={styles.statusText}>
        <span className={styles.stageIcon}>
          {stageIcons[stage] || stageIcons.unknown}
        </span>
        <span className={styles.statusMessage}>{status}</span>
      </div>
    </div>
  );
};

