"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import styles from "../styles/ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={styles.toggle}
    >
      {/* TRACK ICONS */}
      <div className={styles.trackIcons}>
        <Sun className={isDark ? styles.sunInactive : styles.sunActive} />
        <Moon className={isDark ? styles.moonActive : styles.moonInactive} />
      </div>

      {/* SLIDING GLASS KNOB */}
      <div
        className={`${styles.knob} ${
          isDark ? styles.knobDark : styles.knobLight
        }`}
      >
        {isDark ? (
          <Moon className={styles.knobIconDark} />
        ) : (
          <Sun className={styles.knobIconLight} />
        )}
      </div>
    </button>
  );
}
