"use client";

import { MessageSquare, X, CheckCircle } from "lucide-react";
import { useState } from "react";
import styles from "@/styles/feedback.module.css";
import Image from "next/image";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const isValid =
    form.name.trim() &&
    form.email.trim() &&
    form.message.trim();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      setLoading(true);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed");

      setSuccess(true);
      setForm({ name: "", email: "", message: "" });

      // auto close after 2s
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.feedback}>
      {/* ICON */}
      <button
  type="button"
  className={styles.icon}
  aria-label="Send feedback"
  title="Send feedback"
  onClick={() => setOpen(true)}
>
  <MessageSquare size={16} />
</button>


      {/* MODAL */}
      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>

            {/* SUCCESS STATE */}
            {success ? (
              <div className={styles.success}>
                <CheckCircle size={42} className={styles.successIcon} />
                <h3 className={styles.successTitle}>
                  Thanks for your feedback!
                </h3>
                <p className={styles.successText}>
                  We really appreciate your input.
                </p>
              </div>
            ) : (
              <>
                <h3 className={styles.title}>Help us improve</h3>
                <p className={styles.subtitle}>
                  All fields are required.
                </p>

                <div className={styles.field}>
                  <label className={styles.label}>Name *</label>
                  <input
                    name="name"
                    className={styles.input}
                    placeholder="Your full name"
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Email *</label>
                  <input
                    name="email"
                    type="email"
                    className={styles.input}
                    placeholder="you@company.com"
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Feedback *</label>
                  <textarea
                    name="message"
                    className={styles.textarea}
                    placeholder="What can we improve?"
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.actions}>
                  <button
                    disabled={!isValid || loading}
                    className={styles.button}
                    onClick={handleSubmit}
                  >
                    {loading ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
