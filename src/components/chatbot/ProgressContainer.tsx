"use client";

import React from 'react';
import { ProgressIndicator, StageInfo } from '@/components/chatbot/ProgressIndicator';

interface ProgressContainerProps {
  progress: {
    stage: string;
    progress: number;
    message: string;
  } | null;
  stagesArray: StageInfo[];
  loading: boolean;
}

/**
 * ProgressContainer - A self-contained component that displays progress updates.
 * 
 * This component uses internal state synced with props via useEffect to ensure
 * reliable re-renders whenever progress updates occur.
 */
export function ProgressContainer({ progress, stagesArray, loading }: ProgressContainerProps) {
  // Log every render to track updates
  if (process.env.NODE_ENV === 'development' && progress) {
    console.log('📊 ProgressContainer - Render:', {
      stage: progress.stage,
      progress: progress.progress,
      message: progress.message,
    });
  }

  if (!loading || !progress) {
    return null;
  }

  // Use props directly - no local state to avoid delays
  // The key prop in parent ensures this component re-renders on every update
  return (
    <ProgressIndicator
      progress={progress.progress}
      status={progress.message}
      stage={progress.stage}
      stages={stagesArray}
    />
  );
}

