import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { statusLabel, type DepositStatus } from "@/lib/miniapp-data";

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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card shadow-teller ring-1 ring-hairline",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusChip({ status }: { status: DepositStatus }) {
  const tone =
    status === "approved"
      ? "bg-ok-soft text-ok"
      : status === "pending"
        ? "bg-warn-soft text-warn"
        : "bg-bad-soft text-bad";

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tone)}>
      {statusLabel[status]}
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
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
          onPanel
            ? "bg-white/10 text-panel-foreground hover:bg-white/20"
            : "bg-card text-ink-muted ring-1 ring-hairline hover:text-brand",
        )}
      >
        {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
