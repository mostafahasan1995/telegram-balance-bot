/**
 * The vocabulary every screen is built from.
 *
 * SIX SCREENS, ONE SHAPE. A card is `<Card>` — one radius, one hairline, one padding, defined once
 * in styles.css. A button is `<ActionButton>`. A number is `<Num>`. An operation in a history list
 * is `<OperationRow>`. Nothing below takes a `radius`, a `shadow` or a colour: a screen that wants
 * to look different from the other five is the bug this file exists to prevent.
 *
 * AND EVERY NUMBER GOES THROUGH `<Num>`. A Latin run inside an Arabic sentence is reordered by bidi
 * unless it is isolated — "25,000 – 5,000,000 NSP" is drawn as "NSP 5,000,000 – 25,000", the
 * minimum and the maximum swapped, which is how a player reads a deposit limit of five million.
 * That has already shipped once. `<Num>` is `dir="ltr"` plus `unicode-bidi: isolate` plus tabular
 * figures, and it is not optional.
 */
import { Check, Copy, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { tap } from "@/lib/api/telegram";
import { dayMonthOf } from "@/lib/money";
import { cn } from "@/lib/utils";

/** A screen's heading, with an optional thing on the far side of it (a refresh hint, a link). */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-title font-semibold text-ink">{children}</h2>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * The same heading, numbered — the deposit and withdraw screens are sequences.
 *
 * THE DIGIT IS IN ITS OWN BOX rather than in the sentence ("1 · اختر طريقة الدفع"), because a
 * Latin digit at the head of an Arabic line is a bidi coin toss about which end it lands on.
 */
export function StepTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="app-tile app-tile-brand size-6 text-micro font-bold tabular-nums"
      >
        {step}
      </span>
      <h2 className="min-w-0 truncate text-title font-semibold text-ink">{children}</h2>
    </div>
  );
}

/**
 * The card. There is one.
 *
 * `flush` drops the padding for the two places that need their children to reach the edge — a list
 * with dividers, a card with a picture behind it.
 */
export function Card({
  children,
  className,
  style,
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** The stagger from `enterDelay`, or a background picture's custom property. Nothing else. */
  style?: CSSProperties;
  flush?: boolean;
}) {
  return (
    <div style={style} className={cn(flush ? "app-card-flush" : "app-card", className)}>
      {children}
    </div>
  );
}

/** The one elevated surface a screen gets: the balance, the account panel. */
export function Hero({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section style={style} className={cn("app-hero", className)}>
      {children}
    </section>
  );
}

/** Any Latin run inside Arabic: a figure, an id, a time, a currency code, a limit. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={cn("app-num", className)}>
      {children}
    </span>
  );
}

/**
 * An amount and its unit, as one thing.
 *
 * THE ROW IS NOT `dir="ltr"`. Flipping the container would pull the whole group to the left edge of
 * an otherwise right-aligned card, which is half of what "غير متناسق" meant; the figure itself
 * carries its own direction and the unit sits beside it, where Arabic puts it.
 */
export function Money({
  amount,
  currency,
  className,
  unitClassName,
  fade = false,
}: {
  amount: string;
  currency: string;
  className?: string;
  unitClassName?: string;
  /** For a figure that is re-read while the player watches it — the balance, and only that. */
  fade?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-baseline gap-1.5", className)}>
      <Num className="min-w-0 truncate">
        {fade ? <FadingValue value={amount} /> : amount}
      </Num>
      <span className={cn("shrink-0 text-small font-semibold text-ink-muted", unitClassName)}>
        {currency}
      </span>
    </span>
  );
}

