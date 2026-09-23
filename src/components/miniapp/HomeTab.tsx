/**
 * The first screen: what the casino says the player has, the ways to add to it, and the last two
 * operations.
 *
 * WHY THE BALANCE IS SOMETIMES A SENTENCE AND NOT A NUMBER: `casino.available === false` means the
 * platform could not be read at that moment, which is NOT a zero balance. A 0 here would tell a
 * player their money is gone, so the screen says so in words and keeps the sync time beside it.
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { errorMessage } from "@/lib/api/client";
import { useDeposits, usePaymentMethods, useWallet } from "@/lib/api/hooks";
import type { PaymentRail } from "@/lib/api/types";
import { dayMonthOf, formatAmount, formatWhole, timeOf } from "@/lib/money";

import {
  BalanceSkeleton,
  Card,
  EmptyState,
  ErrorLine,
  FadingValue,
  MethodRowsSkeleton,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  StatusChip,
  chipOf,
  enterDelay,
} from "./primitives";

/** Picked from the rail, so a method the operator adds tomorrow still gets an icon. */
function railIcon(rail: PaymentRail): LucideIcon {
  return rail === "BANK_TRANSFER" ? Landmark : Wallet;
}

export function HomeTab({
  onDeposit,
  onWithdraw,
}: {
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

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div className="space-y-1.5">
          {/* The hint is smaller than the label it sits beside, so a poll starting or ending
              cannot change this row's height. */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink-muted">
              الرصيد الحالي على المنصة
            </span>
            <Refreshing show={wallet.isFetching && !wallet.isPending} />
          </div>
          {wallet.isPending && <BalanceSkeleton />}
          {wallet.isError && (
            <ErrorLine
              message={errorMessage(wallet.error)}
              onRetry={() => void wallet.refetch()}
            />
          )}
          {funds !== undefined && (
            <>
              {funds.casino.available && funds.casino.balance !== null ? (
                <div className="flex items-baseline gap-2" dir="ltr">
                  <h1 className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
                    {/* Re-read on focus and after every deposit: it is allowed to change while
                        the player is looking at it, and it should not do that by snapping. */}
                    <FadingValue value={formatAmount(funds.casino.balance.amount)} />
                  </h1>
                  <span className="text-lg font-medium text-brand">{funds.currency}</span>
                </div>
              ) : (
                <p className="text-base font-medium text-warn">
                  تعذّر قراءة الرصيد من المنصة حالياً
                </p>
              )}
              <p className="text-[11px] text-ink-muted">
                آخر مزامنة <span className="tabular-nums">{timeOf(funds.casino.readAt)}</span>
                {funds.pending.count > 0 && (
                  <>
                    {" · "}بانتظار الموافقة{" "}
                    <FadingValue
                      className="tabular-nums"
                      value={formatWhole(funds.pending.total.amount)}
                    />{" "}
                    {funds.currency}
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={onDeposit}
            className="w-full rounded-2xl bg-brand py-4 text-base font-medium text-brand-foreground shadow-teller ring-1 ring-brand transition active:scale-[0.98]"
          >
            شحن الرصيد
          </button>
          <button
            type="button"
            onClick={onWithdraw}
            className="w-full rounded-2xl bg-card py-4 text-base font-medium text-brand shadow-teller ring-1 ring-brand/40 transition hover:ring-brand active:scale-[0.98]"
          >
            سحب رصيد
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>طرق الدفع المتاحة</SectionTitle>
        {methods.isPending && <MethodRowsSkeleton />}
        {methods.isError && (
          <ErrorLine
            message={errorMessage(methods.error)}
            onRetry={() => void methods.refetch()}
          />
        )}
        {methods.isSuccess && rails.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="لا توجد طرق دفع متاحة حالياً"
            hint="يضيفها الكازينو من لوحة التحكم، وتظهر هنا فور تفعيلها."
          />
        )}
        <div className="grid gap-3">
          {rails.map((method, index) => {
            const Icon = railIcon(method.rail);
            return (
              <button
                key={method.id}
                type="button"
                onClick={onDeposit}
                style={enterDelay(index)}
                className="app-enter group flex items-center justify-between rounded-2xl bg-card p-4 text-start shadow-teller ring-1 ring-hairline transition hover:ring-brand/40 active:scale-[0.99] active:ring-brand/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-ink-muted">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium">{method.displayName}</div>
                    <div className="text-[11px] tabular-nums text-ink-muted">
                      {/* One Latin numeric run, given its own direction: inside the RTL paragraph
                          bidi draws "25,000 - 5,000,000 NSP" as "NSP 5,000,000 - 25,000", which
                          reads as a minimum of five million. */}
                      الحدود:{" "}
                      <span dir="ltr" className="inline-block">
                        {formatWhole(method.minAmount)} – {formatWhole(method.maxAmount)}{" "}
                        {method.currencyCode}
                      </span>
                    </div>
                    {method.instructions !== null && (
                      <div className="truncate text-[11px] text-ink-muted">
                        {method.instructions}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowLeft className="size-4 shrink-0 text-ink-muted transition-colors group-hover:text-brand" />
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
                className="flex items-center gap-1 text-xs font-medium text-brand transition active:scale-95"
              >
                عرض الكل <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          }
        >
          آخر العمليات
        </SectionTitle>
        <div className="space-y-2">
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
          {recent.map((deposit, index) => {
            const { day, month } = dayMonthOf(deposit.createdAt);
            return (
              <Card
                key={deposit.shortId}
                style={enterDelay(index)}
                className="app-enter flex items-center justify-between p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary">
                    <span className="text-[11px] font-bold tabular-nums">{day}</span>
                    {/* Two of the twelve Arabic month names are too wide for 40px; the box stays 40px. */}
                    <span className="w-full truncate px-0.5 text-center text-[9px] text-ink-muted">
                      {month}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums" dir="ltr">
                      {formatAmount(deposit.claimed.amount)} {deposit.claimed.currency}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {[deposit.destination?.methodName ?? "", deposit.shortId]
                        .filter((part) => part.length > 0)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
                <StatusChip status={chipOf(deposit.status)} />
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
        <p className="text-[12px] leading-relaxed text-ink-muted">
          الرصيد يُقرأ مباشرة من حسابك على المنصة الخارجية. لا تشارك رقم المرجع أو صورة
          الإيصال مع أي شخص غير الدعم الرسمي.
        </p>
      </Card>
    </div>
  );
}
