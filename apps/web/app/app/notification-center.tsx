"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export type DashboardNotification = {
  id: string;
  type: "RSVP_RECEIVED" | "TASK_ASSIGNED" | "TASK_DUE" | "EXPENSE_DUE" | "PROJECT_SHARED" | "QUOTE_RESPONSE_RECEIVED";
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  project: { title: string };
};

type NotificationResponse = {
  items: DashboardNotification[];
  unreadCount: number;
};

export function NotificationCenter({
  onOpen,
}: {
  onOpen: (href: string) => void;
}) {
  const [items, setItems] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    try {
      const result = await api<NotificationResponse>("/notifications");
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar notificações.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(item: DashboardNotification) {
    if (item.readAt) return;
    try {
      await api(`/notifications/${item.id}/read`, { method: "PATCH" });
      const readAt = new Date().toISOString();
      setItems((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, readAt } : notification,
      ));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível actualizar a notificação.");
    }
  }

  async function markAllRead() {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível actualizar as notificações.");
    }
  }

  async function openItem(item: DashboardNotification) {
    await markRead(item);
    setOpen(false);
    onOpen(item.href);
  }

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={unreadCount ? `Notificações, ${unreadCount} por ler` : "Notificações"}
        aria-expanded={open}
        aria-controls="dashboard-notification-panel"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refresh();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span>Notificações</span>
        {unreadCount > 0 && <b aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</b>}
      </button>

      {open && (
        <section className="notification-panel" id="dashboard-notification-panel" aria-label="Notificações dos eventos">
          <header>
            <div>
              <strong>Notificações</strong>
              <small>{unreadCount ? `${unreadCount} por ler` : "Tudo em dia"}</small>
            </div>
            {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}>Marcar todas como lidas</button>}
          </header>
          {error && <p className="notification-error" role="alert">{error}</p>}
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={item.readAt ? "notification-item is-read" : "notification-item is-unread"} onClick={() => void openItem(item)}>
                    <span className="notification-unread-dot" aria-hidden="true" />
                    <span className="notification-copy">
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>{item.project.title} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(item.createdAt))}</small>
                    </span>
                    <span className="notification-arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !error ? (
            <p className="notification-empty">Ainda não há notificações. Avisaremos aqui sobre tarefas, prazos, pagamentos, convidados e partilhas.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
