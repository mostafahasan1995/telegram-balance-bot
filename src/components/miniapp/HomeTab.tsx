/**
 * The first screen: what the casino says the player has, the ways to add to it, and the last two
 * operations.
 *
 * THE BALANCE IS THE SCREEN. It is the one elevated surface, the one figure at display size, and
 * the only place the app spends a shadow — a player opens this to read a number, and everything
 * else on the page is arranged around not getting in the way of it. The figure is tabular, isolated
 * LTR inside the Arabic page, and drawn in ink on an opaque card so it survives sunlight; the
 * operator's background picture is never allowed under it.
 *
 * WHY THE BALANCE IS SOMETIMES A SENTENCE AND NOT A NUMBER: `casino.available === false` means the
 * platform could not be read at that moment, which is NOT a zero balance. A 0 here would tell a
 * player their money is gone, so the screen says so in words and keeps the sync time beside it.
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import type { BrandView } from "@/components/miniapp/brand";
import { errorMessage } from "@/lib/api/client";
import { useDeposits, usePaymentMethods, useWallet } from "@/lib/api/hooks";
import type { PaymentRail, WalletView } from "@/lib/api/types";
import { formatAmount, formatWhole, timeOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  BalanceSkeleton,
  EmptyState,
  ErrorLine,
  Hero,
  MethodRowsSkeleton,
  Money,
  Note,
  Num,
  OperationRow,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  chipOf,
  enterDelay,
} from "./primitives";

/** Picked from the rail, so a method the operator adds tomorrow still gets an icon. */
function railIcon(rail: PaymentRail): LucideIcon {
  return rail === "BANK_TRANSFER" ? Landmark : Wallet;
}

