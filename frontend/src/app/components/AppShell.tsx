"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PiPlusBold,
  PiChatCircleDotsFill,
  PiBriefcaseFill,
  PiCalendarBlankFill,
  PiBookmarkSimpleFill,
  PiBellFill,
  PiSignOutFill,
  PiUserFill,
  PiMapPinFill,
} from "react-icons/pi";
import { useAuth } from "../auth/context";
import { getUnreadNotificationCount } from "../lib/notifications-storage";
import { formatRelativeTimeShort } from "../lib/format-time";
import { getDestinationImage } from "../lib/utils";


export interface SidebarConversation {
  id: string;
  title: string;
  destination: string | null;
  updated_at: string;
}


const navItems: { icon: React.ReactNode; label: string; href: string }[] = [
  { icon: <PiChatCircleDotsFill className="h-[18px] w-[18px]" />, label: "Chat", href: "/chat" },
  { icon: <PiBriefcaseFill className="h-[18px] w-[18px]" />, label: "My Trips", href: "/trips" },
  { icon: <PiCalendarBlankFill className="h-[18px] w-[18px]" />, label: "Bookings", href: "/bookings" },
  { icon: <PiBookmarkSimpleFill className="h-[18px] w-[18px]" />, label: "Saved", href: "/saved" },
  { icon: <PiBellFill className="h-[18px] w-[18px]" />, label: "Notifications", href: "/notifications" },
];

export default function AppShell({
  children,
  activePage,
  conversations,
  activeConversationId,
  onConversationClick,
  onNewChat,
}: {
  children: React.ReactNode;
  activePage: string;
  conversations?: SidebarConversation[];
  activeConversationId?: string | null;
  onConversationClick?: (id: string) => void;
  onNewChat?: () => void;
}) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const hasDbConversations = conversations && conversations.length > 0;

  useEffect(() => {
    if (conversations?.length) {
      setUnreadCount(getUnreadNotificationCount(conversations.map((c) => c.id)));
    } else {
      setUnreadCount(0);
    }
  }, [conversations]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const displayEmail = user?.email || "Guest";
  const initials = displayEmail.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-950">
      {/* Sidebar */}
      <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <img src="/images/Voyr-logo.png" alt="Voyr" className="h-11 w-auto" />
          <div>
            <div className="text-lg font-bold leading-none text-slate-950">Voyr</div>
            <div className="mt-0.5 text-[10px] font-medium text-slate-400">AI Travel Planner</div>
          </div>
        </Link>

        {/* New Trip */}
        <button
          onClick={onNewChat}
          className="btn-press mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-200 transition-all duration-200 hover:bg-violet-700 hover:shadow-md hover:shadow-violet-200"
        >
          <PiPlusBold className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" /> New Trip
        </button>

        {/* Nav */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.label === activePage;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-violet-100 text-violet-600 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:translate-x-0.5"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="my-5 border-t border-slate-100" />

        {/* Recent Chats — dynamic from DB or fallback */}
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent Chats</div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {hasDbConversations
            ? conversations.map((conv, idx) => (
                <button
                  key={conv.id}
                  onClick={() => onConversationClick?.(conv.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200 animate-slide-up-sm ${
                    activeConversationId === conv.id
                      ? "bg-violet-50 ring-1 ring-violet-200 shadow-sm"
                      : "hover:bg-slate-50 hover:translate-x-0.5"
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {conv.destination ? (
                    <img
                      src={getDestinationImage(conv.destination)}
                      alt=""
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                      <PiMapPinFill className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-700">{conv.title}</div>
                    <div className="text-[10px] text-slate-400">{formatRelativeTimeShort(conv.updated_at)}</div>
                  </div>
                </button>
              ))
            : (
              <p className="px-2 py-4 text-xs text-slate-400">
                {isAuthenticated
                  ? "No recent chats yet. Start a new trip."
                  : "Sign in to see your trip history."}
              </p>
            )}
        </div>

        {/* User */}
        <div className="relative mt-auto border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
              {isAuthenticated ? initials : <PiUserFill className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-xs font-bold text-slate-800">
                {isAuthenticated ? displayEmail : "Not signed in"}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {isAuthenticated ? "Account" : "Guest mode"}
              </div>
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <PiSignOutFill className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <PiUserFill className="h-4 w-4" /> Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 animate-fade-in overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
