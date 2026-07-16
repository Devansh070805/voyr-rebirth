"use client";

import { useState, useEffect, useCallback } from "react";
import { PiBellFill } from "react-icons/pi";
import AppShell from "../components/AppShell";
import ProtectedRoute from "../auth/ProtectedRoute";


interface ConversationItem {
  id: string;
  title: string;
  destination: string | null;
  status: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  accent: string;
  conversationId?: string;
}


import { useApi } from "../auth/context";
import { formatRelativeTime } from "../lib/format-time";
import { getConversationStatusLabel, isBookingPipelineStatus } from "../lib/conversation-status";
import {
  getReadNotificationIds,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/notifications-storage";

function conversationsToNotifications(conversations: ConversationItem[]): Notification[] {
  const readIds = getReadNotificationIds();
  return conversations.map((c) => {
    let title = c.destination ? `${c.title} updated` : "New trip started";
    if (isBookingPipelineStatus(c.status)) {
      title = `${c.title}: ${getConversationStatusLabel(c.status)}`;
    }
    return {
      id: c.id,
      title,
      body: c.last_message
        ? c.last_message.slice(0, 120) + (c.last_message.length > 120 ? "..." : "")
        : `Your trip "${c.title}" has ${c.message_count} messages.`,
      time: formatRelativeTime(c.updated_at),
      read: readIds.has(c.id),
      accent: isBookingPipelineStatus(c.status)
        ? "bg-orange-500"
        : c.destination
          ? "bg-violet-500"
          : "bg-blue-500",
      conversationId: c.id,
    };
  });
}


function NotificationsContent() {
  const { apiFetch } = useApi();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/conversations?limit=20");
      if (res.ok) {
        const data: ConversationItem[] = await res.json();
        setNotifications(conversationsToNotifications(data));
      } else {
        setError("Failed to load notifications");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const ids = notifications.map((n) => n.id);
    markAllNotificationsRead(ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  return (
    <AppShell
      activePage="Notifications"
      conversations={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        destination: null,
        updated_at: new Date().toISOString(),
      }))}
    >
      <div className="px-10 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <PiBellFill className="h-7 w-7 text-violet-600" /> Notifications
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Stay updated on your bookings, payments, and offers.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
              <p className="mt-4 text-sm text-slate-400">Loading notifications...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
            {error}
            <button onClick={fetchNotifications} className="ml-3 font-semibold underline hover:text-red-700">
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
              <PiBellFill className="h-8 w-8 text-violet-300" />
            </div>
            <h3 className="mt-4 font-bold text-slate-500">No notifications</h3>
            <p className="mt-2 text-sm text-slate-400">
              You&apos;re all caught up! Start planning a trip to get updates.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {notifications.map((n, i) => (
              <a
                key={n.id}
                href={n.conversationId ? `/chat?id=${n.conversationId}` : "/chat"}
                onClick={() => markRead(n.id)}
                className={`flex w-full items-start gap-4 px-6 py-4 text-left transition-colors ${
                  i !== notifications.length - 1 ? "border-b border-slate-100" : ""
                } ${n.read ? "hover:bg-slate-50/50" : "bg-violet-50/30 hover:bg-violet-50/50"}`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.read ? "bg-slate-200" : n.accent
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3
                      className={`text-sm ${
                        n.read
                          ? "font-medium text-slate-600"
                          : "font-semibold text-slate-900"
                      }`}
                    >
                      {n.title}
                    </h3>
                    <span className="shrink-0 text-xs text-slate-400">{n.time}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{n.body}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
