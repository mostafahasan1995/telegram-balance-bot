/**
 * Where the API is, decided once at boot and read by both `client.ts` and `session.ts`.
 *
 * It lives in its own module so those two do not have to import each other: the sign-in needs the
 * URL but not the authenticated client, and the client needs the sign-in's refresh but not its
 * URL resolution. A cycle between them would work in ESM and still be the kind of thing that
 * breaks the day someone adds a top-level constant.
 *
 * An EMPTY base is legitimate: `apiBaseUrl()` answers "" when nothing is configured and the host
 * has no domain to derive from (localhost, a container name), which means "same origin".
 */
let base = "";

export function setApiBaseUrl(url: string): void {
  base = url.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
