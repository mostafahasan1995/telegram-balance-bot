import { Check, Copy, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { tap } from "@/lib/api/telegram";
import { cn } from "@/lib/utils";

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-wide text-ink-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Only ever the stagger from `enterDelay` — there is no other inline style a card wants. */
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl bg-card shadow-teller ring-1 ring-hairline",
        className,
      )}
    >
      {children}
    </div>
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
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
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

export function CopyField({
  label,
  value,
  mono = true,
  onPanel = false,
  masked = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onPanel?: boolean;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5",
        onPanel ? "bg-white/5 ring-1 ring-white/10" : "bg-secondary ring-1 ring-hairline",
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            "mb-0.5 text-[10px] font-medium tracking-wide",
            onPanel ? "text-panel-foreground/50" : "text-ink-muted",
          )}
        >
          {label}
        </div>
        <button
          type="button"
          onClick={() => masked && setRevealed((v) => !v)}
          dir="ltr"
          className={cn(
            "block max-w-[210px] truncate text-start text-[13px]",
            "transition-opacity active:opacity-60",
            mono && "font-mono",
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
          "grid size-8 shrink-0 place-items-center rounded-lg transition active:scale-90",
          onPanel
            ? "bg-white/10 text-panel-foreground hover:bg-white/20"
            : "bg-card text-ink-muted ring-1 ring-hairline hover:text-brand",
        )}
      >
        {copied ? (
          <Check className="app-value size-4 text-brand" />
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
 * A muted line while a query is in flight.
 *
 * STILL HERE, BUT NO LONGER THE DEFAULT. A sentence where content is about to appear is a screen
 * that jumps twice — once to the sentence, once to the answer. It is kept for the two places that
 * have no shape to stand in for (a panel the player just asked to open), and everything with a
 * known shape uses the skeletons below instead.
 */
export function Loading({ label = "جارٍ التحميل…" }: { label?: string }) {
  return <p className="px-1 py-6 text-center text-xs text-ink-muted">{label}</p>;
}

/**
 * A block standing in for something that has not arrived yet.
 *
 * SIZED BY ITS CALLER, always. A skeleton whose box is not the box of the real thing is worse than
 * no skeleton at all: the screen settles, the player starts reading, and then it moves.
 */
export function Skeleton({
  className,
  onPanel = false,
}: {
  className?: string;
  onPanel?: boolean;
}) {
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

/** The home screen's balance: the figure, then the sync line under it. */
export function BalanceSkeleton() {
  return (
    <div {...LOADING_ARIA} className="space-y-1.5">
      <Skeleton className="h-9 w-52 rounded-xl" />
      <Skeleton className="h-3.5 w-36 rounded-md" />
    </div>
  );
}

/** Payment methods as the home screen lists them — full-width rows. */
export function MethodRowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}

/** Payment methods as the deposit and withdraw screens offer them — a two-column grid. */
export function MethodCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[108px] rounded-2xl" />
      ))}
    </div>
  );
}

/** A history list: date box, two lines, a chip. Matches the 64px of a real operation card. */
export function RowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div {...LOADING_ARIA} className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-2xl" />
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
    <Card className="app-enter flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div className="grid size-11 place-items-center rounded-2xl bg-secondary text-ink-muted">
        <Icon className="size-5" />
      </div>
      <p className="text-[13px] font-medium">{title}</p>
      {hint !== undefined && (
        <p className="max-w-[240px] text-[11px] leading-relaxed text-ink-muted">{hint}</p>
      )}
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
 * to explain why, reads as a glitch; four grey words and a breathing dot turn it into news. It is
 * smaller than the line it sits beside, so appearing and disappearing moves nothing.
 */
export function Refreshing({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="app-enter inline-flex items-center gap-1.5 text-[10px] text-ink-muted">
      <span aria-hidden="true" className="app-waiting size-1.5 rounded-full bg-brand" />
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
    <div className="app-enter space-y-2 rounded-2xl bg-bad-soft px-4 py-3 text-center">
      <p className="text-[12px] leading-relaxed text-bad">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={() => {
            tap();
            onRetry();
          }}
          className="text-[11px] font-semibold text-bad underline underline-offset-4 transition active:scale-95"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
