/**
 * The cash-out, on the same service the bot's 💸 button calls.
 *
 * TWO RULES ARE THE SERVER'S, NOT THIS SCREEN'S, and both are read off the answer rather than
 * re-implemented here:
 *  - ONE OPEN REQUEST AT A TIME. The list already says whether one is open; the form is replaced by
 *    that request rather than disabled, so the player sees what they are waiting on.
 *  - WHAT COUNTS AS A VALID PAYOUT ADDRESS. A crypto address is matched to its network on the
 *    server (a TRC20 address pasted for BEP20 is money gone), so this only refuses an empty box and
 *    shows whatever the server says about the rest.
 */
import { ArrowDownToLine, Landmark, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  isOpenWithdrawal,
  useCreateWithdrawal,
  usePaymentMethods,
  useWallet,
  useWithdrawals,
} from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type { PaymentMethodView } from "@/lib/api/types";
import {
  dayMonthOf,
  formatAmount,
  formatWhole,
  fromMinor,
  scaleOf,
  timeOf,
  toMinor,
} from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  Card,
  EmptyState,
  ErrorLine,
  FadingValue,
  MethodCardsSkeleton,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  Skeleton,
  StatusChip,
  chipOf,
  enterDelay,
} from "./primitives";

export function WithdrawTab() {
  const methods = usePaymentMethods(true);
  const withdrawals = useWithdrawals(true);
  const wallet = useWallet(true);
  const create = useCreateWithdrawal();

  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const rows = withdrawals.data ?? [];
  const open = rows.find((row) => isOpenWithdrawal(row.status)) ?? null;

  const active = useMemo<PaymentMethodView | null>(() => {
    const list = methods.data ?? [];
    return list.find((method) => method.id === methodId) ?? list[0] ?? null;
  }, [methods.data, methodId]);

  const scale = active === null ? 0 : scaleOf(active.minAmount);
  const minor = active === null ? null : toMinor(amount, scale);
  const canSubmit =
    active !== null && minor !== null && BigInt(minor) > 0n && address.trim().length > 0;

  const balance = wallet.data?.casino.balance?.amount ?? null;

  async function submit(): Promise<void> {
    if (active === null || minor === null) return;
    setFailure(null);
    try {
      await create.mutateAsync({
        paymentMethodId: active.id,
        amount: fromMinor(minor, scale),
        currencyCode: active.currencyCode,
        payoutAddress: address.trim(),
      });
      setAmount("");
      setAddress("");
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  // The same three-step shape the screen is about to have, so nothing moves when it arrives.
  if (methods.isPending) {
    return (
      <div className="space-y-7">
        <section className="space-y-3">
          <SectionTitle>1 · طريقة الاستلام</SectionTitle>
          <MethodCardsSkeleton />
        </section>
        <section className="space-y-3">
          <SectionTitle>2 · المبلغ</SectionTitle>
          <Skeleton className="h-[124px] rounded-2xl" />
        </section>
        <section className="space-y-3">
          <SectionTitle>3 · حساب الاستلام</SectionTitle>
          <Skeleton className="h-[136px] rounded-2xl" />
        </section>
      </div>
    );
  }
  if (methods.isError) {
    return <ErrorLine message={errorMessage(methods.error)} onRetry={() => void methods.refetch()} />;
  }

  return (
    <div className="space-y-7">
      {open !== null ? (
        <section className="space-y-3">
          <SectionTitle
            action={<Refreshing show={withdrawals.isFetching && !withdrawals.isPending} />}
          >
            طلب السحب الحالي
          </SectionTitle>
          <Card className="app-enter space-y-2 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold tabular-nums" dir="ltr">
                {formatAmount(open.amount.amount)} {open.amount.currency}
              </span>
              <StatusChip status={chipOf(open.status)} />
            </div>
            <p className="text-[12px] text-ink-muted">
              {open.methodName} · {open.payoutAddress}
              {open.payoutNetwork === null ? "" : ` · ${open.payoutNetwork}`}
            </p>
            <p className="text-[11px] text-ink-muted">
              طلبك قيد المعالجة. لا يمكن فتح طلب سحب جديد قبل إنهاء هذا الطلب.
            </p>
          </Card>
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle>1 · طريقة الاستلام</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {(methods.data ?? []).map((method, index) => {
                const selected = method.id === active?.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      tap();
                      setMethodId(method.id);
                    }}
                    style={enterDelay(index)}
                    className={cn(
                      "app-enter rounded-2xl p-4 text-start shadow-teller ring-1",
                      "transition active:scale-[0.98]",
                      selected
                        ? "bg-brand-soft ring-brand/50"
                        : "bg-card ring-hairline hover:ring-brand/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-3 grid size-9 place-items-center rounded-xl transition-colors",
                        selected
                          ? "bg-brand text-brand-foreground"
                          : "bg-secondary text-ink-muted",
                      )}
                    >
                      {method.rail === "BANK_TRANSFER" ? (
                        <Landmark className="size-4" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                    </div>
                    <div className="text-sm font-medium">{method.displayName}</div>
                    <div className="text-[10px] tabular-nums text-ink-muted" dir="ltr">
                      {formatWhole(method.minAmount)} - {formatWhole(method.maxAmount)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>2 · المبلغ</SectionTitle>
            <Card className="space-y-4 p-5">
              <div className="flex items-baseline gap-2 border-b border-hairline pb-3" dir="ltr">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="numeric"
                  className="w-full bg-transparent text-3xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-ink-muted/40"
                  placeholder="0"
                />
                <span className="text-base font-medium text-brand">
                  {active?.currencyCode ?? ""}
                </span>
              </div>
              {balance !== null && (
                <p className="text-[11px] tabular-nums text-ink-muted" dir="rtl">
                  رصيدك على المنصة: <FadingValue value={formatAmount(balance)} />{" "}
                  {wallet.data?.currency ?? ""}
                </p>
              )}
            </Card>
          </section>

          <section className="space-y-3">
            <SectionTitle>3 · حساب الاستلام</SectionTitle>
            <Card className="space-y-1.5 p-5">
              <label className="px-1 text-xs font-medium" htmlFor="payout-address">
                {active?.rail === "CRYPTO" ? "عنوان المحفظة" : "رقم الحساب"}
              </label>
              <input
                id="payout-address"
                dir="ltr"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={active?.rail === "CRYPTO" ? "T… أو 0x…" : "09xxxxxxxx"}
                className="w-full rounded-xl border border-hairline bg-secondary px-3 py-2.5 font-mono text-sm outline-none transition-shadow focus:ring-2 focus:ring-brand/25"
              />
              <p className="px-1 pt-1 text-[11px] text-ink-muted">
                تأكد من العنوان جيداً — التحويل لا يمكن التراجع عنه.
              </p>
            </Card>
          </section>

          {failure !== null && <ErrorLine message={failure} />}

          <button
            type="button"
            disabled={!canSubmit || create.isPending}
            onClick={() => {
              tap();
              void submit();
            }}
            className={cn(
              "w-full rounded-2xl bg-brand py-4 text-base font-medium text-brand-foreground",
              "shadow-teller ring-1 ring-brand transition active:scale-[0.98] disabled:opacity-50",
              create.isPending && "app-busy",
            )}
          >
            {create.isPending ? "جارٍ الإرسال…" : "إرسال طلب السحب"}
          </button>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle
          action={
            // Only when there is no open request above: both sections read the same query, and two
            // identical hints on one screen look like two different things are happening.
            <Refreshing show={open === null && withdrawals.isFetching && !withdrawals.isPending} />
          }
        >
          سجل السحوبات
        </SectionTitle>
        {withdrawals.isPending ? (
          <RowsSkeleton count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ArrowDownToLine}
            title="لا توجد سحوبات بعد"
            hint="كل طلب سحب يظهر هنا مع حالته حتى يصل المبلغ إلى حسابك."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const { day, month } = dayMonthOf(row.requestedAt);
              return (
                <Card
                  key={row.shortId}
                  style={enterDelay(index)}
                  className="app-enter flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary">
                      <span className="text-[11px] font-bold tabular-nums">{day}</span>
                      <span className="text-[9px] text-ink-muted">{month}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium tabular-nums" dir="ltr">
                        {formatAmount(row.amount.amount)} {row.amount.currency}
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        {row.methodName} · {timeOf(row.requestedAt)} · {row.shortId}
                      </div>
                    </div>
                  </div>
                  <StatusChip status={chipOf(row.status)} />
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
