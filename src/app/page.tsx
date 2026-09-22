"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LogKind = "info" | "success" | "error";

type LogEntry = {
  id: number;
  kind: LogKind;
  message: string;
  time: string;
};

type Result = {
  kind: "success" | "error";
  html: string;
};

const STORAGE_KEY = "resend-form";
const FIELD_NAMES = [
  "apiKey",
  "fromName",
  "fromEmail",
  "to",
  "subject",
  "content",
] as const;

type FieldName = (typeof FIELD_NAMES)[number];

type FormState = Record<FieldName, string>;

const EMPTY_FORM: FormState = {
  apiKey: "",
  fromName: "",
  fromEmail: "",
  to: "",
  subject: "",
  content: "",
};

function formatTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Home() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const logListRef = useRef<HTMLDivElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastCheckedKey = useRef("");
  const logId = useRef(0);

  const log = useCallback((kind: LogKind, message: string) => {
    const time = formatTime();
    const id = ++logId.current;
    setLogs((prev) => [...prev, { id, kind, message, time }]);
  }, []);

  const checkApiKey = useCallback(
    async (apiKey: string) => {
      if (!apiKey || apiKey === lastCheckedKey.current) return;

      log("info", "Checking API key…");

      try {
        const res = await fetch("/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });

        const json = await res.json();
        lastCheckedKey.current = apiKey;

        if (json.code === "restricted_api_key") {
          log(
            "error",
            "API key is valid, but restricted to sending only — cannot list domains.",
          );
          return;
        }

        if (!res.ok) {
          log("error", `API key rejected — ${json.error || "unknown error"}`);
          return;
        }

        log("success", "API key is valid.");

        const domains = (json.domains ?? []) as {
          name: string;
          status: string;
        }[];

        if (domains.length === 0) {
          log("info", "No domains on this account.");
          return;
        }

        log("info", `Domains available (${domains.length}):`);
        for (const domain of domains) {
          log("info", `• ${domain.name} — ${domain.status}`);
        }
      } catch {
        log("error", "Could not reach the local server.");
      }
    },
    [log],
  );

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const loaded = { ...EMPTY_FORM };
      for (const name of FIELD_NAMES) {
        const value = saved[name];
        if (typeof value === "string") loaded[name] = value;
      }
      setForm(loaded);

      if (loaded.apiKey.trim()) checkApiKey(loaded.apiKey.trim());
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [checkApiKey]);

  useEffect(() => {
    const el = logListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => clearTimeout(checkTimer.current);
  }, []);

  function updateField(name: FieldName, value: string) {
    const next = { ...form, [name]: value };
    setForm(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    if (name === "apiKey") {
      clearTimeout(checkTimer.current);
      checkTimer.current = setTimeout(() => checkApiKey(value.trim()), 700);
    }
  }

  function buildFrom(): string {
    const name = form.fromName.trim();
    const email = form.fromEmail.trim();
    return name ? `${name} <${email}>` : email;
  }

  function toggleTheme() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  }

  function show(kind: "success" | "error", html: string) {
    setResult({ kind, html });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = {
      apiKey: form.apiKey.trim(),
      from: buildFrom(),
      to: form.to.trim(),
      subject: form.subject.trim(),
      content: form.content,
    };

    setSending(true);
    setResult(null);
    log("info", `Sending email to ${data.to}…`);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        log("error", `Send failed — ${json.error || "Unknown error"}`);
        show("error", `Error: ${json.error || "Unknown error"}`);
      } else {
        log("success", `Email sent to ${data.to} (id ${json.id}).`);
        show("success", `Email sent! ID: <code>${json.id}</code>`);
        updateField("content", "");
      }
    } catch {
      log("error", "Send failed — network error.");
      show("error", "Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        id="theme-toggle"
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        <span className="icon-sun">☀</span>
        <span className="icon-moon">☾</span>
      </button>

      <main className="layout">
        <aside className="logs">
          <div className="logs-head">
            <h2>Logs</h2>
            <button
              id="clear-logs"
              type="button"
              className="logs-clear"
              onClick={() => setLogs([])}
            >
              Clear
            </button>
          </div>
          <div
            id="log-list"
            className="logs-body"
            role="log"
            aria-live="polite"
            ref={logListRef}
          >
            {logs.map((entry) => (
              <div key={entry.id} className={`log-entry log-${entry.kind}`}>
                <time>{entry.time}</time>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="card">
          <h1>Resend Email Client</h1>

          <form id="email-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="apiKey">RESEND_API_KEY</label>
              <div className="input-wrap">
                <input
                  id="apiKey"
                  name="apiKey"
                  type={revealed ? "text" : "password"}
                  required
                  placeholder="re_..."
                  value={form.apiKey}
                  onChange={(e) => updateField("apiKey", e.target.value)}
                />
                <button
                  id="toggle-api-key"
                  type="button"
                  className="reveal"
                  aria-label={revealed ? "Hide API key" : "Show API key"}
                  aria-pressed={revealed}
                  onClick={() => setRevealed((v) => !v)}
                >
                  <svg
                    className="icon-eye"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg
                    className="icon-eye-off"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                    <path d="M1 1l22 22"></path>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="fromName">Sender Name (optional)</label>
              <input
                id="fromName"
                name="fromName"
                type="text"
                placeholder="Acme"
                value={form.fromName}
                onChange={(e) => updateField("fromName", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fromEmail">Sender Email</label>
              <input
                id="fromEmail"
                name="fromEmail"
                type="email"
                required
                placeholder="onboarding@resend.dev"
                value={form.fromEmail}
                onChange={(e) => updateField("fromEmail", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="to">To (destination)</label>
              <input
                id="to"
                name="to"
                type="email"
                required
                placeholder="hello@example.com"
                value={form.to}
                onChange={(e) => updateField("to", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                placeholder="Hello!"
                value={form.subject}
                onChange={(e) => updateField("subject", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Content (HTML supported)</label>
              <textarea
                id="content"
                name="content"
                required
                rows={6}
                placeholder="<p>Hello world!</p>"
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className="btn" disabled={sending}>
              {sending ? "Sending..." : "Send Email"}
            </button>
          </form>

          {result && (
            <div
              id="result"
              className={`alert ${result.kind}`}
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          )}
        </div>
      </main>
    </>
  );
}
