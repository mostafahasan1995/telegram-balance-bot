/**
 * The deposit, as the backend models it: the request is opened FIRST, and only then does the player
 * learn which account to pay into.
 *
 * WHY THAT ORDER AND NOT A FORM THAT POSTS EVERYTHING AT ONCE: the destination is assigned by the
 * server (a rotation, sticky per player for 24h), so an app that showed an account before opening
 * the request would be showing one it guessed. The screen is therefore two states — "open a
 * request" and "finish the open one" — and the open request is read from the server, never held in
 * component state, so closing the app mid-payment loses nothing.
 */
import { ImagePlus, Landmark, ReceiptText, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  isOpenDeposit,
  useCancelDeposit,
  useCreateDeposit,
  useDeposits,
  usePaymentMethods,
  useSubmitProof,
  useSubmitReference,
  useSubmitTxHash,
} from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type { DepositView, PaymentMethodView } from "@/lib/api/types";
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
  CopyField,
  EmptyState,
  ErrorLine,
  MethodCardsSkeleton,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  Skeleton,
  StatusChip,
  chipOf,
  enterDelay,
} from "./primitives";

/** Offered as quick taps beside the amount box, in whole currency units. */
const QUICK_AMOUNTS = ["25000", "50000", "100000", "250000"];

/** The statuses where the player still owes us evidence — the ones the panel can finish. */
function needsEvidence(deposit: DepositView): boolean {
  return deposit.status === "DRAFT" || deposit.status === "AWAITING_PROOF";
}

