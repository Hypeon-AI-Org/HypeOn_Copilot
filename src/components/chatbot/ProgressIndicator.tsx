"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/chat.module.css';

const MIN_DISPLAY_DURATION = 800; // 0.8 seconds in milliseconds

export interface StageInfo {
  name: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  message?: string;
  latencyMs?: number;
  error?: string;
  stageIndex?: number;
  totalStages?: number;
}

interface ProgressIndicatorProps {
  progress: number;  // 0.0 to 1.0
  status: string;
  stage: string;
  stages?: Map<string, StageInfo> | StageInfo[]; // Optional: full stage timeline (Map or Array)
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

const stageLabels: Record<string, string> = {
  routing: 'Initializing',
  enhance: 'Optimizing',
  research: 'Searching',
  analysis: 'Analyzing',
  compose: 'Composing',
  streaming: 'Streaming',
  done: 'Complete',
  error: 'Error',
  unknown: 'Processing',
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  progress, 
  status, 
  stage,
  stages 
}) => {
  // Local state to track what's currently displayed (with minimum duration)
  const [displayedStatus, setDisplayedStatus] = useState(status || '');
  const [displayedStage, setDisplayedStage] = useState(stage);
  const [displayedProgress, setDisplayedProgress] = useState(progress);
  
  // Track the last update time and timeout ref
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<{
    status: string;
    stage: string;
    progress: number;
  } | null>(null);

  // Convert stages map to sorted array for timeline display
  const stagesArray = stages 
    ? (Array.isArray(stages) 
        ? [...stages]
        : Array.from(stages.values()))
        .sort((a, b) => {
          if (a.stageIndex !== undefined && b.stageIndex !== undefined) {
            return a.stageIndex - b.stageIndex;
          }
          return a.name.localeCompare(b.name);
        })
    : [];

  // Find the currently active stage (status === 'active')
  const activeStage = stagesArray.find(s => s.status === 'active');

  // Check if response is complete - update immediately if so
  const isComplete = progress >= 1.0 || stage === 'done';

  // Handle progress updates with minimum display duration
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If response is complete, update immediately
    if (isComplete) {
      setDisplayedStatus(status || '');
      setDisplayedStage(stage);
      setDisplayedProgress(progress);
      pendingUpdateRef.current = null;
      return;
    }

    // Check if status/stage/progress actually changed
    const hasChanged = 
      displayedStatus !== (status || '') ||
      displayedStage !== stage ||
      Math.abs(displayedProgress - progress) > 0.01; // Small threshold for progress

    if (!hasChanged) {
      return; // No change, nothing to do
    }

    // Calculate time since last update
    const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;

    if (timeSinceLastUpdate >= MIN_DISPLAY_DURATION) {
      // Enough time has passed, update immediately
      setDisplayedStatus(status || '');
      setDisplayedStage(stage);
      setDisplayedProgress(progress);
      lastUpdateTimeRef.current = Date.now();
      pendingUpdateRef.current = null;
    } else {
      // Not enough time has passed, schedule update
      const remainingTime = MIN_DISPLAY_DURATION - timeSinceLastUpdate;
      pendingUpdateRef.current = {
        status: status || '',
        stage,
        progress,
      };

      timeoutRef.current = setTimeout(() => {
        if (pendingUpdateRef.current) {
          setDisplayedStatus(pendingUpdateRef.current.status);
          setDisplayedStage(pendingUpdateRef.current.stage);
          setDisplayedProgress(pendingUpdateRef.current.progress);
          lastUpdateTimeRef.current = Date.now();
          pendingUpdateRef.current = null;
        }
        timeoutRef.current = null;
      }, remainingTime);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [status, stage, progress, isComplete, displayedStatus, displayedStage, displayedProgress]);

  // Don't show if complete
  if (displayedProgress >= 1.0 && displayedStage === 'done') {
    return null;
  }

  // Use displayed values (which respect minimum duration)
  const displayMessage = displayedStatus?.trim()
    || activeStage?.message?.trim()
    || stageLabels[displayedStage] 
    || 'Processing...';
  
  const displayIcon = activeStage 
    ? (stageIcons[activeStage.name] || stageIcons.unknown)
    : (stageIcons[displayedStage] || stageIcons.unknown);

  const overallProgress = stagesArray.length > 0
    ? stagesArray.reduce((sum, s) => {
        const stageWeight = s.totalStages ? 1 / s.totalStages : 1 / stagesArray.length;
        return sum + (s.progress * stageWeight);
      }, 0)
    : displayedProgress;

  // Log for debugging - shows what message will be displayed
  if (process.env.NODE_ENV === 'development') {
    console.log('🟡 ProgressIndicator - Render:', {
      stage: displayedStage,
      progress: displayedProgress,
      statusProp: displayedStatus,
      displayMessage,
      activeStage: activeStage?.name,
      activeStageMessage: activeStage?.message,
      usingStatusProp: displayedStatus?.trim() === displayMessage,
    });
  }

  return (
    <div className={styles.progressContainer}>
      {/* Current Stage Status with Percentage on same line */}
      <div className={styles.statusText}>
        <span className={styles.stageIcon}>
          {displayIcon}
        </span>
        <span className={styles.statusMessage} title={displayMessage}>
          {displayMessage}
        </span>
        {overallProgress > 0 && overallProgress < 1 && (
  <div className={styles.inlineProgress}>
    <div className={styles.inlineBar}>
      <div
        className={styles.inlineFill}
        style={{ width: `${overallProgress * 100}%` }}
      />
    </div>
    <span className={styles.inlinePercent}>
      {Math.round(overallProgress * 100)}%
    </span>
  </div>
)}

      
      </div>
    </div>
  );
};

