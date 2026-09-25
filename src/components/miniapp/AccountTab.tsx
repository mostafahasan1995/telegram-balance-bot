/**
 * Who the player is, and the login the casino knows them by.
 *
 * WHY THE CREDENTIALS ARE NOT FETCHED WITH THE SCREEN: the answer carries a plaintext password, and
 * a tab that is opened to check a Telegram id should not put one on screen — or in a cache — for
 * anyone standing behind the player. They are read only after an explicit tap, and hidden again on
 * request.
 *
 * THE PANEL IS THIS SCREEN'S ONE ELEVATED SURFACE, in the app's dark ink rather than the operator's
 * colour: it is an identity card, it is the same on every screen it appears on, and everything
 * under it is a flat card like everywhere else in the app.
 */
import { BadgeCheck, Check, ChevronLeft, Copy, ExternalLink, KeyRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/client";
import { useCasinoCredentials, useMe } from "@/lib/api/hooks";
import { openExternal, tap } from "@/lib/api/telegram";
import type { PlayerStatus, PlayerView } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ActionButton, Card, ErrorLine, Loading, Num, SectionTitle, Skeleton } from "./primitives";
import { enterDelay } from "./row-style";

const STATUS_LABEL: Record<PlayerStatus, string> = {
  ACTIVE: "نشط",
  PENDING_ICHANCY: "قيد التجهيز",
  BLOCKED: "موقوف",
  SUSPENDED: "موقوف",
  SELF_EXCLUDED: "استبعاد ذاتي",
  CLOSED: "مغلق",
};

function displayName(player: PlayerView): string {
  const full = [player.firstName, player.lastName]
    .filter((part) => part !== null)
    .join(" ")
    .trim();
  if (full.length > 0) return full;
  return player.telegramUsername ?? "—";
}

