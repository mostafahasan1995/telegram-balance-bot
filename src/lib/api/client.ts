/**
 * The one door to the backend. Every screen goes through `api()`; nothing else calls fetch.
 *
 * WHAT THIS FILE OWNS, AND WHY IT IS ALL IN ONE PLACE:
 *
 * 1. THE ENVELOPE. The backend answers `{ data: ... }` on success and
 *    `{ error: { code, message, details } }` on failure, and every list route wraps its rows in
 *    `{ data: [...], meta }`. Unwrapping here means a screen writes `deposits.data.map(...)` once
 *    instead of reaching through two layers in every component.
 *
 * 2. THE MESSAGE. `error.message` is ALREADY ARABIC and already written for the player — it comes
 *    from the backend's message catalog. The app therefore shows it verbatim and never invents its
 *    own wording for a failure the server explained. A screen that needs to branch reads `code`,
 *    never the text.
 *
 * 3. THE REFRESH. A 401 means the access token died; the refresh token is exchanged ONCE and the
 *    original request is replayed. Concurrent 401s share a single refresh promise, because two
 *    screens loading at the same time would otherwise each rotate the token and the slower one
 *    would present a token the rotation had already killed.
 */
import { apiUrl } from "./base-url";
import { clearSession, readSession, refreshSession } from "./session";

export { apiUrl, setApiBaseUrl } from "./base-url";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

/** Shown only when the server said nothing we can show — a dead network, a proxy's own 502 page. */
export const GENERIC_ERROR = "تعذّر إتمام العملية حالياً. يرجى المحاولة بعد قليل.";

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sent as `Idempotency-Key`; the backend replays the first answer for a repeated one. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Internal: set while replaying a request after a refresh, so it cannot loop. */
  retried?: boolean;
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const parsed: unknown = await response.json();
    const error = (parsed as { error?: Partial<ApiErrorBody> } | null)?.error;
    if (error !== undefined && typeof error?.message === "string") {
      return new ApiError(response.status, {
        code: typeof error.code === "string" ? error.code : "UNKNOWN",
        message: error.message,
        details: error.details,
      });
    }
  } catch {
    // A body that is not JSON at all: an edge proxy answered, not the API.
  }
  return new ApiError(response.status, { code: "UNKNOWN", message: GENERIC_ERROR });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = readSession();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (session !== null) headers["Authorization"] = `Bearer ${session.accessToken}`;
  if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey;

  // Built up rather than written as one literal: `exactOptionalPropertyTypes` refuses an explicit
  // `undefined` for an optional field, and both `body` and `signal` are optional here.
  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  if (options.signal !== undefined) init.signal = options.signal;

  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    // The request never reached the API: offline, DNS, a blocked origin.
    throw new ApiError(0, { code: "NETWORK", message: GENERIC_ERROR });
  }

  if (response.status === 401 && options.retried !== true && session !== null) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, { ...options, retried: true });
    clearSession();
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;

  const parsed: unknown = await response.json();
  // Success is always enveloped, but a 202 with an empty body is not — treat a missing `data` as
  // the whole body rather than silently handing a screen `undefined`.
  const data = (parsed as { data?: unknown } | null)?.data;
  return (data === undefined ? parsed : data) as T;
}

/** The message to put in front of the player for any thrown value. Never invents a second wording. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return GENERIC_ERROR;
}
