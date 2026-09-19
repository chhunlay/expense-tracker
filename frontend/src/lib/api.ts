// Thin fetch wrapper around the Django/Ninja API - handles the base
// URL, the Authorization: Token header, and turning a non-2xx response
// into a thrown Error with the server's own message (Ninja's
// {"detail": "..."} shape) instead of a bare "Failed to fetch" the
// caller would otherwise have to unpack itself.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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

/** Flattens the API's error shape ({"detail": "msg"}, or occasionally a
 * raw {"field": ["msg"]} from a Pydantic validation error) into one string. */
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

/** A 401 means the stored token is stale (wrong/expired, or - as
 * happened once during development - the whole backend database got
 * reset out from under it). Clearing it and bouncing to /login is far
 * more useful than leaving every page stuck on a generic "couldn't
 * load" error with no way out. */
function handleUnauthorized() {
  clearToken();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    // A plain module (not a component/hook) can't call useRouter() -
    // a full page navigation is fine here anyway, since a stale/
    // invalid token means every bit of in-memory app state needs to
    // be thrown away regardless.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  // A FormData body (profile picture upload) needs the browser to set
  // its own multipart/form-data Content-Type with the boundary -
  // setting it ourselves would break the upload.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Token ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new ApiError(extractErrorMessage(body), res.status);
  }
  return body as T;
}

/** For a file-download endpoint (export CSV/XLSX) - apiFetch always
 * parses JSON, which a file response isn't, so this fetches the raw
 * bytes with the same auth header and triggers the browser's normal
 * "Save As" flow via a throwaway <a download> link, the same outcome
 * clicking the old Django export links gave you. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Token ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) handleUnauthorized();
    throw new ApiError(extractErrorMessage(body), res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