function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/** The backend names a bare host; the host browser needs a scheme before it will open one. */
function siteUrl(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export function AccountTab() {
  const me = useMe(true);
  const [revealed, setRevealed] = useState(false);
  const credentials = useCasinoCredentials(revealed);

  const player = me.data?.player;
  const name = player === undefined ? "" : displayName(player);
  const secrets = credentials.data;

  return (
    <div className="space-y-6">
      <section className="app-hero space-y-4 bg-panel text-panel-foreground">
        {me.isPending && <ProfileSkeleton />}
        {me.isError && (
          <ErrorLine message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
        )}
        {player !== undefined && (
          <>
            <div className="app-enter flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10 text-body font-semibold">
                {initialsOf(name)}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-body font-semibold">{name}</div>
                {player.telegramUsername !== null && (
                  <div className="truncate text-micro text-panel-foreground/60">
                    <Num>@{player.telegramUsername}</Num>
                  </div>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-micro font-semibold">
                <BadgeCheck className="size-3.5 shrink-0" />
                {STATUS_LABEL[player.status]}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <PanelFact label="حالة اللعب">
                <span className={player.ichancyLinked ? "" : "text-panel-foreground/70"}>
                  {player.ichancyLinked ? "حساب مرتبط" : "غير مرتبط"}
                </span>
              </PanelFact>
              <PanelFact label="العملة">
                <Num>{player.currencyCode}</Num>
              </PanelFact>
              <PanelFact label="معرّف تلغرام">
                {player.telegramUserId === null ? "—" : <Num>{player.telegramUserId}</Num>}
              </PanelFact>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>بيانات الدخول للمنصة</SectionTitle>
        <Card className="space-y-3">
          {!revealed ? (
            <ActionButton
              tone="soft"
              icon={KeyRound}
              onClick={() => {
                tap();
                setRevealed(true);
              }}
            >
              إظهار بيانات الدخول
            </ActionButton>
          ) : credentials.isPending ? (
            // A panel the player just asked to open: there is no shape to stand in for yet, and a
            // skeleton of a password would be a strange thing to draw.
            <Loading label="جارٍ جلب بياناتك…" />
          ) : secrets === undefined ? (
            <div className="space-y-3">
              {/* The server says "قيد التجهيز" while the casino account is still being created. */}
              <ErrorLine message={errorMessage(credentials.error)} />
              <HideButton onHide={() => setRevealed(false)} />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  tap();
                  openExternal(siteUrl(secrets.site));
                }}
                className="app-enter flex w-full min-w-0 items-center gap-2 text-start"
              >
                <KeyRound className="size-4 shrink-0 text-brand-ink" />
                <span className="app-code min-w-0 flex-1 truncate text-small font-semibold text-ink">
                  {secrets.site}
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-ink-muted" />
              </button>
              <CopyRow label="اسم المستخدم" value={secrets.login} />
              <CopyRow label="كلمة السر" value={secrets.password} masked />
              <p className="text-small text-ink-muted">
                احفظ هذه البيانات ولا تشاركها مع أي شخص. يُنصح بتغيير كلمة السر من الموقع بعد أول
                تسجيل دخول — الشحن والسحب يبقى يعمل بشكل طبيعي.
              </p>
              <HideButton onHide={() => setRevealed(false)} />
            </>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>الشروط والأحكام</SectionTitle>
        <Card flush className="divide-y divide-hairline">
          {["شروط الاستخدام", "سياسة الإيداع والسحب", "سياسة الخصوصية"].map((item, index) => (
            <button
              key={item}
              type="button"
              style={enterDelay(index)}
              className={cn(
                "app-enter flex w-full items-center justify-between gap-3 px-4 py-3.5",
                "text-start text-body transition first:rounded-t-xl last:rounded-b-xl",
                "active:bg-secondary",
              )}
            >
              <span className="min-w-0 truncate">{item}</span>
              <ChevronLeft className="size-4 shrink-0 text-ink-muted" />
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}

/** One of the three facts along the foot of the panel. Fixed columns, so none of them can push. */
function PanelFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="truncate text-nano text-panel-foreground/50">{label}</div>
      <div className="truncate text-micro font-semibold">{children}</div>
    </div>
  );
}

/**
 * The header while `/v1/me` is in flight, drawn on the dark panel.
 *
 * `onPanel` ON EVERY BLOCK: the default skeleton is a light grey, which on this panel would be the
 * brightest thing on the screen.
 */
function ProfileSkeleton() {
  return (
    <div role="status" aria-label="جارٍ التحميل…" className="flex items-center gap-3">
      <Skeleton onPanel className="size-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton onPanel className="h-4 w-32 rounded-md" />
        <Skeleton onPanel className="h-3 w-24 rounded-md" />
      </div>
      <Skeleton onPanel className="h-6 w-16 shrink-0 rounded-full" />
    </div>
  );
}

function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        onHide();
      }}
      className="app-btn app-btn-soft py-2.5 text-small text-ink-muted"
    >
      إخفاء
    </button>
  );
}

/**
 * The shared CopyField, kept local for one reason: this one survives a refused clipboard. A player
 * who believes a password was copied and pastes the previous one is a support ticket, so a failed
 * write reveals the value instead of reporting success.
 */
function CopyRow({
  label,
  value,
  masked = false,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!masked);

  const copy = async () => {
    tap();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setShown(true);
    }
  };

  return (
    <div
      className={cn(
        "app-inset flex items-start justify-between gap-3 p-3 transition-shadow",
        copied && "outline-1 -outline-offset-1 outline-brand/50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "mb-1 text-micro font-medium",
            copied ? "text-brand-ink" : "text-ink-muted",
          )}
        >
          {copied ? <span className="app-value inline-block">تم النسخ</span> : label}
        </div>
        <button
          type="button"
          onClick={() => masked && setShown((current) => !current)}
          dir="ltr"
          className="app-code block w-full text-start text-small text-ink transition-opacity active:opacity-60"
        >
          {shown ? value : "••••••••••••"}
        </button>
      </div>
      <button
        type="button"
        aria-label={`نسخ ${label}`}
        onClick={() => void copy()}
        className="app-tile size-9 shrink-0 border border-hairline bg-card text-ink-muted transition active:scale-90"
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
