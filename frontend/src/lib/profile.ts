// AppShell fetches the profile once on mount to render the sidebar
// (username subtitle, or the full "user greeting" header style/avatar
// - see SidebarBrand). Whoever else changes the profile (Settings'
// name/email/phone save, its theme/language selects, the picture
// upload) needs a way to tell that already-mounted sidebar about the
// new data - the browser's own "storage" event doesn't fire in the
// same tab that made the change, so without this the sidebar would
// show stale info until the next full page navigation remounted it.
import { Profile } from "@/types";

const PROFILE_UPDATE_EVENT = "expense-tracker-profile-update";

export function broadcastProfileUpdate(profile: Profile) {
  window.dispatchEvent(new CustomEvent<Profile>(PROFILE_UPDATE_EVENT, { detail: profile }));
}

/** Subscribes to broadcastProfileUpdate() calls made anywhere in this
 * tab. Returns an unsubscribe function, meant for a useEffect cleanup. */
export function onProfileUpdate(callback: (profile: Profile) => void): () => void {
  function handler(e: Event) {
    callback((e as CustomEvent<Profile>).detail);
  }
  window.addEventListener(PROFILE_UPDATE_EVENT, handler);
  return () => window.removeEventListener(PROFILE_UPDATE_EVENT, handler);
}
