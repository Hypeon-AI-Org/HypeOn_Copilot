"use client";

import { useEffect, useState } from "react";
import Portal from "./Portal";
import styles from "../styles/BetaVersionModal.module.css";

type BetaVersionModalProps = {
  onClose: (dontShowAgain?: boolean) => void;
};

export default function BetaVersionModal({ onClose }: BetaVersionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Portal>
      <div className={styles.overlay} onClick={() => onClose(dontShowAgain)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.badge}>BETA</div>
            <button className={styles.closeBtn} onClick={() => onClose(dontShowAgain)}>
              ✕
            </button>
          </div>
          
          <div className={styles.content}>
            <h2 className={styles.title}>Welcome to HypeOn Copilot Beta</h2>
            <p className={styles.message}>
              This is the beta version of HypeOn Copilot. We're continuously working on improvements and new features. 
              More updates are coming soon!
            </p>
            <p className={styles.subMessage}>
              Thank you for being an early adopter. Your feedback helps us build a better product.
            </p>
          </div>

          <div className={styles.footer}>
            <label className={styles.dontShowRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span className={styles.dontShowLabel}>Don’t show again</span>
            </label>

            <button className={styles.continueBtn} onClick={() => onClose(dontShowAgain)}>
              Got it, let's go!
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
