// Login/register/logout - each just gets a token from the Django API
// (POST /api/token/ or /api/register/) and stores it via lib/api.ts's
// getToken/setToken. There's no server-side session here: every
// authenticated page checks getToken() client-side and redirects to
// /login if it's missing (see components/RequireAuth.tsx).
import { apiFetch, clearToken, setToken } from "./api";

export async function login(username: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ token: string }>("/api/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
}

export async function register(username: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ token: string }>("/api/register/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
}

export function logout(): void {
  clearToken();
}
