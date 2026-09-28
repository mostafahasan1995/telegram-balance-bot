/**
 * 🎁 إهداء رصيد — give part of your balance to another player, on the same service the bot's button
 * calls (GiftService in the backend).
 *
 * THE SAME THREE STEPS AS THE BOT, IN THE SAME ORDER:
 *  1. WHO. The player types a @username or the friend's account (🆔) and presses «تحقق». The server
 *     answers with a first name and a masked handle — as much as a player may know about another —
 *     or with the sentence that says why not (not found, yourself, cannot receive gifts).
 *  2. HOW MUCH, with the balance, the smallest and largest gift and what is left of today beside it.
 *  3. CONFIRM. A summary card and a second press: a gift does not come back once it lands.
 *
 * NOTHING HERE DECIDES A RULE. Every limit is the server's and every refusal is shown verbatim
 * (already Arabic, already written for the player). The money moves on a worker seconds after the
 * POST, so the gift's row settles by itself below while the list polls (useGifts).
 *
 * The RECIPIENT sent is exactly the text the check answered for: editing the box after a check
 * clears the check, so the name on the confirmation card is always the person the gift goes to.
 */
import { Gift, Search, UserRound } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  isSettlingGift,
  useCheckGiftRecipient,
  useCreateGift,
  useGiftLimits,
  useGifts,
} from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type { GiftRecipientPreviewView, GiftStatus, PlayerGiftView } from "@/lib/api/types";
import { formatAmount, fromMinor, scaleOf, timeOf, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  EmptyState,
  ErrorLine,
  Hero,
  Money,
  Num,
  OperationRow,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
  Skeleton,
  StepTitle,
} from "./primitives";
import type { ChipStatus } from "./row-style";

/** The colour a gift wears: delivered or paid back is settled, a refusal is "no", the rest waits. */
function giftChip(status: GiftStatus): ChipStatus {
  if (status === "COMPLETED") return "approved";
  if (status === "DEBIT_FAILED" || status === "REFUNDED") return "rejected";
  return "pending";
}

/** What a gift's status means, in the player's words. */
const GIFT_WORDS: Record<GiftStatus, string> = {
  REQUESTED: "جاري التحويل…",
  DEBITING: "جاري التحويل…",
  DEBITED: "جاري التحويل…",
  CREDITING: "جاري التحويل…",
  COMPLETED: "وصلت",
  DEBIT_FAILED: "ما تم الإهداء — ما انخصم شي",
  REFUNDING: "جاري إرجاع المبلغ…",
  REFUNDED: "رجع المبلغ لرصيدك",
  NEEDS_RECONCILIATION: "قيد المراجعة من فريقنا",
};

const nameOf = (person: { firstName: string | null; maskedUsername: string | null }): string =>
  person.firstName ?? person.maskedUsername ?? "لاعب";

