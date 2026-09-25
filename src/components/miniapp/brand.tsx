/**
 * The operator's skin, drawn: the picture behind every screen, the header and the logo mark.
 *
 * What the branding says, and how it is made safe to render, is `useBrand` in `use-brand.ts` —
 * read that file's header for the rules ("branding decorates, branding never gates"). This file
 * exports nothing but components, so React Fast Refresh can hot-swap it.
 */
import { useState } from "react";

import { cn } from "@/lib/utils";

import { cssVars, type BrandView } from "./use-brand";

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
