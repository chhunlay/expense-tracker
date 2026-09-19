// Thin fetch wrapper around the Django REST Framework API - handles the
// base URL, the Authorization: Token header, and turning a non-2xx
// response into a thrown Error with the server's own message (DRF's
// {"field": ["message"]} / {"detail": "..."} shapes) instead of a bare
// "Failed to fetch" the caller would otherwise have to unpack itself.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "expense-tracker-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private mode, etc.) - the session just
    // won't persist across reloads; not worth failing the login over.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // see setToken
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Flattens DRF's error shapes ({"field": ["msg"]} or {"detail": "msg"}) into one string. */
function extractErrorMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    const firstKey = Object.keys(obj)[0];
    if (firstKey) {
      const value = obj[firstKey];
      const message = Array.isArray(value) ? value[0] : value;
      return `${firstKey}: ${message}`;
    }
  }
  return "Something went wrong";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Token ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(extractErrorMessage(body), res.status);
  }
  return body as T;
}
