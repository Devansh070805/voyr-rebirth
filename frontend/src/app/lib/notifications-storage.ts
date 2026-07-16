const READ_KEY = "voyr_read_notification_ids";

export function getReadNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markNotificationRead(id: string): void {
  const ids = getReadNotificationIds();
  ids.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export function markAllNotificationsRead(ids: string[]): void {
  localStorage.setItem(READ_KEY, JSON.stringify(ids));
}

export function getUnreadNotificationCount(conversationIds: string[]): number {
  const read = getReadNotificationIds();
  return conversationIds.filter((id) => !read.has(id)).length;
}
