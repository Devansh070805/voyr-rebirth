export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const USER_ID_KEY = "voyr_user_id";
const ACCESS_TOKEN_KEY = "voyr_access_token";

/**
 * Get the current user ID from localStorage.
 * Returns null if not authenticated or running server-side.
 */
function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Auth headers for API requests (user id + bearer token when available).
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const userId = getUserId();
  const token = getAccessToken();
  if (userId) headers["x-user-id"] = userId;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * fetch with auth headers; on 401 attempts token refresh then retries once.
 */
export async function fetchWithAuth(
  input: string,
  init: RequestInit = {},
  refreshAccessToken?: () => Promise<void>,
): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  let res = await fetch(input, { ...init, headers });
  if (res.status === 401 && refreshAccessToken) {
    try {
      await refreshAccessToken();
      res = await fetch(input, {
        ...init,
        headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string> | undefined) },
      });
    } catch {
      // caller handles failed auth
    }
  }
  return res;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DESTINATION_IMAGES: Record<string, string> = {
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=400&q=80",
  maldives: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=400&q=80",
  switzerland: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=400&q=80",
  thailand: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=400&q=80",
  japan: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80",
  europe: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=400&q=80",
  default: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=80",
};

export function getDestinationImage(destination: string | null): string {
  if (!destination) return DESTINATION_IMAGES.default;
  const key = Object.keys(DESTINATION_IMAGES).find((k) =>
    destination.toLowerCase().includes(k),
  );
  return key ? DESTINATION_IMAGES[key] : DESTINATION_IMAGES.default;
}
