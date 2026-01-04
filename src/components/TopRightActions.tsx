"use client";

import ThemeToggle from "@/components/ThemeToggle";
import FeedbackButton from "@/components/FeedbackButton";

export default function TopRightActions() {
  return (
    <div className="fixed top-6 right-35 z-[99999]">

          <FeedbackButton />
        <ThemeToggle />
      
    </div>
  );
}
