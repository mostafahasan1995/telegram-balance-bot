/**
 * Who the player is, and the login the casino knows them by.
 *
 * WHY THE CREDENTIALS ARE NOT FETCHED WITH THE SCREEN: the answer carries a plaintext password, and
 * a tab that is opened to check a Telegram id should not put one on screen — or in a cache — for
 * anyone standing behind the player. They are read only after an explicit tap, and hidden again on
 * request.
 */
import { BadgeCheck, Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useCasinoCredentials, useMe } from "@/lib/api/hooks";
import { openExternal } from "@/lib/api/telegram";
import type { PlayerStatus, PlayerView } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { Card, ErrorLine, Loading, SectionTitle } from "./primitives";

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
    <div className="space-y-7">
      <section className="space-y-4 rounded-3xl bg-panel p-5 text-panel-foreground shadow-teller">
        {me.isPending && (
          <p className="py-6 text-center text-xs text-panel-foreground/60">جارٍ التحميل…</p>
        )}
        {me.isError && (
          <ErrorLine message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
        )}
        {player !== undefined && (
          <>
            <div className="flex items-center gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-medium outline-1 -outline-offset-1 outline-white/10">
                {initialsOf(name)}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="truncate font-medium">{name}</div>
                {player.telegramUsername !== null && (
                  <div className="truncate text-xs text-panel-foreground/60" dir="ltr">
                    @{player.telegramUsername}
                  </div>
                )}
                {player.telegramUserId !== null && (
                  <div className="text-xs tabular-nums text-panel-foreground/60" dir="ltr">
                    ID: {player.telegramUserId}
                  </div>
                )}
              </div>
              <div className="ms-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium">
                <BadgeCheck className="size-3.5 text-brand" />
                {STATUS_LABEL[player.status]}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <div className="space-y-0.5">
                <span className="text-[10px] text-panel-foreground/50">حالة اللعب</span>
                <div
                  className={cn(
                    "text-xs font-medium",
                    player.ichancyLinked ? "text-brand" : "text-panel-foreground/70",
                  )}
                >
                  {player.ichancyLinked ? "حساب مرتبط" : "غير مرتبط"}
                </div>
              </div>
              <div className="space-y-0.5 text-start">
                <span className="text-[10px] text-panel-foreground/50">العملة</span>
                <div className="text-xs font-medium tabular-nums">{player.currencyCode}</div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>بيانات الدخول للمنصة</SectionTitle>
        <Card className="space-y-3 p-5">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium ring-1 ring-hairline transition-colors hover:ring-brand/40"
            >
              <KeyRound className="size-4 text-brand" />
              إظهار بيانات الدخول
            </button>
          ) : credentials.isPending ? (
            <Loading />
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
                onClick={() => openExternal(siteUrl(secrets.site))}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <KeyRound className="size-4 text-brand" />
                {secrets.site}
                <ExternalLink className="size-3.5 text-ink-muted" />
              </button>
              <CopyRow label="اسم المستخدم" value={secrets.login} />
              <CopyRow label="كلمة السر" value={secrets.password} masked />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                احفظ هذه البيانات ولا تشاركها مع أي شخص. يُنصح بتغيير كلمة السر من الموقع بعد
                أول تسجيل دخول — الشحن والسحب يبقى يعمل بشكل طبيعي.
              </p>
              <HideButton onHide={() => setRevealed(false)} />
            </>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>الشروط والأحكام</SectionTitle>
        <Card className="divide-y divide-hairline">
          {["شروط الاستخدام", "سياسة الإيداع والسحب", "سياسة الخصوصية"].map((item) => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center justify-between px-5 py-3.5 text-sm"
            >
              {item}
              <span className="text-ink-muted">←</span>
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}

function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={onHide}
      className="w-full rounded-xl bg-secondary py-2.5 text-xs font-medium text-ink-muted ring-1 ring-hairline transition-colors hover:ring-brand/40"
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
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setShown(true);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5 ring-1 ring-hairline">
      <div className="min-w-0">
        <div
          className={cn(
            "mb-0.5 text-[10px] font-medium tracking-wide",
            copied ? "text-brand" : "text-ink-muted",
          )}
        >
          {copied ? "تم النسخ" : label}
        </div>
        <button
          type="button"
          onClick={() => masked && setShown((current) => !current)}
          dir="ltr"
          className="block max-w-[210px] truncate text-start font-mono text-[13px] text-ink"
        >
          {shown ? value : "••••••••••••"}
        </button>
      </div>
      <button
        type="button"
        aria-label={`نسخ ${label}`}
        onClick={() => void copy()}
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-ink-muted ring-1 ring-hairline transition-colors hover:text-brand"
      >
        {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
