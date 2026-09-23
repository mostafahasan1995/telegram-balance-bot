/**
 * The deposit, as the backend models it: the request is opened FIRST, and only then does the player
 * learn which account to pay into.
 *
 * WHY THAT ORDER AND NOT A FORM THAT POSTS EVERYTHING AT ONCE: the destination is assigned by the
 * server (a rotation, sticky per player for 24h), so an app that showed an account before opening
 * the request would be showing one it guessed. The screen is therefore two states — "open a
 * request" and "finish the open one" — and the open request is read from the server, never held in
 * component state, so closing the app mid-payment loses nothing.
 *
 * ONE ELEVATED SURFACE, like every other screen: whatever the player is doing right now. That is
 * the amount box while a request is being written, and the open request once there is one.
 */
import { CheckCircle2, ImagePlus, Landmark, ReceiptText, Wallet } from "lucide-react";
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
import { formatAmount, formatWhole, fromMinor, scaleOf, timeOf, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  CopyField,
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
  StepTitle,
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
    minor !== null &&
    active !== null &&
    BigInt(minor) < BigInt(toMinor(active.minAmount, scale) ?? "0");
  const aboveMaximum =
    minor !== null &&
    active !== null &&
    BigInt(minor) > BigInt(toMinor(active.maxAmount, scale) ?? "0");
  const canSubmit =
    active !== null && minor !== null && !belowMinimum && !aboveMaximum && BigInt(minor) > 0n;

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
      <div className="space-y-6">
        <section className="space-y-3">
          <StepTitle step={1}>اختر طريقة الدفع</StepTitle>
          <MethodCardsSkeleton />
        </section>
        <section className="space-y-3">
          <StepTitle step={2}>المبلغ</StepTitle>
          <Skeleton className="h-[168px] rounded-2xl" />
        </section>
        <Skeleton className="h-12 rounded-lg" />
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
        <FinishPanel deposit={open} />
      ) : (
        <>
          <section className="space-y-3">
            <StepTitle step={1}>اختر طريقة الدفع</StepTitle>
            <div className="grid grid-cols-2 gap-2.5">
              {(methods.data ?? []).map((method, index) => (
                <MethodCard
                  key={method.id}
                  method={method}
                  index={index}
                  selected={method.id === active?.id}
                  onSelect={() => {
                    tap();
                    setMethodId(method.id);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <StepTitle step={2}>المبلغ</StepTitle>
            <Hero className="space-y-4">
              {/*
               * THE ROW STAYS RTL AND ONLY THE INPUT IS `dir="ltr"`. The digits run left to right
               * inside a field that still begins on the right of the card, like every other line
               * in the app; `text-end` in an LTR box means the figure grows leftward from that
               * starting edge, which is the calculator behaviour a money field wants. The currency
               * labels the field from the far end — it is a form field, not the `<Money>` display
               * pair, and a unit glued to a caret that moves is worse than a unit that stays put.
               */}
              <div className="flex items-baseline gap-2 border-b border-hairline pb-3">
                <input
                  dir="ltr"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="numeric"
                  aria-label="المبلغ"
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
                      "app-inset px-3 py-1.5 text-small font-semibold text-ink",
                      "transition active:scale-95",
                    )}
                  >
                    <Num>+{formatWhole(value)}</Num>
                  </button>
                ))}
              </div>

              <p
                className={cn(
                  "text-micro",
                  belowMinimum || aboveMaximum ? "text-bad" : "text-ink-muted",
                )}
              >
                الحد المسموح لهذه الطريقة:{" "}
                <Num>
                  {formatWhole(active?.minAmount ?? "0")} – {formatWhole(active?.maxAmount ?? "0")}{" "}
                  {active?.currencyCode ?? ""}
                </Num>
              </p>
            </Hero>
          </section>

          {active?.instructions !== null && active?.instructions !== undefined && (
            <Card>
              <p className="whitespace-pre-line break-words text-small text-ink-muted">
                {active.instructions}
              </p>
            </Card>
          )}

          {failure !== null && <ErrorLine message={failure} />}

          <ActionButton
            disabled={!canSubmit || create.isPending}
            busy={create.isPending}
            onClick={() => {
              tap();
              void submit();
            }}
          >
            {create.isPending ? "جارٍ الإرسال…" : "متابعة"}
          </ActionButton>
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
          <div className="space-y-2.5">
            {rows.map((deposit, index) => (
              <OperationRow
                key={deposit.shortId}
                index={index}
                at={deposit.createdAt}
                amount={formatAmount(deposit.claimed.amount)}
                currency={deposit.claimed.currency}
                meta={[
                  deposit.destination?.methodName ?? "",
                  timeOf(deposit.createdAt),
                  deposit.shortId,
                ]}
                status={chipOf(deposit.status)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * One payment method in the two-column grid.
 *
 * FIXED HEIGHT AND `min-w-0`. A grid track is `minmax(0, 1fr)` and therefore cannot grow, but a
 * grid ITEM defaults to `min-width: auto` and will happily overflow its track — which is how a
 * method called "تحويل بنكي — بنك بيمو السعودي الفرنسي" used to push the whole page sideways.
 * The height is fixed so the skeleton that stood here is the same box.
 */
function MethodCard({
  method,
  index,
  selected,
  onSelect,
}: {
  method: PaymentMethodView;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={enterDelay(index)}
      className={cn(
        "app-enter flex h-[116px] min-w-0 flex-col justify-between rounded-xl p-4 text-start",
        "transition active:scale-[0.98]",
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
  const referenceLabel = isCrypto ? "رقم العملية (TXID)" : "رقم العملية";

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
      <Hero className="app-enter space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-title font-semibold text-ink">
            <span>حوّل</span>
            <Money
              amount={formatAmount(deposit.claimed.amount)}
              currency={deposit.claimed.currency}
              unitClassName="text-body text-ink-muted"
            />
          </div>
          <p className="text-small text-ink-muted">
            إلى الحساب التالي، ثم أرسل {referenceLabel} هنا.
          </p>
        </div>

        {destination?.accountIdentifier !== null && destination?.accountIdentifier !== undefined && (
          <CopyField
            label={destination.label ?? destination.methodName}
            value={destination.accountIdentifier}
          />
        )}
        {destination?.accountHolder !== null && destination?.accountHolder !== undefined && (
          <CopyField label="اسم صاحب الحساب" value={destination.accountHolder} mono={false} />
        )}
        {destination?.instructions !== null && destination?.instructions !== undefined && (
          <p className="whitespace-pre-line break-words text-small text-ink-muted">
            {destination.instructions}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="block text-small font-semibold text-ink" htmlFor="deposit-reference">
            {referenceLabel}
          </label>
          <input
            id="deposit-reference"
            dir="ltr"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={isCrypto ? "0x…" : "000000000"}
            className="app-field app-code"
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-small font-semibold text-ink">إيصال الدفع (اختياري)</span>
          <label
            className={cn(
              "grid aspect-[5/3] w-full cursor-pointer place-items-center rounded-xl",
              "bg-secondary outline-1 -outline-offset-1 outline-hairline",
              "transition active:scale-[0.99] active:outline-brand/40",
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
            <span className="flex flex-col items-center gap-2 px-4 text-center">
              <ImagePlus className="size-6 text-ink-muted" />
              {/* No letter-spacing. It pulls joined Arabic letters apart, which is most of why
                  this label used to look broken. */}
              <span className="text-small font-medium text-ink-muted">
                {proof.isPending ? "جارٍ الرفع…" : "إرفاق صورة الإيصال"}
              </span>
            </span>
          </label>
        </div>

        {failure !== null && <ErrorLine message={failure} />}
        {sent && failure === null && (
          <p className="app-enter flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2.5 text-small text-ok">
            <CheckCircle2 className="size-4 shrink-0" />
            وصل طلبك، سيتم مراجعته خلال دقائق.
          </p>
        )}

        <ActionButton
          disabled={value.trim().length === 0 || busy}
          busy={busy}
          onClick={() => void send()}
        >
          {busy ? "جارٍ الإرسال…" : "إرسال"}
        </ActionButton>

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
          className="w-full text-center text-micro font-semibold text-ink-muted underline underline-offset-4"
        >
          إلغاء الطلب
        </button>
      </Hero>
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
