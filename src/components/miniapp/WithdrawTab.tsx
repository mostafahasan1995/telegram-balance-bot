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
import { Landmark, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useCreateWithdrawal, usePaymentMethods, useWallet, useWithdrawals } from "@/lib/api/hooks";
import type { PaymentMethodView } from "@/lib/api/types";
import { dayMonthOf, formatAmount, formatWhole, scaleOf, timeOf, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

import { Card, ErrorLine, Loading, SectionTitle, StatusChip, chipOf } from "./primitives";

const OPEN_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];

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
  const open = rows.find((row) => OPEN_STATUSES.includes(row.status)) ?? null;

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
        amountMinor: minor,
        payoutAddress: address.trim(),
      });
      setAmount("");
      setAddress("");
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  if (methods.isPending) return <Loading />;
  if (methods.isError) {
    return <ErrorLine message={errorMessage(methods.error)} onRetry={() => void methods.refetch()} />;
  }

  return (
    <div className="space-y-7">
      {open !== null ? (
        <section className="space-y-3">
          <SectionTitle>طلب السحب الحالي</SectionTitle>
          <Card className="space-y-2 p-5">
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
              {(methods.data ?? []).map((method) => {
                const selected = method.id === active?.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setMethodId(method.id)}
                    className={cn(
                      "rounded-2xl p-4 text-start shadow-teller ring-1 transition-colors",
                      selected
                        ? "bg-brand-soft ring-brand/50"
                        : "bg-card ring-hairline hover:ring-brand/30",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-3 grid size-9 place-items-center rounded-xl",
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
                  رصيدك على المنصة: {formatAmount(balance)} {wallet.data?.currency ?? ""}
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
            onClick={() => void submit()}
            className="w-full rounded-2xl bg-brand py-4 text-base font-medium text-brand-foreground shadow-teller ring-1 ring-brand transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {create.isPending ? "جارٍ الإرسال…" : "إرسال طلب السحب"}
          </button>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle>سجل السحوبات</SectionTitle>
        {withdrawals.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ink-muted">لا توجد سحوبات بعد.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const { day, month } = dayMonthOf(row.requestedAt);
              return (
                <Card key={row.shortId} className="flex items-center justify-between p-3">
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
