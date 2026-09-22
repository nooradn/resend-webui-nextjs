"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

type Theme = "light" | "dark";

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

const LOG_COLOR: Record<LogKind, string> = {
  info: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
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
  const [theme, setTheme] = useState<Theme>("light");

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
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

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
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
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
    <div className="relative min-h-screen">
      <Button
        id="theme-toggle"
        type="button"
        variant="outline"
        size="icon"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-10"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <main className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center justify-center gap-6 px-4 pb-32 lg:grid-cols-[minmax(0,460px)_minmax(0,500px)]">
        <Card
          id="log-panel"
          className="flex h-[40rem] flex-col gap-0 overflow-hidden py-0"
        >
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b px-4 py-3">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Logs
            </CardTitle>
            <Button
              id="clear-logs"
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setLogs([])}
            >
              Clear
            </Button>
          </CardHeader>
          <div
            id="log-list"
            ref={logListRef}
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
          >
            {logs.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex gap-2 rounded-md px-1.5 py-1 break-words",
                  LOG_COLOR[entry.kind],
                )}
              >
                <time className="shrink-0 text-muted-foreground">
                  {entry.time}
                </time>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="w-full max-w-[500px] justify-self-center">
          <CardHeader>
            <h1
              id="page-title"
              className="font-heading text-center text-2xl font-bold"
            >
              Resend Email Client
            </h1>
          </CardHeader>

          <CardContent>
            <form id="email-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">RESEND_API_KEY</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    name="apiKey"
                    type={revealed ? "text" : "password"}
                    required
                    placeholder="re_..."
                    className="pr-9"
                    value={form.apiKey}
                    onChange={(e) => updateField("apiKey", e.target.value)}
                  />
                  <Button
                    id="toggle-api-key"
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={revealed ? "Hide API key" : "Show API key"}
                    aria-pressed={revealed}
                    onClick={() => setRevealed((v) => !v)}
                    className="absolute top-0.5 right-0.5"
                  >
                    {revealed ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fromName">Sender Name (optional)</Label>
                <Input
                  id="fromName"
                  name="fromName"
                  type="text"
                  placeholder="Acme"
                  value={form.fromName}
                  onChange={(e) => updateField("fromName", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fromEmail">Sender Email</Label>
                <Input
                  id="fromEmail"
                  name="fromEmail"
                  type="email"
                  required
                  placeholder="onboarding@resend.dev"
                  value={form.fromEmail}
                  onChange={(e) => updateField("fromEmail", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="to">To (destination)</Label>
                <Input
                  id="to"
                  name="to"
                  type="email"
                  required
                  placeholder="hello@example.com"
                  value={form.to}
                  onChange={(e) => updateField("to", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  placeholder="Hello!"
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content">Content (HTML supported)</Label>
                <Textarea
                  id="content"
                  name="content"
                  required
                  rows={6}
                  className="min-h-[120px]"
                  placeholder="<p>Hello world!</p>"
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? "Sending..." : "Send Email"}
              </Button>
            </form>

            {result && (
              <div
                id="result"
                className={cn(
                  "mt-4 rounded-lg border px-3 py-3 text-sm",
                  result.kind === "success"
                    ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
                dangerouslySetInnerHTML={{ __html: result.html }}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
