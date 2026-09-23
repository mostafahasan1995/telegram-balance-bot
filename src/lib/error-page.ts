/**
 * The last page a player can be shown: the server could not render the app at all.
 *
 * IT IS PLAIN HTML WITH ITS OWN STYLES, deliberately — it has to work when the bundle, the theme
 * and the fonts are all unavailable, which is why this one file carries literal colours instead of
 * the design tokens. It is Arabic and RTL like everything else a player reads.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>تعذّر فتح الصفحة</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.7 "IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 24rem; width: 100%; text-align: center; padding: 2rem 1rem; }
      h1 { font-size: 1.0625rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; font-size: 0.8125rem; }
      .actions { display: grid; gap: 0.5rem; }
      a, button { padding: 0.875rem 1rem; border-radius: 1rem; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>تعذّر فتح هذه الصفحة</h1>
      <p>حدث خطأ غير متوقع. يمكنك إعادة المحاولة أو العودة إلى الرئيسية.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">إعادة المحاولة</button>
        <a class="secondary" href="/">العودة إلى الرئيسية</a>
      </div>
    </div>
  </body>
</html>`;
}
