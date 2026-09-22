// Where the mini app finds its backend, and which tenant the page belongs to.
//
// Both are answered at call time, not at build time. CI builds one image per commit and the same
// image is deployed to every environment, so a URL compiled into the bundle would pin that image
// to one backend. Three sources are tried in order; each is the fallback for the one before it.

declare global {
  // Written by the inline script that src/routes/__root.tsx renders into <head>. That script runs
  // while the HTML is still being parsed, so the value is already present before any bundle asks.
  var __CASHIER_API_URL__: string | undefined;

  // vite/client types import.meta.env with a `[key: string]: any` fallback, and
  // noPropertyAccessFromIndexSignature (tsconfig.json) forbids reading index-signature keys with a
  // dot. Declaring the key makes it a real property — and the dotted spelling is also the only one
  // Vite substitutes at build time, so it has to be the one used below.
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }
}

// Callers append paths ("/deposits", "/me"), so a trailing slash here would produce "//".
function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// `process` is absent from tsconfig's `types` (only vite/client is listed) and does not exist in
// the browser at all, so it is read off globalThis rather than referenced directly.
function serverEnv(name: string): string | undefined {
  const proc = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return proc.process?.env?.[name];
}

/**
 * Base URL of the cashier API, never with a trailing slash.
 *
 * Returns "" when nothing is configured and nothing can be derived; callers should treat that as
 * "no backend yet" and issue same-origin relative requests rather than build a broken absolute URL.
 */
export function apiBaseUrl(): string {
  // (a) Injected at runtime by the deploy. This is the one production actually uses: the container
  // is given API_BASE_URL, __root.tsx writes it into the page, and the same image can be pointed at
  // a different backend by restarting it — no rebuild, no per-environment image.
  const injected = globalThis.__CASHIER_API_URL__;
  if (typeof injected === "string" && injected !== "") return withoutTrailingSlash(injected);

  // (b) Build-time, for local dev: `vite dev` against a backend on another port, or a throwaway
  // build aimed at staging. A VITE_ var is frozen into the bundle when it is built, which is
  // exactly why it must not be how production is configured.
  const fromBuild = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromBuild === "string" && fromBuild !== "") return withoutTrailingSlash(fromBuild);

  // (c) The zero-config default, so an ordinary deploy needs no configuration at all: the app is
  // served at app.<domain>/<tenant> and the API at api.<domain>, so swapping the first label of the
  // hostname is the right answer whenever both sit under one domain. Assumes a real domain name.
  if (typeof window !== "undefined") {
    const labels = window.location.hostname.split(".");
    // A single-label host (localhost, a container name) has no first label to spend: "api." on its
    // own is not a hostname, so report "not configured" instead of a URL that can never resolve.
    if (labels.length < 2) return "";
    return withoutTrailingSlash(`${window.location.protocol}//api.${labels.slice(1).join(".")}`);
  }

  // Server render: no location to derive from, so only the container's own env can answer.
  return withoutTrailingSlash(serverEnv("API_BASE_URL") ?? "");
}

/**
 * The tenant whose mini app this page is, or null when the path carries none.
 *
 * The app is served at app.<domain>/<tenant>, so the first path segment is the slug. Always null
 * during SSR — there is no location on the server — which is safe because every tenant-scoped
 * request is made from the browser.
 */
export function tenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  const first = window.location.pathname.split("/").find((segment) => segment !== "");
  return first === undefined ? null : first.toLowerCase();
}
