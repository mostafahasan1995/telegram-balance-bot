/**
 * 🔥 العروض — the bonus wallet, as the bot's «🔥 العروض الحالية» shows it (owner, 2026-09-27).
 *
 * THE WALLET IS NOT THE CASINO BALANCE, and the screen says so by where things sit: the bonus
 * balance and its bar to the threshold on top, the one action that turns it into casino money
 * («حوّل للرصيد») under them — offered only when the server says the wallet may move, never inferred
 * here from the two figures. Everything the server decides (the threshold, "claimable", "can
 * transfer") is read from the answer, so the app and the bot cannot disagree.
 *
 * THE MOVE IS TWO TAPS. It moves the WHOLE wallet and the player cannot take it back, so the first tap
 * only asks «متأكد؟» — the same confirmation the bot shows.
 *
 * Refusals are the server's Arabic, verbatim (a wrong code, a gift already claimed, a move while one
 * is on its way); the screen invents no wording for a failure the server explained.
 */
import { Flame, Gift, History, Sparkles, Ticket, Wallet } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  useBonus,
  useBonusTransfer,
  useClaimBonusOffer,
  useRedeemBonusCode,
} from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type {
  BonusAwardView,
  BonusEntryView,
  BonusTransferBlockReason,
  PlayerBonusTransferView,
  PlayerBonusView,
  PlayerOfferView,
} from "@/lib/api/types";
import { dayMonthOf, formatAmount, formatWhole, timeOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  EmptyState,
  ErrorLine,
  Hero,
  Money,
  Note,
  Num,
  Refreshing,
  SectionTitle,
  Skeleton,
} from "./primitives";

/** The longest code the backend accepts as typed. */
const MAX_CODE = 64;

export function OffersTab() {
  const bonus = useBonus(true);
  const view = bonus.data;

  if (bonus.isPending) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <SectionTitle>محفظة البونص</SectionTitle>
          <Hero className="space-y-4">
            <Skeleton className="h-10 w-40 rounded-md" />
            <Skeleton className="h-2.5 rounded-full" />
            <Skeleton className="h-12 rounded-lg" />
          </Hero>
        </section>
      </div>
    );
  }
  if (bonus.isError || view === undefined) {
    return <ErrorLine message={errorMessage(bonus.error)} onRetry={() => void bonus.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle action={<Refreshing show={bonus.isFetching && !bonus.isPending} />}>
          محفظة البونص
        </SectionTitle>
        <WalletCard view={view} />
      </section>

      {view.enabled ? (
        <>
          <CodeCard />
          <OffersList view={view} />
        </>
      ) : (
        <Note icon={Flame}>العروض متوقفة مؤقتاً، ورصيد محفظتك محفوظ إلك.</Note>
      )}

      <EntriesList entries={view.entries} currency={view.currencyCode} />
    </div>
  );
}

// ── the wallet ──────────────────────────────────────────────────────────────────────────────────

