"use client";

import ThemeToggle from "@/components/ThemeToggle";
import FeedbackButton from "@/components/FeedbackButton";
import styles from "@/styles/TopRightActions.module.css";

export default function TopRightActions() {
  return (
    <div className={styles.wrapper}>
      <FeedbackButton />
      <ThemeToggle />
    </div>
  );
}
