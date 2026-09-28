/**
 * «🤝 الإحالات والأرباح» — the player's invite link, the terms in plain words, and what the
 * programme has paid them (owner, 2026-09-27).
 *
 * THE SAME OBJECT AS THE BOT. GET /v1/referrals is what the bot's button renders too, so the rate,
 * the example and the totals can never say one thing here and another in the chat. Nothing on this
 * screen computes money: the example («على كل 100,000 بيخسرها صاحبك…») comes priced by the server.
 *
 * THE SHARE BUTTON opens Telegram's own share sheet with the link, the way the bot's button does; the
 * link itself sits in a copy field for any other app.
 */
import { CalendarClock, Handshake, Share2, Users } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/api/client";
import { useReferrals } from "@/lib/api/hooks";
import { openExternal, tap, webApp } from "@/lib/api/telegram";
import type {
  PlayerReferralEarningView,
  PlayerReferralSummaryView,
  ReferralEarningStatus,
} from "@/lib/api/types";
import { dayMonthOf, formatWhole, timeOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  CopyField,
  EmptyState,
  ErrorLine,
  Hero,
  Money,
  Note,
  Num,
  SectionTitle,
  Skeleton,
} from "./primitives";

/** What the share sheet pre-fills under the link — the bot's own words. */
const SHARE_TEXT = "تعال سجّل معي من هالرابط 🎰🔥";

const STATUS_LABEL: Partial<Record<ReferralEarningStatus, string>> = {
  CREDITED: "بمحفظة البونص",
  BELOW_MINIMUM: "أقل من الحد الأدنى",
};