function WalletCard({ view }: { view: PlayerBonusView }) {
  const transfer = useBonusTransfer();
  const [confirming, setConfirming] = useState(false);
  const percent = Math.min(100, Math.max(0, Math.trunc(view.progressBps / 100)));
  const pending = view.pendingTransfer;

  const move = async () => {
    tap();
    try {
      await transfer.mutateAsync();
      setConfirming(false);
    } catch {
      // The mutation holds the failure; it is rendered under the button in the server's Arabic.
    }
  };

  return (
    <Hero className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="app-tile app-tile-brand size-11">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-micro text-ink-muted">رصيد البونص</div>
          <Money
            amount={formatAmount(view.balance)}
            currency={view.currencyCode}
            className="text-display font-bold text-ink"
            fade
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="التقدم نحو حد التحويل"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-micro text-ink-muted">
          <span>
            <Num>{percent}%</Num>
          </span>
          <span>
            حد التحويل{" "}
            <Num>
              {formatWhole(view.threshold)} {view.currencyCode}
            </Num>
          </span>
        </div>
      </div>

      {pending !== null ? (
        <PendingLine transfer={pending} currency={view.currencyCode} />
      ) : view.canTransfer ? (
        confirming ? (
          <div className="app-enter space-y-2.5">
            <p className="app-inset px-3 py-2.5 text-center text-small text-ink">
              رح ينضاف كامل رصيد البونص (
              <Num>
                {formatAmount(view.balance)} {view.currencyCode}
              </Num>
              ) لرصيدك بـ Ichancy. متأكد؟
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                busy={transfer.isPending}
                disabled={transfer.isPending}
                onClick={() => void move()}
              >
                {transfer.isPending ? "جارٍ التحويل…" : "✅ أكّد التحويل"}
              </ActionButton>
              <ActionButton
                tone="secondary"
                disabled={transfer.isPending}
                onClick={() => {
                  tap();
                  setConfirming(false);
                }}
              >
                لا، خليه
              </ActionButton>
            </div>
          </div>
        ) : (
          <ActionButton
            icon={Sparkles}
            onClick={() => {
              tap();
              setConfirming(true);
            }}
          >
            💸 حوّل للرصيد
          </ActionButton>
        )
      ) : (
        <p className="app-inset px-3 py-2.5 text-center text-small text-ink-muted">
          {blockedLine(view.transferBlockedReason, view)}
        </p>
      )}

      {transfer.isError && <ErrorLine message={errorMessage(transfer.error)} />}
    </Hero>
  );
}

function PendingLine({
  transfer,
  currency,
}: {
  transfer: PlayerBonusTransferView;
  currency: string;
}) {
  return (
    <p className="app-enter flex items-center justify-center gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-small text-warn">
      <span aria-hidden="true" className="app-waiting size-1.5 rounded-full bg-warn" />
      <span>
        عم نحوّل{" "}
        <Num>
          {formatAmount(transfer.amount)} {currency}
        </Num>{" "}
        لرصيدك · <Num>{transfer.shortId}</Num>
      </span>
    </p>
  );
}

/** Why the wallet cannot move yet, in the bot's words. */
function blockedLine(reason: BonusTransferBlockReason | null, view: PlayerBonusView): string {
  const threshold = `${formatWhole(view.threshold)} ${view.currencyCode}`;
  switch (reason) {
    case "NOT_LINKED":
      return "حسابك في Ichancy قيد التجهيز، حاول بعد قليل";
    case "PLAYER_NOT_ACTIVE":
      return "حسابك غير نشط حالياً";
    case "OPERATOR_PAUSED":
      return "الخدمة متوقفة مؤقتاً، حاول لاحقاً";
    case "IN_FLIGHT":
      return "في تحويل عم يتنفّذ هلأ";
    case "EMPTY":
      return `محفظتك فاضية هلأ. بس توصل لـ ${threshold} بتقدر تحوّلها لرصيدك`;
    case "BELOW_THRESHOLD":
    case null:
      return `🔒 بتقدر تحوّل البونص لرصيدك بس يوصل ${threshold}`;
  }
}

// ── a code ──────────────────────────────────────────────────────────────────────────────────────