/** Every button in the app. Three tones, no fourth. */
export function ActionButton({
  children,
  onClick,
  tone = "primary",
  icon: Icon,
  disabled = false,
  busy = false,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "secondary" | "soft";
  icon?: LucideIcon;
  disabled?: boolean;
  /** Mid-request: breathes instead of spinning. Does NOT disable — the caller decides that. */
  busy?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "app-btn",
        tone === "primary" && "app-btn-primary",
        tone === "secondary" && "app-btn-secondary",
        tone === "soft" && "app-btn-soft",
        busy && "app-busy",
        className,
      )}
    >
      {Icon !== undefined && <Icon className="size-[18px] shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/**
 * The three colours a request can wear. Deliberately NOT the backend's status enum: a player only
 * needs "waiting", "done" or "no", and mapping the nine real statuses here would put a business
 * rule in a chip. Each screen maps its own rows with `chipOf`.
 */
export type ChipStatus = "pending" | "approved" | "rejected";

const CHIP_LABEL: Record<ChipStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export function StatusChip({ status }: { status: ChipStatus }) {
  const tone =
    status === "approved"
      ? "bg-ok-soft text-ok"
      : status === "pending"
        ? "bg-warn-soft text-warn"
        : "bg-bad-soft text-bad";

  return (
    <span
      className={cn(
        // shrink-0: it is the short half of a flex row whose other half is a wallet address.
        // Without it the chip is what gives way, and "قيد المراجعة" wraps to three words.
        "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-semibold",
        tone,
        // Still with someone else. The row behind this chip is re-read every fifteen seconds, and a
        // chip that breathes says "we are watching it" without spending another line of text on it.
        status === "pending" && "app-waiting",
      )}
    >
      {CHIP_LABEL[status]}
    </span>
  );
}

/**
 * A value the player has to copy out: an account number, a wallet address, a login.
 *
 * NO FIXED WIDTH, AND IT WRAPS. This field used to clamp the value at `max-w-[210px]` inside a box
 * that is 188px wide on a 320px screen — the 22px that put a card past the edge of the phone. A
 * TRC20 address is 34 characters of unbreakable Latin, so it breaks anywhere (`.app-code`) and runs
 * onto a second line rather than off the side of the screen. A player verifying an address before
 * sending money needs to SEE it, which is also why it is not truncated.
 */
export function CopyField({
  label,
  value,
  mono = true,
  onPanel = false,
  masked = false,
}: {
  label: string;
  value: string;
  /** A machine identifier: monospaced, LTR, breaks anywhere. False for an Arabic name. */
  mono?: boolean;
  onPanel?: boolean;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 p-3",
        onPanel ? "rounded-md border border-white/10 bg-white/5" : "app-inset",
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "mb-1 text-micro font-medium",
            onPanel ? "text-panel-foreground/60" : "text-ink-muted",
          )}
        >
          {label}
        </div>
        <button
          type="button"
          onClick={() => masked && setRevealed((current) => !current)}
          dir={mono ? "ltr" : undefined}
          className={cn(
            "block w-full text-start text-small transition-opacity active:opacity-60",
            mono ? "app-code" : "break-words",
            onPanel ? "text-panel-foreground" : "text-ink",
          )}
        >
          {revealed ? value : "••••••••••••"}
        </button>
      </div>
      <button
        type="button"
        aria-label={`نسخ ${label}`}
        onClick={() => {
          tap();
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className={cn(
          "app-tile size-9 shrink-0 transition active:scale-90",
          onPanel
            ? "bg-white/10 text-panel-foreground"
            : "border border-hairline bg-card text-ink-muted",
        )}
      >
        {copied ? (
          <Check className="app-value size-4 text-brand-ink" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </div>
  );
}

/** The one place that decides which colour a deposit or withdrawal wears. */
export function chipOf(status: string): ChipStatus {
  if (status === "CREDITED" || status === "APPROVED" || status === "PAID") return "approved";
  if (
    status === "REJECTED" ||
    status === "EXPIRED" ||
    status === "CANCELLED" ||
    status === "FAILED"
  ) {
    return "rejected";
  }
  return "pending";
}

/**
 * One operation in a history list — a deposit, a withdrawal, the two the home screen shows.
 *
 * ONE COMPONENT FOR ALL THREE LISTS. They were three near-identical blocks of JSX, which is how
 * two of them ended up without a `min-w-0` and pushed their cards off the screen the moment a
 * method name and a short id shared a line.
 */
export function OperationRow({
  at,
  amount,
  currency,
  meta,
  status,
  index,
}: {
  /** ISO-8601, as the backend sends it. */
  at: string;
  amount: string;
  currency: string;
  /** The line under the figure. Empty parts are dropped, the rest joined with a dot. */
  meta: readonly string[];
  status: ChipStatus;
  index: number;
}) {
  const { day, month } = dayMonthOf(at);
  const line = meta.filter((part) => part.length > 0).join(" · ");

  return (
    <Card style={enterDelay(index)} className="app-enter flex items-center gap-3">
      <span className="app-tile flex size-11 flex-col justify-center gap-0.5">
        <Num className="text-micro font-bold text-ink">{day}</Num>
        {/* Two of the twelve Arabic month names are wider than the tile. The tile stays 44px. */}
        <span className="w-full truncate px-1 text-center text-nano leading-none">{month}</span>
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <Money amount={amount} currency={currency} className="text-body font-semibold text-ink" />
        {line.length > 0 && <div className="truncate text-micro text-ink-muted">{line}</div>}
      </div>
      <StatusChip status={status} />
    </Card>
  );
}

/** A line of advice at the foot of a screen. Same shape on all three screens that have one. */
export function Note({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="app-tile app-tile-brand mt-0.5 size-8">
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-small text-ink-muted">{children}</p>
    </Card>
  );
}

/**
 * A muted line while a query is in flight.
 *
 * STILL HERE, BUT NO LONGER THE DEFAULT. A sentence where content is about to appear is a screen
 * that jumps twice — once to the sentence, once to the answer. It is kept for the two places that
 * have no shape to stand in for (a panel the player just asked to open), and everything with a
 * known shape uses the skeletons below instead.
 */
export function Loading({ label = "جارٍ التحميل…" }: { label?: string }) {
  return <p className="py-6 text-center text-small text-ink-muted">{label}</p>;
}

/**
 * A block standing in for something that has not arrived yet.
 *
 * SIZED BY ITS CALLER, always. A skeleton whose box is not the box of the real thing is worse than
 * no skeleton at all: the screen settles, the player starts reading, and then it moves.
 */
export function Skeleton({ className, onPanel = false }: { className?: string; onPanel?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn("app-skeleton", onPanel && "app-skeleton-panel", className)}
    />
  );
}

/**
 * What a group of skeletons announces.
 *
 * THE BLOCKS THEMSELVES ARE `aria-hidden`, so without this a screen reader would be told nothing at
 * all where the old "جارٍ التحميل…" used to be read out. One label per group, not per block.
 */
const LOADING_ARIA = { role: "status", "aria-label": "جارٍ التحميل…" } as const;

/** The hero's balance: the figure, then the state row under it. Exactly their boxes. */
export function BalanceSkeleton() {
  return (
    <div {...LOADING_ARIA} className="space-y-3">
      <Skeleton className="h-10 w-56 rounded-md" />
      <Skeleton className="h-6 w-40 rounded-full" />
    </div>
  );
}

/** Payment methods as the home screen lists them — full-width rows, 76px like every other row. */
export function MethodRowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="space-y-2.5">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[76px] rounded-xl" />
      ))}
    </div>
  );
}