export function DepositTab() {
  const methods = usePaymentMethods(true);
  const deposits = useDeposits(true);
  const create = useCreateDeposit();

  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const rows = deposits.data ?? [];
  const open = rows.find((row) => isOpenDeposit(row.status) && needsEvidence(row)) ?? null;

  const active = useMemo<PaymentMethodView | null>(() => {
    const list = methods.data ?? [];
    if (list.length === 0) return null;
    return list.find((method) => method.id === methodId) ?? list[0] ?? null;
  }, [methods.data, methodId]);

  const scale = active === null ? 0 : scaleOf(active.minAmount);
  const minor = active === null ? null : toMinor(amount, scale);
  const belowMinimum =
    minor !== null && active !== null && BigInt(minor) < BigInt(toMinor(active.minAmount, scale) ?? "0");
  const aboveMaximum =
    minor !== null && active !== null && BigInt(minor) > BigInt(toMinor(active.maxAmount, scale) ?? "0");
  const canSubmit = active !== null && minor !== null && !belowMinimum && !aboveMaximum && BigInt(minor) > 0n;

  async function submit(): Promise<void> {
    if (active === null || minor === null) return;
    setFailure(null);
    try {
      // Validated as minor units above — where a comparison must be exact — and sent as the
      // canonical decimal, which is what the API's MoneyDto takes.
      await create.mutateAsync({
        paymentMethodId: active.id,
        amount: fromMinor(minor, scale),
        currencyCode: active.currencyCode,
      });
      setAmount("");
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  // Shaped like the screen that is coming, not a sentence where it will be: the player's eye is
  // already on the method grid by the time the answer lands.
  if (methods.isPending) {
    return (
      <div className="space-y-7">
        <section className="space-y-3">
          <SectionTitle>1 · اختر طريقة الدفع</SectionTitle>
          <MethodCardsSkeleton />
        </section>
        <section className="space-y-3">
          <SectionTitle>2 · المبلغ</SectionTitle>
          <Skeleton className="h-[164px] rounded-2xl" />
        </section>
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    );
  }
  if (methods.isError) {
    return <ErrorLine message={errorMessage(methods.error)} onRetry={() => void methods.refetch()} />;
  }

  return (
    <div className="space-y-7">
      {open !== null ? (
        <FinishPanel deposit={open} />
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle>1 · اختر طريقة الدفع</SectionTitle>
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
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      tap();
                      setAmount(value);
                    }}
                    className={cn(
                      "rounded-full bg-secondary px-3 py-1.5 text-xs font-medium tabular-nums",
                      "ring-1 ring-hairline transition hover:ring-brand/40",
                      "active:scale-95 active:bg-brand-soft active:ring-brand/50",
                    )}
                  >
                    +{formatWhole(value)}
                  </button>
                ))}
              </div>
              <p
                className={cn(
                  "text-[11px] tabular-nums",
                  belowMinimum || aboveMaximum ? "text-bad" : "text-ink-muted",
                )}
              >
                {/* The range is one Latin numeric run, so it carries its own direction. Left to
                    the paragraph's RTL, bidi reorders it and "25,000 - 5,000,000 NSP" is drawn as
                    "NSP 5,000,000 - 25,000" — the minimum and the maximum swapped on screen. */}
                الحد المسموح لهذه الطريقة:{" "}
                <span dir="ltr" className="inline-block">
                  {formatWhole(active?.minAmount ?? "0")} – {formatWhole(active?.maxAmount ?? "0")}{" "}
                  {active?.currencyCode ?? ""}
                </span>
              </p>
            </Card>
          </section>

          {active?.instructions !== null && active?.instructions !== undefined && (
            <Card className="p-4">
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-ink-muted">
                {active.instructions}
              </p>
            </Card>
          )}

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
            {create.isPending ? "جارٍ الإرسال…" : "متابعة"}
          </button>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle action={<Refreshing show={deposits.isFetching && !deposits.isPending} />}>
          سجل الإيداعات
        </SectionTitle>
        {deposits.isPending ? (
          <RowsSkeleton count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="سجلك فارغ حتى الآن"
            hint="كل إيداع ترسله يبقى هنا مع رقمه وحالته، حتى بعد إغلاق التطبيق."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((deposit, index) => {
              const { day, month } = dayMonthOf(deposit.createdAt);
              return (
                <Card
                  key={deposit.shortId}
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
                        {formatAmount(deposit.claimed.amount)} {deposit.claimed.currency}
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        {deposit.destination?.methodName ?? "—"} · {timeOf(deposit.createdAt)} ·{" "}
                        {deposit.shortId}
                      </div>
                    </div>
                  </div>
                  <StatusChip status={chipOf(deposit.status)} />
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The open request: where to send the money, and the one thing we still need back.
 *
 * WHICH FIELD IS ASKED FOR COMES FROM THE SERVER (`destination.requiresReference` and the rail),
 * never from a hardcoded list of method codes — an operator adding a rail must not require an app
 * release.
 */
function FinishPanel({ deposit }: { deposit: DepositView }) {
  const reference = useSubmitReference();
  const txHash = useSubmitTxHash();
  const proof = useSubmitProof();
  const cancel = useCancelDeposit();

  const [value, setValue] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const destination = deposit.destination;
  const isCrypto = destination?.methodCode.toLowerCase().includes("usdt") === true;

  async function send(): Promise<void> {
    tap();
    setFailure(null);
    try {
      if (isCrypto) await txHash.mutateAsync({ shortId: deposit.shortId, txHash: value.trim() });
      else await reference.mutateAsync({ shortId: deposit.shortId, reference: value.trim() });
      setValue("");
      setSent(true);
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  async function attach(file: File): Promise<void> {
    setFailure(null);
    try {
      const imageBase64 = await readAsDataUrl(file);
      await proof.mutateAsync({ shortId: deposit.shortId, imageBase64, mimeType: file.type });
      setSent(true);
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  const busy = reference.isPending || txHash.isPending || proof.isPending;

  return (
    <section className="space-y-3">
      <SectionTitle>أكمل طلبك</SectionTitle>
      <Card className="app-enter space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="text-base font-medium">
            حوّل {formatAmount(deposit.claimed.amount)} {deposit.claimed.currency}
          </h3>
          <p className="text-sm text-ink-muted">
            إلى الحساب التالي، ثم أرسل {isCrypto ? "رقم العملية (TXID)" : "رقم العملية"} هنا.
          </p>
        </div>

        {destination?.accountIdentifier !== null && destination?.accountIdentifier !== undefined && (
          <CopyField label={destination.label ?? destination.methodName} value={destination.accountIdentifier} />
        )}
        {destination?.accountHolder !== null && destination?.accountHolder !== undefined && (
          <CopyField label="اسم صاحب الحساب" value={destination.accountHolder} mono={false} />
        )}
        {destination?.instructions !== null && destination?.instructions !== undefined && (
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-ink-muted">
            {destination.instructions}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="px-1 text-xs font-medium" htmlFor="deposit-reference">
            {isCrypto ? "رقم العملية (TXID)" : "رقم العملية"}
          </label>
          <input
            id="deposit-reference"
            dir="ltr"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={isCrypto ? "0x…" : "000000000"}
            className="w-full rounded-xl border border-hairline bg-secondary px-3 py-2.5 font-mono text-sm outline-none transition-shadow focus:ring-2 focus:ring-brand/25"
          />
        </div>

        <div className="space-y-1.5">
          <span className="px-1 text-xs font-medium">إيصال الدفع (اختياري)</span>
          <label
            className={cn(
              "grid aspect-[4/3] w-full cursor-pointer place-items-center rounded-2xl bg-secondary",
              "outline-1 -outline-offset-1 outline-hairline transition hover:bg-accent",
              "active:scale-[0.99] active:outline-brand/40",
              proof.isPending && "app-busy",
            )}
          >
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void attach(file);
              }}
            />
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="size-6 text-ink-muted" />
              <span className="text-[10px] font-medium tracking-[0.15em] text-ink-muted">
                {proof.isPending ? "جارٍ الرفع…" : "ارفاق صورة الإيصال"}
              </span>
            </div>
          </label>
        </div>

        {failure !== null && <ErrorLine message={failure} />}
        {sent && failure === null && (
          <p className="app-enter rounded-xl bg-ok-soft px-3 py-2 text-center text-[12px] text-ok">
            ✅ وصل طلبك، سيتم مراجعته خلال دقائق.
          </p>
        )}

        <button
          type="button"
          disabled={value.trim().length === 0 || busy}
          onClick={() => void send()}
          className={cn(
            "w-full rounded-2xl bg-brand py-3.5 text-sm font-medium text-brand-foreground",
            "ring-1 ring-brand transition active:scale-[0.98] disabled:opacity-50",
            busy && "app-busy",
          )}
        >
          {busy ? "جارٍ الإرسال…" : "إرسال"}
        </button>

        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => {
            tap();
            setFailure(null);
            cancel.mutate(deposit.shortId, {
              onError: (cause: unknown) => setFailure(errorMessage(cause)),
            });
          }}
          className="w-full text-center text-[11px] font-medium text-ink-muted underline underline-offset-4 transition active:scale-95 active:text-bad"
        >
          إلغاء الطلب
        </button>
      </Card>
    </section>
  );
}

/** FileReader, promisified. The backend accepts the whole `data:` URL, prefix included. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("could not read the file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}
