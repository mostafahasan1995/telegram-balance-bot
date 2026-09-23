import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

// `process` is not in tsconfig's `types` and does not exist in the browser, so it is read off
// globalThis rather than referenced directly.
function serverApiBaseUrl(): string | undefined {
  const proc = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return proc.process?.env?.["API_BASE_URL"];
}

// Hands the browser the API URL the server was configured with, before any bundle runs, so one
// image can serve every environment. Returns undefined — and therefore renders no tag at all —
// when API_BASE_URL is unset; the app then falls back to deriving api.<domain> from the hostname
// (see src/lib/api/runtime-config.ts).
function apiUrlScripts() {
  // head() runs on the server and then again in the browser. `process` only answers on the server,
  // so in the browser the value is read back off the global the server-rendered script already
  // set: both passes emit the identical tag and hydration has nothing to reconcile.
  const configured =
    typeof window === "undefined" ? serverApiBaseUrl() : globalThis.__CASHIER_API_URL__;

  // This ends up in the page as raw JavaScript, so anything that is not plainly a URL is dropped
  // instead of rendered.
  if (typeof configured !== "string" || !configured.startsWith("http")) return undefined;

  // JSON.stringify quotes it and escapes quotes, backslashes and newlines; "<" is escaped on top
  // of that so a value containing "</script>" cannot close the tag early.
  const literal = JSON.stringify(configured).replace(/</g, "\\u003c");
  return [{ children: `window.__CASHIER_API_URL__ = ${literal};` }];
}

function NotFoundComponent() {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm text-center">
        <p className="app-num text-5xl font-semibold text-ink-muted">404</p>
        <h1 className="mt-3 text-title font-semibold text-ink">الصفحة غير موجودة</h1>
        <p className="mt-1 text-small text-ink-muted">
          الرابط الذي فتحته غير صحيح أو لم يعد متاحاً.
        </p>
        <div className="mt-5">
          <Link to="/" className="app-btn app-btn-primary">
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-title font-semibold text-ink">تعذّر فتح هذه الصفحة</h1>
          <p className="text-small text-ink-muted">
            حدث خطأ غير متوقع. يمكنك إعادة المحاولة أو العودة إلى الرئيسية.
          </p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="app-btn app-btn-primary"
          >
            إعادة المحاولة
          </button>
          <a href="/" className="app-btn app-btn-soft">
            العودة إلى الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Arabic, because Telegram prints this above the webview and it is the first word a player
      // reads. An operator's own title replaces it from `useBrand()` as soon as branding lands.
      { title: "الكاشير" },
      { name: "description", content: "تطبيق مصغر لشحن الرصيد ومتابعة الإيداعات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    // Rendered into <head> by <HeadContent />, ahead of the app bundle in <body>. Omitted
    // entirely when the server has no API_BASE_URL configured.
    scripts: apiUrlScripts(),
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Every string a player reads here is Arabic, so the document says so: `lang` picks the right
    // font and line-breaking, and `dir` makes RTL the default rather than something each screen
    // has to remember to ask for.
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