export function ReferralsTab() {
  const referrals = useReferrals(true);

  if (referrals.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="جارٍ التحميل…">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (referrals.isError) {
    return (
      <ErrorLine message={errorMessage(referrals.error)} onRetry={() => void referrals.refetch()} />
    );
  }

  const view = referrals.data;
  if (!view.enabled) {
    return (
      <EmptyState
        icon={Handshake}
        title="نظام الإحالات غير مفعّل حالياً"
        hint="تابعنا، أول ما يتفعّل رح تقدر تدعي أصحابك وتربح من هون 😉"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Earned view={view} />
      <InviteLink link={view.inviteLink} />
      <Terms view={view} />
      <Stats view={view} />
      {view.nextSettlementAt === null ? null : (
        <Note icon={CalendarClock}>
          الحسبة الجاية: <Num>{whenOf(view.nextSettlementAt)}</Num> — وبتنضاف أرباحك لمحفظة البونص
          تبعك.
        </Note>
      )}
      <Recent view={view} />
    </div>
  );
}

function Earned({ view }: { view: PlayerReferralSummaryView }) {
  return (
    <section className="space-y-3">
      <SectionTitle>الإحالات والأرباح</SectionTitle>
      <Hero className="space-y-3">
        <span className="block truncate text-micro font-medium text-ink-muted">
          أرباحك من الإحالات لهلأ
        </span>
        <Money
          amount={formatWhole(view.stats.earned)}
          currency={view.currencyCode}
          className="text-display font-semibold text-ink"
          unitClassName="text-figure font-semibold text-ink-muted"
        />
        <p className="text-small text-ink-muted">
          بتربح <Num>{view.terms.commissionPercent}%</Num> من خسارة كل صديق بيسجّل من رابطك
        </p>
      </Hero>
    </section>
  );
}

function InviteLink({ link }: { link: string | null }) {
  if (link === null) {
    return (
      <Note icon={Share2}>رابط الدعوة مو جاهز هلأ. افتح البوت واضغط /start مرة، وارجع لهون.</Note>
    );
  }
  const share = () => {
    tap();
    const url =
      `https://t.me/share/url?url=${encodeURIComponent(link)}` +
      `&text=${encodeURIComponent(SHARE_TEXT)}`;
    // Inside Telegram the share sheet opens in place; anywhere else, in the browser.
    const app = webApp() as { openTelegramLink?: (target: string) => void } | null;
    if (app?.openTelegramLink !== undefined) app.openTelegramLink(url);
    else openExternal(url);
  };
  return (
    <section className="space-y-3">
      <SectionTitle>رابط الدعوة</SectionTitle>
      <Card className="space-y-3">
        <CopyField label="رابط الدعوة تبعك" value={link} />
        <ActionButton icon={Share2} onClick={share}>
          📤 شارك رابط الدعوة
        </ActionButton>
      </Card>
    </section>
  );
}

function Terms({ view }: { view: PlayerReferralSummaryView }) {
  const { terms, currencyCode } = view;
  const money = (amount: string) => (
    <Num>
      {formatWhole(amount)} {currencyCode}
    </Num>
  );
  return (
    <section className="space-y-3">
      <SectionTitle>الشروط</SectionTitle>
      <Card className="space-y-2 text-small text-ink">
        <Line>
          بتربح <Num>{terms.commissionPercent}%</Num> من خسارة كل صديق بيسجّل من رابطك.
        </Line>
        <Line>
          يعني على كل {money(terms.example.loss)} بيخسرها صاحبك، بتربح{" "}
          {money(terms.example.commission)}.
        </Line>
        {BigInt(terms.signupRewardMinor) > 0n ? (
          <Line>ومكافأة {money(terms.signupReward)} لما صاحبك يشحن أول مرة 🎁</Line>
        ) : null}
        <Line>
          الأرباح بتنحسب{" "}
          {terms.settlementPeriod === "DAILY"
            ? "كل يوم (عند منتصف الليل)"
            : "كل أسبوع (ليلة الجمعة على السبت)"}{" "}
          وبتنضاف لمحفظة البونص تبعك.
        </Line>
        {BigInt(terms.minPayoutMinor) > 0n ? (
          <Line>أقل مبلغ بينصرف بالدفعة: {money(terms.minPayout)}.</Line>
        ) : null}
      </Card>
    </section>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">• {children}</p>;
}

function Stats({ view }: { view: PlayerReferralSummaryView }) {
  return (
    <section className="space-y-3">
      <SectionTitle>إحصائياتك</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="سجّلوا من رابطك" value={<Num>{view.stats.invited}</Num>} />
        <Stat label="شحنوا حسابهم" value={<Num>{view.stats.active}</Num>} />
        <Stat
          label="آخر فترة"
          value={view.lastPeriod === null ? "—" : <Num>{formatWhole(view.lastPeriod.earned)}</Num>}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="space-y-1 text-center">
      <div className="text-title font-bold text-ink">{value}</div>
      <div className="truncate text-micro text-ink-muted">{label}</div>
    </Card>
  );
}

function Recent({ view }: { view: PlayerReferralSummaryView }) {
  return (
    <section className="space-y-3">
      <SectionTitle>آخر الأرباح</SectionTitle>
      {view.recent.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ما في أرباح لسا"
          hint="أول ما يسجّل صديق من رابطك ويلعب، بتبين أرباحك هون."
        />
      ) : (
        <div className="space-y-2.5">
          {view.recent.map((earning) => (
            <EarningRow key={earning.id} earning={earning} currency={view.currencyCode} />
          ))}
        </div>
      )}
    </section>
  );
}

function EarningRow({
  earning,
  currency,
}: {
  earning: PlayerReferralEarningView;
  currency: string;
}) {
  const { day, month } = dayMonthOf(earning.createdAt);
  const paid = earning.status === "CREDITED";
  const what = earning.kind === "FIRST_DEPOSIT_REWARD" ? "مكافأة أول شحنة" : "أرباح إحالة";
  return (
    <Card className="flex items-center gap-3">
      <span className="app-tile flex size-11 flex-col justify-center gap-0.5">
        <Num className="text-micro font-bold text-ink">{day}</Num>
        <span className="w-full truncate px-1 text-center text-nano leading-none">{month}</span>
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <Money
          amount={formatWhole(earning.amount)}
          currency={currency}
          className="text-body font-semibold text-ink"
        />
        <div className="truncate text-micro text-ink-muted">
          {what}
          {earning.friendName === null ? "" : ` · ${earning.friendName}`}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-semibold",
          paid ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
        )}
      >
        {STATUS_LABEL[earning.status] ?? earning.status}
      </span>
    </Card>
  );
}

/** "3 تشرين الأول · 00:00" — the device's clock, which in Syria is Damascus's. */
function whenOf(iso: string): string {
  const { day, month } = dayMonthOf(iso);
  return `${day} ${month} · ${timeOf(iso)}`;
}
