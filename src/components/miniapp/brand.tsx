/**
 * The operator's skin: a name, a logo, a colour, two background pictures and a line of copy.
 *
 * NOTHING HERE MAY DELAY A SINGLE PIXEL. `GET /v1/app/:slug/branding` is a public read that races
 * the sign-in, and the screens do not wait for it: every field falls back to something the app
 * already looks good in, and an operator who has configured nothing at all gets exactly the design
 * that shipped. The rule is "branding decorates, branding never gates" — there is no `isPending`
 * branch anywhere below, on purpose.
 *
 * THE COLOUR IS APPLIED AS CSS CUSTOM PROPERTIES ON THE APP ROOT, not passed down as props. The
 * theme already routes every `bg-brand` / `text-brand-ink` / `ring-brand` through `--brand` and
 * friends (see styles.css), so setting four variables on one element re-skins all six screens
 * without a component knowing that operators have colours.
 *
 * AND THE OPERATOR'S COLOUR IS NOT TRUSTED TO BE READABLE. It is picked in a dashboard by a person
 * with a logo to match, so it can arrive as a pale yellow — which is a fine button fill and an
 * illegible label. `brandStyle` measures it and chooses the text colour that goes on top, and a
 * separate darkened `--brand-ink` for brand-coloured TEXT on a white card.
 */
import { useEffect, useState, type CSSProperties } from "react";

import { useBranding } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

/** What the header says before branding lands, and for an operator who set no title. */
const DEFAULT_TITLE = "الكاشير";

export interface BrandView {
  /** Always a non-empty Arabic string: the operator's title, or the app's own. */
  title: string;
  tagline: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  wheelBackgroundUrl: string | null;
  /** Only a fallback — a screen that has a wallet or a method in hand uses ITS currency. */
  currencyCode: string | null;
  /** The custom properties to spread onto the app root. Empty when no colour was configured. */
  style: CSSProperties;
}

/**
 * The operator's branding, already made safe to render.
 *
 * Safe to call from anywhere: it is one cached query, and it never suspends or throws.
 */
export function useBrand(): BrandView {
  const { data } = useBranding();

  const title = textOf(data?.title) ?? DEFAULT_TITLE;

  // The title Telegram prints above the webview. It costs one assignment and it is the first
  // Arabic word a player sees, so it is worth doing.
  useEffect(() => {
    if (typeof document !== "undefined") document.title = title;
  }, [title]);

  return {
    title,
    tagline: textOf(data?.tagline),
    logoUrl: safeUrl(data?.logoUrl),
    backgroundUrl: safeUrl(data?.backgroundUrl),
    wheelBackgroundUrl: safeUrl(data?.wheelBackgroundUrl),
    currencyCode: textOf(data?.currencyCode),
    style: brandStyle(data?.brandColor),
  };
}

/**
 * The operator's picture, behind every screen.
 *
 * Fixed, `z-index: -1` and `pointer-events: none`, so it can finish downloading at any moment
 * without moving, covering or catching anything. Renders nothing at all when there is no picture,
 * which is why the app root must not paint its own opaque background — the body's does that, and
 * this layer sits between the two.
 */
export function AppBackdrop({ url }: { url: string | null }) {
  if (url === null) return null;
  return (
    <div
      aria-hidden="true"
      className="app-backdrop"
      style={cssVars({ "--app-backdrop-image": `url("${url}")` })}
    />
  );
}

/** The same picture trick for a single card — the wheel, and only the wheel. */
export function figureBackground(url: string | null): CSSProperties {
  if (url === null) return {};
  return cssVars({ "--app-figure-image": `url("${url}")` });
}

/**
 * The header: who the player is dealing with.
 *
 * THE MARK IS ALWAYS 40px, logo or no logo. An operator's logo arrives a beat after first paint,
 * and a header that grows a tile when it lands would shove the title sideways under the player's
 * eye — so the tile is always there and the image simply fills it.
 */
export function AppHeader({ brand }: { brand: BrandView }) {
  return (
    <header className="flex items-center gap-3 pb-4 pt-5">
      <BrandMark
        key={brand.logoUrl ?? "no-logo"}
        title={brand.title}
        logoUrl={brand.logoUrl}
        className="size-10 text-title"
      />
      <h1 className="min-w-0 flex-1 truncate text-title font-semibold text-ink">{brand.title}</h1>
    </header>
  );
}

/**
 * The logo, or the first letter of the name in the operator's colour.
 *
 * A LOGO THAT DOES NOT LOAD FALLS BACK TO THE LETTER rather than to the browser's broken-image
 * glyph: the URL comes from a dashboard field, it can be a typo, and a cashier with a torn-paper
 * icon in its header does not look like somewhere to send money.
 */
export function BrandMark({
  title,
  logoUrl,
  className,
}: {
  title: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = cn("app-tile app-tile-brand font-semibold", className ?? "size-10 text-title");

  if (logoUrl !== null && !broken) {
    return (
      <span className={box}>
        <img
          src={logoUrl}
          alt=""
          className="size-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span className={box} aria-hidden="true">
      {title.trim().charAt(0)}
    </span>
  );
}

/**
 * `brandColor` as the four variables the theme reads.
 *
 * Returns `{}` for anything it cannot measure — a null, a named colour, an `oklch(...)` string —
 * because a colour we cannot check the contrast of is worse than the app's own, which is already
 * known to be readable.
 */
function brandStyle(color: string | null | undefined): CSSProperties {
  if (typeof color !== "string") return {};
  const rgb = rgbOf(color);
  if (rgb === null) return {};

  const light = luminance(rgb) > 0.24;
  return cssVars({
    "--brand": color,
    "--ring": color,
    // What goes ON the colour. A pale brand takes the app's ink; a deep one takes near-white.
    "--brand-foreground": light ? "var(--ink)" : "var(--panel-foreground)",
    // The colour AS text, on a white card. Anything not already dark is pulled toward the ink
    // until it clears 4.5:1 — the figure a player reads in sunlight is never a decision a
    // dashboard colour picker gets to make.
    "--brand-ink": light
      ? `color-mix(in oklab, ${color} 45%, var(--ink))`
      : `color-mix(in oklab, ${color} 88%, var(--ink))`,
    // A tint of the colour on the card, for the selected method and the active tab.
    "--brand-soft": `color-mix(in oklab, ${color} 13%, var(--card))`,
  });
}

/** `#abc` / `#aabbcc`, the two spellings a dashboard colour input produces. */
function rgbOf(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r = "0", g = "0", b = "0"] = hex.split("");
    return [pair(r + r), pair(g + g), pair(b + b)];
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [pair(hex.slice(0, 2)), pair(hex.slice(2, 4)), pair(hex.slice(4, 6))];
  }
  return null;
}

function pair(hex: string): number {
  return Number.parseInt(hex, 16);
}

/** sRGB relative luminance, the number a contrast ratio is built out of. */
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/**
 * A URL we are willing to put in a `url()` or an `<img src>`.
 *
 * HTTPS or same-origin only, and not one character of whitespace, quote, bracket or backslash —
 * the value ends up inside a CSS custom property, and a string that cannot contain a delimiter
 * cannot become one. Anything else is treated as "no picture", which every caller already handles.
 */
const SAFE_URL = /^(?:https:\/\/|\/)[^\s"'()<>\\;]+$/;

function safeUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

/** A non-empty string, or null. An operator who typed spaces into a field configured nothing. */
function textOf(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Custom properties are not in `CSSProperties`; this is the one place that says so. */
function cssVars(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}
