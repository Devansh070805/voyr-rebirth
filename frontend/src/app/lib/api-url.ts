import { API_BASE_URL, getAuthHeaders } from "./utils";

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

/** Same as user auth — admin is enforced server-side via ADMIN_EMAILS / ADMIN_USER_IDS. */
export function getAdminHeaders(): Record<string, string> {
  return getAuthHeaders();
}
