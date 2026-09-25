/**
 * Who the player is, for as long as this webview lives.
 *
 * WHERE THE TOKENS LIVE: in memory, mirrored into sessionStorage. Not localStorage — a Telegram
 * webview is shared with every other mini app on the device, and a refresh token that outlives the
 * session is a credential sitting on disk for no gain: reopening the app re-signs in from initData
 * in one round trip anyway.
 *
 * WHY THE SIGN-IN IS A SINGLE SHARED PROMISE: React 19 mounts components concurrently, so three
 * screens can ask for a session in the same tick. Three POST /v1/auth/telegram calls would each
 * mint a session and the first two would be orphaned. One promise, awaited by all three.
 *
 * WHAT IS NEVER STORED: initData itself (it is a signed blob that expires) and the casino password
 * (read on demand, held only by the component showing it).
 */
import { apiUrl } from "./base-url";
import type { AuthTokens, LoginResult, PlayerView } from "./types";

const STORAGE_KEY = "cashier.session.v1";

export interface Session {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

let current: Session | null = null;
let player: PlayerView | null = null;
let signingIn: Promise<PlayerView> | null = null;
let refreshing: Promise<boolean> | null = null;

function persist(session: Session | null): void {
  current = session;
  try {
    if (session === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private mode, or storage disabled by the host. Memory alone is enough for this session.
  }
}

function restore(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? "",
    };
  } catch {
    return null;
  }
}

export function readSession(): Session | null {
  if (current === null && typeof sessionStorage !== "undefined") current = restore();
  return current;
}

export function currentPlayer(): PlayerView | null {
  return player;
}

export function clearSession(): void {
  player = null;
  persist(null);
}

function store(tokens: AuthTokens): void {
  persist({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  });
}

/** The raw fetch, not `api()`: these two routes are what MINT the credential `api()` attaches. */
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(parsed?.error?.message ?? "sign-in failed");
  }
  const parsed: unknown = await response.json();
  return ((parsed as { data?: unknown }).data ?? parsed) as T;
}

/**
 * Exchanges Telegram's signed initData for a session.
 *
 * THE SLUG IS A KEY SELECTOR, NOT A CLAIM. `tenant` tells the server WHICH OPERATOR'S BOT TOKEN to
 * check the signature against — it is the `<slug>` this app is served under. It does not decide
 * whose player the caller is: the signature does. Naming an operator whose bot did not sign the
 * blob fails verification, so a tampered slug buys nothing.
 *
 * It is REQUIRED. Sending initData without it was refused, the app fell back to its code screen,
 * and every player had to go and find a code for an app Telegram had already signed them into.
 */
export function signIn(initData: string, tenant: string): Promise<PlayerView> {
  if (player !== null) return Promise.resolve(player);
  if (signingIn !== null) return signingIn;

  signingIn = post<LoginResult>("/v1/auth/telegram", { initData, tenant })
    .then((result) => {
      store(result.tokens);
      player = result.player;
      return result.player;
    })
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

/** The `/login` code path, for a client Telegram did not sign (a native app, a desktop browser). */
export function signInWithCode(code: string): Promise<PlayerView> {
  return post<LoginResult>("/v1/auth/bot-code", { code }).then((result) => {
    store(result.tokens);
    player = result.player;
    return result.player;
  });
}

/** True when a fresh access token is in hand. One rotation at a time, shared by every caller. */
export function refreshSession(): Promise<boolean> {
  const session = readSession();
  if (session === null) return Promise.resolve(false);
  if (refreshing !== null) return refreshing;

  refreshing = post<AuthTokens>("/v1/auth/refresh", { refreshToken: session.refreshToken })
    .then((tokens) => {
      store(tokens);
      return true;
    })
    .catch(() => {
      clearSession();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