/** Payment methods as the deposit and withdraw screens offer them — a two-column grid. */
export function MethodCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[116px] rounded-xl" />
      ))}
    </div>
  );
}

/** A history list: date tile, two lines, a chip — the 76px of a real `<OperationRow>`. */
export function RowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="space-y-2.5">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[76px] rounded-xl" />
      ))}
    </div>
  );
}

/**
 * An empty list, in the app's own voice.
 *
 * A BARE LINE OF GREY TEXT READS AS A FAILURE — "لا توجد عمليات بعد." on its own looks like the
 * screen gave up. The same sentence inside the card idiom the rest of the app uses, with the icon
 * of the thing that is missing, reads as "nothing yet", which is what it means.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <Card className="app-enter flex flex-col items-center gap-2 px-5 py-8 text-center">
      <span className="app-tile size-12 rounded-md">
        <Icon className="size-5" />
      </span>
      <p className="text-body font-semibold text-ink">{title}</p>
      {hint !== undefined && <p className="text-small text-ink-muted">{hint}</p>}
    </Card>
  );
}

/**
 * A value that fades when it changes instead of snapping to the new one.
 *
 * KEYED ON THE VALUE, so React drops the old node and mounts a new one and the CSS enter animation
 * runs again. A piece of state and a timer would say the same thing with three more ways to go
 * wrong. It is inline-block because a transform does nothing to a plain inline span.
 */
export function FadingValue({ value, className }: { value: string; className?: string }) {
  return (
    <span key={value} className={cn("app-value inline-block", className)}>
      {value}
    </span>
  );
}

/**
 * A background refetch, made visible.
 *
 * THE LISTS HERE POLL ON A TIMER. A row that changes its status on its own, with nothing on screen
 * to explain why, reads as a glitch; four grey words and a breathing dot turn it into news. It sits
 * in a row with a fixed minimum height, so appearing and disappearing moves nothing.
 */
export function Refreshing({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="app-enter inline-flex items-center gap-1.5 text-micro text-ink-muted">
      <span aria-hidden="true" className="app-waiting size-1.5 rounded-full bg-brand-ink" />
      جارٍ التحديث…
    </span>
  );
}

/**
 * The stagger a list uses as it arrives.
 *
 * CAPPED ON PURPOSE: twenty deposits at 35ms each would take most of a second to finish appearing,
 * and the twentieth row is not worth waiting for. After the sixth they all arrive together.
 */
export function enterDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 5) * 35}ms` };
}

/** What the server said, verbatim — it is already Arabic and already written for the player. */
export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="app-enter space-y-2 rounded-xl bg-bad-soft px-4 py-3 text-center">
      <p className="text-small text-bad">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={() => {
            tap();
            onRetry();
          }}
          className="text-micro font-semibold text-bad underline underline-offset-4"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