export function HomeTab({
  brand,
  onDeposit,
  onWithdraw,
}: {
  brand: BrandView;
  /** Switches to the deposit tab. It taps for itself — the shell's switcher owns the haptic. */
  onDeposit: () => void;
  /** Switches to the withdraw tab. Same. */
  onWithdraw: () => void;
}) {
  const wallet = useWallet(true);
  const methods = usePaymentMethods(true);
  const deposits = useDeposits(true);

  const funds = wallet.data;
  const rails = methods.data ?? [];
  const recent = (deposits.data ?? []).slice(0, 2);
  const currency = funds?.currency ?? brand.currencyCode ?? "";

  return (
    <div className="space-y-6">
      <Hero className="space-y-3">
        {/* Fixed height: the poll hint appearing and disappearing must not move the figure. */}
        <div className="flex h-5 items-center justify-between gap-2">
          <span className="truncate text-micro font-medium text-ink-muted">
            الرصيد على منصة اللعب
          </span>
          <Refreshing show={wallet.isFetching && !wallet.isPending} />
        </div>

        {wallet.isPending && <BalanceSkeleton />}
        {wallet.isError && (
          <ErrorLine message={errorMessage(wallet.error)} onRetry={() => void wallet.refetch()} />
        )}

        {funds !== undefined && (
          <>
            {funds.casino.available && funds.casino.balance !== null ? (
              <Money
                fade
                amount={formatAmount(funds.casino.balance.amount)}
                currency={currency}
                className="text-display font-semibold text-ink"
                unitClassName="text-figure font-semibold text-ink-muted"
              />
            ) : (
              <p className="text-figure font-semibold text-warn">
                تعذّر قراءة الرصيد من المنصة حالياً
              </p>
            )}
            <BalanceState funds={funds} currency={currency} />
          </>
        )}

        {/*
         * The operator's line, in a slot that is the same height whether they wrote one or not —
         * branding lands after the wallet does, and a sentence that arrives and pushes the two
         * buttons down is a tap on "سحب" that lands on "شحن".
         */}
        <p className="h-[18px] truncate text-micro text-ink-muted">{brand.tagline ?? ""}</p>
      </Hero>

      <div className="grid gap-2.5">
        <ActionButton icon={ReceiptText} onClick={onDeposit}>
          شحن الرصيد
        </ActionButton>
        <ActionButton icon={ArrowDownToLine} tone="secondary" onClick={onWithdraw}>
          سحب رصيد
        </ActionButton>
      </div>

      <section className="space-y-3">
        <SectionTitle>طرق الدفع المتاحة</SectionTitle>
        {methods.isPending && <MethodRowsSkeleton />}
        {methods.isError && (
          <ErrorLine message={errorMessage(methods.error)} onRetry={() => void methods.refetch()} />
        )}
        {methods.isSuccess && rails.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="لا توجد طرق دفع متاحة حالياً"
            hint="يضيفها الكازينو من لوحة التحكم، وتظهر هنا فور تفعيلها."
          />
        )}
        <div className="space-y-2.5">
          {rails.map((method, index) => {
            const Icon = railIcon(method.rail);
            return (
              <button
                key={method.id}
                type="button"
                onClick={onDeposit}
                style={enterDelay(index)}
                className="app-card app-enter flex w-full items-center gap-3 text-start transition active:scale-[0.99]"
              >
                <span className="app-tile app-tile-brand size-11">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate text-body font-semibold text-ink">
                    {method.displayName}
                  </span>
                  {/* The range is ONE Latin run and carries its own direction. Left to the RTL
                      line, bidi draws "25,000 – 5,000,000 NSP" as "NSP 5,000,000 – 25,000", which
                      reads as a minimum of five million. */}
                  <span className="block truncate text-micro text-ink-muted">
                    الحدود:{" "}
                    <Num>
                      {formatWhole(method.minAmount)} – {formatWhole(method.maxAmount)}{" "}
                      {method.currencyCode}
                    </Num>
                  </span>
                </span>
                <ArrowLeft className="size-4 shrink-0 text-ink-muted" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          action={
            <div className="flex items-center gap-2">
              <Refreshing show={deposits.isFetching && !deposits.isPending} />
              <button
                type="button"
                onClick={onDeposit}
                className="flex items-center gap-1 text-small font-semibold text-brand-ink"
              >
                عرض الكل <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          }
        >
          آخر العمليات
        </SectionTitle>
        <div className="space-y-2.5">
          {deposits.isPending && <RowsSkeleton />}
          {deposits.isError && (
            <ErrorLine
              message={errorMessage(deposits.error)}
              onRetry={() => void deposits.refetch()}
            />
          )}
          {deposits.isSuccess && recent.length === 0 && (
            <EmptyState
              icon={ReceiptText}
              title="لا توجد عمليات بعد"
              hint="أول عملية شحن ترسلها تظهر هنا مع حالتها لحظة بلحظة."
            />
          )}
          {recent.map((deposit, index) => (
            <OperationRow
              key={deposit.shortId}
              index={index}
              at={deposit.createdAt}
              amount={formatAmount(deposit.claimed.amount)}
              currency={deposit.claimed.currency}
              meta={[deposit.destination?.methodName ?? "", deposit.shortId]}
              status={chipOf(deposit.status)}
            />
          ))}
        </div>
      </section>

      <Note icon={ShieldCheck}>
        الرصيد يُقرأ مباشرة من حسابك على المنصة الخارجية. لا تشارك رقم المرجع أو صورة الإيصال مع
        أي شخص غير الدعم الرسمي.
      </Note>
    </div>
  );
}

/**
 * Where the money stands, at a glance: waiting on someone, or all of it settled.
 *
 * BOTH STATES ARE THE SAME HEIGHT and the row is always rendered, because this line changes on its
 * own — a deposit is approved fifteen seconds after the player opened the screen, the chip flips,
 * and a row that appeared or vanished at that moment would drag the whole page under their thumb.
 */
function BalanceState({ funds, currency }: { funds: WalletView; currency: string }) {
  const waiting = funds.pending.count > 0;

  return (
    <div className="flex h-6 items-center justify-between gap-2">
      {/*
       * The wording is short on purpose. At 320px this row has 248px to spend, and
       * "بانتظار الموافقة 5,000,000 NSP" beside "آخر مزامنة 14:48" wants 270 — which is a card
       * that leaves the screen. The chip keeps the figure, the line beside it gives way first.
       */}
      <span
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-semibold",
          waiting ? "app-waiting bg-warn-soft text-warn" : "bg-ok-soft text-ok",
        )}
      >
        {waiting ? (
          <>
            قيد المراجعة <Num>{formatWhole(funds.pending.total.amount)}</Num> <Num>{currency}</Num>
          </>
        ) : (
          "لا مبالغ معلّقة"
        )}
      </span>
      <span className="min-w-0 truncate text-micro text-ink-muted">
        مزامنة <Num>{timeOf(funds.casino.readAt)}</Num>
      </span>
    </div>
  );
}
