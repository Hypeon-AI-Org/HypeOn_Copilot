"use client";

import React from 'react';
import { ResearchPlan } from '@/lib/chatService';
import styles from '../../styles/chat.module.css';

interface ResearchPlanIndicatorProps {
  plan: ResearchPlan | null;
}

export function ResearchPlanIndicator({ plan }: ResearchPlanIndicatorProps) {
  if (!plan || plan.searchTerms.length === 0) return null;

  return (
    <div className={styles.researchPlan}>
      <div className={styles.researchPlanHeader}>
        <span className={styles.researchPlanIcon}>🔍</span>
        <h4 className={styles.researchPlanTitle}>
          Planned Searches ({plan.searchTerms.length})
        </h4>
      </div>
      
      <ul className={styles.researchPlanList}>
        {plan.searchTerms.map((term, idx) => (
          <li key={idx} className={styles.researchPlanItem}>
            <span className={styles.searchTerm}>{term}</span>
            <span className={styles.searchStatus}>Pending</span>
          </li>
        ))}
      </ul>
      
      {plan.note && (
        <p className={styles.researchPlanNote}>{plan.note}</p>
      )}
      
      {plan.objectives && plan.objectives.length > 0 && (
        <div className={styles.researchPlanObjectives}>
          <p className={styles.researchPlanObjectivesTitle}>Objectives:</p>
          <ul className={styles.researchPlanObjectivesList}>
            {plan.objectives.map((obj, idx) => (
              <li key={idx}>{obj}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

