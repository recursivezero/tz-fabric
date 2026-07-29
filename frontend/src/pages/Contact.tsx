import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import "@/assets/styles/contact.css";
import { FULL_API_URL } from "@/constants";
import { ensureOk, fetchWithTimeout } from "@/utils/http";

type ContactForm = {
  name: string;
  email: string;
  message: string;
};

const EMPTY_FORM: ContactForm = { name: "", email: "", message: "" };

export const ContactUs = () => {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setStatus("Sending…");

    try {
      const response = await fetchWithTimeout(
        `${FULL_API_URL}/contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
        15_000,
      );
      await ensureOk(response, "Unable to send your message.");
      setStatus("Message sent.");
      setForm(EMPTY_FORM);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="contact-container">
      <h2>Contact Us</h2>

      <form onSubmit={handleSubmit}>
        <label>
          <span className="sr-only">Your name</span>
          <input
            name="name"
            autoComplete="name"
            placeholder="Your Name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          <span className="sr-only">Your email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Your Email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          <span className="sr-only">Message</span>
          <textarea
            name="message"
            placeholder="Message"
            value={form.message}
            onChange={handleChange}
            required
          />
        </label>

        <button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      <br />
      <div className="notice">
        <span>Or</span>
        <p>
          You can email us at{" "}
          <a href="mailto:threadzip@gmail.com">
            <mark>threadzip@gmail.com</mark>
          </a>
        </p>
      </div>
      <p className="status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
};
