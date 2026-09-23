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
 *
 * AND THE ADDRESS IS NEVER TRUNCATED. It is 42 unbreakable characters inside a 288px screen, so it
 * wraps (`.app-code`) — a player checking where their money is going has to be able to read all of
 * it, and an ellipsis in the middle of a wallet address is worse than useless.
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
import { formatAmount, formatWhole, fromMinor, scaleOf, timeOf, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  EmptyState,
  ErrorLine,
  Hero,
  MethodCardsSkeleton,
  Money,
  Num,
  OperationRow,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  Skeleton,
  StatusChip,
  StepTitle,
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
  const isCrypto = active?.rail === "CRYPTO";

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
      <div className="space-y-6">
        <section className="space-y-3">
          <StepTitle step={1}>طريقة الاستلام</StepTitle>
          <MethodCardsSkeleton />
        </section>
        <section className="space-y-3">
          <StepTitle step={2}>المبلغ</StepTitle>
          <Skeleton className="h-[124px] rounded-2xl" />
        </section>
        <section className="space-y-3">
          <StepTitle step={3}>حساب الاستلام</StepTitle>
          <Skeleton className="h-[132px] rounded-xl" />
        </section>
      </div>
    );
  }
  if (methods.isError) {
    return (
      <ErrorLine message={errorMessage(methods.error)} onRetry={() => void methods.refetch()} />
    );
  }

  return (
    <div className="space-y-6">
      {open !== null ? (
        <section className="space-y-3">
          <SectionTitle
            action={<Refreshing show={withdrawals.isFetching && !withdrawals.isPending} />}
          >
            طلب السحب الحالي
          </SectionTitle>
          <Hero className="app-enter space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Money
                amount={formatAmount(open.amount.amount)}
                currency={open.amount.currency}
                className="text-figure font-semibold text-ink"
                unitClassName="text-small"
              />
              <StatusChip status={chipOf(open.status)} />
            </div>

            <div className="app-inset space-y-1 p-3">
              <div className="text-micro font-medium text-ink-muted">حساب الاستلام</div>
              <div className="app-code text-small text-ink">{open.payoutAddress}</div>
            </div>

            <p className="break-words text-micro text-ink-muted">
              {open.methodName}
              {open.payoutNetwork !== null && (
                <>
                  {" · "}
                  <Num>{open.payoutNetwork}</Num>
                </>
              )}
            </p>
            <p className="text-small text-ink-muted">
              طلبك قيد المعالجة. لا يمكن فتح طلب سحب جديد قبل إنهاء هذا الطلب.
            </p>
          </Hero>
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <StepTitle step={1}>طريقة الاستلام</StepTitle>
            <div className="grid grid-cols-2 gap-2.5">
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
                      "app-enter flex h-[116px] min-w-0 flex-col justify-between rounded-xl p-4",
                      "text-start transition active:scale-[0.98]",
                      selected
                        ? "bg-brand-soft outline-2 -outline-offset-2 outline-brand/60"
                        : "app-card-flush",
                    )}
                  >
                    <span
                      className={cn(
                        "app-tile size-9",
                        selected ? "bg-brand text-brand-foreground" : "bg-secondary text-ink-muted",
                      )}
                    >
                      {method.rail === "BANK_TRANSFER" ? (
                        <Landmark className="size-4" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                    </span>
                    <span className="block min-w-0 space-y-0.5">
                      <span className="block truncate text-small font-semibold text-ink">
                        {method.displayName}
                      </span>
                      <span className="block truncate text-micro text-ink-muted">
                        <Num>
                          {formatWhole(method.minAmount)} – {formatWhole(method.maxAmount)}
                        </Num>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <StepTitle step={2}>المبلغ</StepTitle>
            <Hero className="space-y-3">
              <div className="flex items-baseline gap-2 border-b border-hairline pb-3">
                <input
                  dir="ltr"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="numeric"
                  aria-label="مبلغ السحب"
                  placeholder="0"
                  className={cn(
                    "app-num min-w-0 flex-1 bg-transparent text-end text-display font-semibold",
                    "outline-none placeholder:text-ink-muted/50",
                  )}
                />
                <span className="shrink-0 text-body font-semibold text-ink-muted">
                  {active?.currencyCode ?? ""}
                </span>
              </div>
              {balance !== null && (
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-micro text-ink-muted">رصيدك على المنصة</span>
                  <Money
                    fade
                    amount={formatAmount(balance)}
                    currency={wallet.data?.currency ?? ""}
                    className="text-small font-semibold text-ink"
                    unitClassName="text-micro"
                  />
                </div>
              )}
            </Hero>
          </section>

          <section className="space-y-3">
            <StepTitle step={3}>حساب الاستلام</StepTitle>
            <Card className="space-y-1.5">
              <label className="block text-small font-semibold text-ink" htmlFor="payout-address">
                {isCrypto ? "عنوان المحفظة" : "رقم الحساب"}
              </label>
              <input
                id="payout-address"
                dir="ltr"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={isCrypto ? "T… أو 0x…" : "09xxxxxxxx"}
                className="app-field app-code"
              />
              <p className="text-micro text-ink-muted">
                تأكد من العنوان جيداً — التحويل لا يمكن التراجع عنه.
              </p>
            </Card>
          </section>

          {failure !== null && <ErrorLine message={failure} />}

          <ActionButton
            disabled={!canSubmit || create.isPending}
            busy={create.isPending}
            onClick={() => {
              tap();
              void submit();
            }}
          >
            {create.isPending ? "جارٍ الإرسال…" : "إرسال طلب السحب"}
          </ActionButton>
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
          <div className="space-y-2.5">
            {rows.map((row, index) => (
              <OperationRow
                key={row.shortId}
                index={index}
                at={row.requestedAt}
                amount={formatAmount(row.amount.amount)}
                currency={row.amount.currency}
                meta={[row.methodName, timeOf(row.requestedAt), row.shortId]}
                status={chipOf(row.status)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