function CodeCard() {
  const redeem = useRedeemBonusCode();
  const [code, setCode] = useState("");
  const [award, setAward] = useState<BonusAwardView | null>(null);
  const typed = code.trim();

  const submit = async () => {
    if (typed.length === 0 || redeem.isPending) return;
    tap();
    try {
      setAward(await redeem.mutateAsync(typed));
      setCode("");
    } catch {
      setAward(null);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle>عندك كود؟</SectionTitle>
      <Card className="space-y-3">
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setAward(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          maxLength={MAX_CODE}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          aria-label="كود الهدية أو الخصم"
          placeholder="GIFT2026"
          className="app-field text-center tracking-widest"
        />
        <ActionButton
          icon={Ticket}
          tone="secondary"
          disabled={typed.length === 0 || redeem.isPending}
          busy={redeem.isPending}
          onClick={() => void submit()}
        >
          {redeem.isPending ? "جارٍ التفعيل…" : "🎟️ فعّل الكود"}
        </ActionButton>
        {redeem.isError && <ErrorLine message={errorMessage(redeem.error)} />}
        {award !== null && (
          <p className="app-enter rounded-xl bg-ok-soft px-3 py-2.5 text-center text-small text-ok">
            🎉 انضافلك <Num>{formatAmount(award.amount)}</Num> على محفظة البونص
          </p>
        )}
      </Card>
    </section>
  );
}

// ── the offers ──────────────────────────────────────────────────────────────────────────────────

function OffersList({ view }: { view: PlayerBonusView }) {
  return (
    <section className="space-y-3">
      <SectionTitle>العروض الشغّالة</SectionTitle>
      {view.offers.length === 0 ? (
        <EmptyState icon={Gift} title="ما في عروض شغّالة هلأ" hint="خليك قريب، العروض بتتجدد 👀" />
      ) : (
        <div className="space-y-2.5">
          {view.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} currency={view.currencyCode} />
          ))}
        </div>
      )}
    </section>
  );
}

function OfferCard({ offer, currency }: { offer: PlayerOfferView; currency: string }) {
  const claim = useClaimBonusOffer();
  const welcome = offer.kind === "WELCOME";

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className={cn("app-tile size-11", !welcome && "app-tile-brand")}>
          {welcome ? <Sparkles className="size-5" /> : <Gift className="size-5" />}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-body font-semibold text-ink">{offer.title}</div>
          {offer.description !== null && (
            <p className="text-small text-ink-muted">{offer.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 text-micro text-ink-muted">
            <Money
              amount={formatAmount(offer.amount)}
              currency={currency}
              className="text-small font-semibold text-ink"
              unitClassName="text-micro"
            />
            {welcome && <span>لكل حساب جديد</span>}
            {offer.endsAt !== null && (
              <span>
                لغاية <Num>{untilOf(offer.endsAt)}</Num>
              </span>
            )}
          </div>
        </div>
      </div>

      {offer.claimed ? (
        <p className="rounded-xl bg-ok-soft px-3 py-2 text-center text-small text-ok">
          ✅ {welcome ? "وصلك البونص الترحيبي" : "استلمتها"}
        </p>
      ) : offer.claimable ? (
        <ActionButton
          icon={Gift}
          busy={claim.isPending}
          disabled={claim.isPending || claim.isSuccess}
          onClick={() => {
            tap();
            claim.mutate(offer.id);
          }}
        >
          {claim.isPending ? "جارٍ الاستلام…" : "🎁 استلم الهدية"}
        </ActionButton>
      ) : null}
      {claim.isError && <ErrorLine message={errorMessage(claim.error)} />}
    </Card>
  );
}

/** «30 أيلول 22:00» — when a gift ends, in the player's own clock. */
function untilOf(iso: string): string {
  const { day, month } = dayMonthOf(iso);
  return `${day} ${month} ${timeOf(iso)}`;
}

// ── the latest lines ────────────────────────────────────────────────────────────────────────────

function EntriesList({ entries, currency }: { entries: BonusEntryView[]; currency: string }) {
  return (
    <section className="space-y-3">
      <SectionTitle>آخر الحركات</SectionTitle>
      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="ما في حركات بعد"
          hint="جوائز العجلة، الهدايا والأكواد بتنضاف هون"
        />
      ) : (
        <Card flush>
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const credit = !entry.amount.startsWith("-");
              return (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-small text-ink">{entry.description}</div>
                    <div className="text-micro text-ink-muted">
                      <Num>{untilOf(entry.createdAt)}</Num>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-small font-semibold",
                      credit ? "text-ok" : "text-ink-muted",
                    )}
                  >
                    <Num>
                      {credit ? "+" : ""}
                      {formatAmount(entry.amount)} {currency}
                    </Num>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