export function GiftTab() {
  const limits = useGiftLimits(true);
  const gifts = useGifts(true);
  const check = useCheckGiftRecipient();
  const create = useCreateGift();

  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<GiftRecipientPreviewView | null>(null);
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const rules = limits.data;
  const scale = rules === undefined ? 0 : scaleOf(rules.min.amount);
  const minor = rules === undefined ? null : toMinor(amount, scale);
  const canConfirm = recipient !== null && minor !== null && BigInt(minor) > 0n;

  const rows = gifts.data ?? [];
  const latest = sent === null ? null : (rows.find((row) => row.shortId === sent) ?? null);

  async function runCheck(): Promise<void> {
    const text = recipientText.trim();
    if (text.length === 0) return;
    setFailure(null);
    setRecipient(null);
    try {
      setRecipient(await check.mutateAsync(text));
    } catch (cause: unknown) {
      setFailure(errorMessage(cause));
    }
  }

  async function submit(): Promise<void> {
    if (recipient === null || minor === null || rules === undefined) return;
    setFailure(null);
    try {
      const gift = await create.mutateAsync({
        recipient: recipient.query,
        amount: fromMinor(minor, scale),
        currencyCode: rules.currencyCode,
      });
      setSent(gift.shortId);
      setConfirming(false);
      setAmount("");
      setRecipient(null);
      setRecipientText("");
    } catch (cause: unknown) {
      setConfirming(false);
      setFailure(errorMessage(cause));
    }
  }

  // The same shape the screen is about to have, so nothing moves when it arrives.
  if (limits.isPending) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <StepTitle step={1}>لمين الهدية؟</StepTitle>
          <Skeleton className="h-[112px] rounded-xl" />
        </section>
        <section className="space-y-3">
          <StepTitle step={2}>المبلغ</StepTitle>
          <Skeleton className="h-[124px] rounded-2xl" />
        </section>
      </div>
    );
  }
  if (limits.isError || rules === undefined) {
    return <ErrorLine message={errorMessage(limits.error)} onRetry={() => void limits.refetch()} />;
  }
  if (!rules.enabled) {
    return (
      <EmptyState
        icon={Gift}
        title="إهداء الرصيد متوقف حالياً"
        hint="رح نرجع نفتح الخدمة قريباً إن شاء الله."
      />
    );
  }

  return (
    <div className="space-y-6">
      {latest !== null && (
        <Hero className="app-enter space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Money
              amount={formatAmount(latest.amount.amount)}
              currency={latest.amount.currency}
              className="text-figure font-semibold text-ink"
              unitClassName="text-small"
            />
            <span
              className={cn(
                "shrink-0 text-small font-semibold",
                isSettlingGift(latest.status) && "app-waiting",
              )}
            >
              {GIFT_WORDS[latest.status]}
            </span>
          </div>
          <p className="text-small text-ink-muted">
            إلى {nameOf(latest.counterparty)} · <Num>{latest.shortId}</Num>
          </p>
        </Hero>
      )}

      <section className="space-y-3">
        <StepTitle step={1}>لمين الهدية؟</StepTitle>
        <Card className="space-y-2">
          <label className="block text-small font-semibold text-ink" htmlFor="gift-recipient">
            @اسم المستخدم أو رقم الحساب (🆔)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="gift-recipient"
              dir="ltr"
              value={recipientText}
              onChange={(event) => {
                setRecipientText(event.target.value);
                // A changed box is a different person: the old answer no longer describes it.
                setRecipient(null);
                setConfirming(false);
              }}
              placeholder="@username"
              autoComplete="off"
              className="app-field app-code min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label="تحقق من المستلم"
              disabled={recipientText.trim().length === 0 || check.isPending}
              onClick={() => {
                tap();
                void runCheck();
              }}
              className={cn(
                "app-tile size-11 shrink-0 bg-brand text-brand-foreground transition active:scale-95",
                check.isPending && "app-busy",
              )}
            >
              <Search className="size-4" />
            </button>
          </div>
          {recipient !== null && (
            <div className="app-inset app-enter flex items-center gap-3 p-3">
              <span className="app-tile app-tile-brand size-9">
                <UserRound className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-ink">
                  {nameOf(recipient)}
                </span>
                {recipient.firstName !== null && recipient.maskedUsername !== null && (
                  <Num className="block truncate text-micro text-ink-muted">
                    {recipient.maskedUsername}
                  </Num>
                )}
              </span>
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <StepTitle step={2}>المبلغ</StepTitle>
        <Hero className="space-y-3">
          <div className="flex items-baseline gap-2 border-b border-hairline pb-3">
            <input
              dir="ltr"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setConfirming(false);
              }}
              inputMode="numeric"
              aria-label="مبلغ الهدية"
              placeholder="0"
              className={cn(
                "app-num min-w-0 flex-1 bg-transparent text-end text-display font-semibold",
                "outline-none placeholder:text-ink-muted/50",
              )}
            />
            <span className="shrink-0 text-body font-semibold text-ink-muted">
              {rules.currencyCode}
            </span>
          </div>
          {rules.balance !== null && (
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-micro text-ink-muted">رصيدك</span>
              <Money
                fade
                amount={formatAmount(rules.balance.amount)}
                currency={rules.currencyCode}
                className="text-small font-semibold text-ink"
                unitClassName="text-micro"
              />
            </div>
          )}
          <p className="text-micro text-ink-muted">
            أقل مبلغ <Num>{formatAmount(rules.min.amount)}</Num> — أكبر مبلغ{" "}
            <Num>{formatAmount(rules.max.amount)}</Num> · المتبقي لك اليوم{" "}
            <Num>{formatAmount(rules.remainingTodayAmount.amount)}</Num> (
            <Num>{rules.remainingTodayCount}</Num> هدايا)
          </p>
        </Hero>
      </section>

      {failure !== null && <ErrorLine message={failure} />}

      {confirming && recipient !== null && minor !== null ? (
        <Card className="app-enter space-y-3">
          <p className="text-body font-semibold text-ink">🎁 تأكيد الإهداء</p>
          <p className="text-small text-ink">
            إلى <span className="font-semibold">{nameOf(recipient)}</span>:{" "}
            <Num className="font-semibold">{formatAmount(fromMinor(minor, scale))}</Num>{" "}
            {rules.currencyCode}
          </p>
          <p className="text-micro text-ink-muted">
            تأكد من الاسم والمبلغ، الهدية ما بترجع بعد ما توصل.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              busy={create.isPending}
              disabled={create.isPending}
              onClick={() => {
                tap();
                void submit();
              }}
            >
              {create.isPending ? "جاري التحويل…" : "✅ تأكيد"}
            </ActionButton>
            <ActionButton
              tone="secondary"
              disabled={create.isPending}
              onClick={() => {
                tap();
                setConfirming(false);
              }}
            >
              ❌ إلغاء
            </ActionButton>
          </div>
        </Card>
      ) : (
        <ActionButton
          icon={Gift}
          disabled={!canConfirm}
          onClick={() => {
            tap();
            setFailure(null);
            setConfirming(true);
          }}
        >
          إهداء
        </ActionButton>
      )}

      <section className="space-y-3">
        <SectionTitle action={<Refreshing show={gifts.isFetching && !gifts.isPending} />}>
          هداياك
        </SectionTitle>
        {gifts.isPending ? (
          <RowsSkeleton count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="ما في هدايا بعد"
            hint="كل هدية بتبعتها أو بتوصلك بتظهر هون مع حالتها."
          />
        ) : (
          <div className="space-y-2.5">
            {rows.map((row, index) => (
              <GiftRow key={row.shortId} row={row} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GiftRow({ row, index }: { row: PlayerGiftView; index: number }) {
  const who =
    row.direction === "SENT" ? `إلى ${nameOf(row.counterparty)}` : `من ${nameOf(row.counterparty)}`;
  return (
    <OperationRow
      index={index}
      at={row.createdAt}
      amount={formatAmount(row.amount.amount)}
      currency={row.amount.currency}
      meta={[who, GIFT_WORDS[row.status], timeOf(row.createdAt), row.shortId]}
      status={giftChip(row.status)}
    />
  );
}
