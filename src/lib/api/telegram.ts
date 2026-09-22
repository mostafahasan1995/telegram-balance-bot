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
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  HapticFeedback?: { impactOccurred?: (style: string) => void };
  openLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function webApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** The signed blob, or null when this is not a Telegram webview (or Telegram gave us an empty one). */
export function initData(): string | null {
  const data = webApp()?.initData;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

/** Tells Telegram the app has painted, and asks for the full height. Safe to call anywhere. */
export function readyAndExpand(): void {
  const app = webApp();
  app?.ready?.();
  app?.expand?.();
}

/** A short tap, where the platform supports it. Never throws on a platform that does not. */
export function tap(): void {
  webApp()?.HapticFeedback?.impactOccurred?.('light');
}

/** Opens an external site in the host's browser rather than inside the webview. */
export function openExternal(url: string): void {
  const app = webApp();
  if (app?.openLink !== undefined) app.openLink(url);
  else if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
}
