/**
 * The host webview, typed to the parts this app actually uses.
 *
 * `window.Telegram.WebApp` exists only inside Telegram. In a normal browser (a developer opening
 * the URL, a preview deploy) every accessor here returns null and the app falls back to the
 * `/login` code — it must never crash because it was opened outside Telegram.
 */

interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  HapticFeedback?: { impactOccurred?: (style: string) => void };
  openLink?: (url: string) => void;
  /** Bot API 6.9+. Throws on an older client, or while an earlier request is still open. */
  requestWriteAccess?: (callback?: (granted: boolean) => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function webApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/** The signed blob, or null when this is not a Telegram webview (or Telegram gave us an empty one). */
export function initData(): string | null {
  const data = webApp()?.initData;
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** Tells Telegram the app has painted, and asks for the full height. Safe to call anywhere. */
export function readyAndExpand(): void {
  const app = webApp();
  app?.ready?.();
  app?.expand?.();
}

/** A short tap, where the platform supports it. Never throws on a platform that does not. */
export function tap(): void {
  webApp()?.HapticFeedback?.impactOccurred?.("light");
}

/**
 * Asks Telegram to let the operator's bot message this player in private.
 *
 * WHY THE SUPPORT BOX NEEDS IT: the support team's answer is delivered by the bot, in the player's
 * private chat with it — and a bot cannot open that chat. A player who only ever used the mini app
 * and never pressed Start would have their question answered into the void. This shows Telegram's
 * own permission popup (or answers at once when the bot is already allowed).
 *
 * Resolves `true` / `false` with the player's answer, `false` as well when they leave the popup
 * open past `timeoutMs` (the message is sent anyway — this only decides whether to warn), and
 * `null` when there is nothing to ask: outside Telegram, or a client too old for the method. It
 * never rejects, so it can never be the reason a support message is not sent.
 */
export function requestWriteAccess(timeoutMs = 5000): Promise<boolean | null> {
  const app = webApp();
  if (app === null || app.requestWriteAccess === undefined) return Promise.resolve(null);

  // A promise settles once, so whichever of the answer and the timeout comes first wins and the
  // other is ignored — a late answer after the timeout changes nothing.
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
    try {
      app.requestWriteAccess?.((granted) => {
        clearTimeout(timer);
        resolve(granted);
      });
    } catch {
      // WebAppMethodUnsupported (older client) or a request already open: nothing to ask here.
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Opens an external site in the host's browser rather than inside the webview. */
export function openExternal(url: string): void {
  const app = webApp();
  if (app?.openLink !== undefined) app.openLink(url);
  else if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
}
