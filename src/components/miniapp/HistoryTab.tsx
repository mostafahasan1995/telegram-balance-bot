/**
 * 📜 سجل المعاملات (owner, 2026-09-27): "the player can follow their withdrawals and deposits, their
 * statuses and their details" — the same history the bot's button shows, as a screen.
 *
 * ONE LIST, BOTH KINDS, NEWEST FIRST. It is built from the two lists the deposit and withdraw
 * screens already read (and already poll while something is open), so a row here changes status by
 * itself exactly when it does there, and opening this screen costs no request the app was not
 * making anyway. A filter narrows it to one kind.
 *
 * A TAP OPENS THE ROW IN PLACE — what the status means in a sentence, the amounts, the method, the
 * reference and the times — rather than a new screen: a player checking three deposits should not
 * have to go back and forth three times.
 */
import { ArrowDownToLine, ReceiptText, ScrollText, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useDeposits, useWithdrawals } from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type { DepositView, Money as MoneyValue, PlayerWithdrawalView } from "@/lib/api/types";
import { dayMonthOf, formatAmount, timeOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  EmptyState,
  ErrorLine,
  FactRow,
  Note,
  Num,
  OperationRow,
  Refreshing,
  RowsSkeleton,
  SectionTitle,
} from "./primitives";
import {
  chipOf,
  depositWords,
  mergeHistory,
  rejectionReason,
  withdrawalWords,
  type HistoryEntry,
  type StatusWords,
} from "./row-style";

type Filter = "all" | "deposit" | "withdrawal";

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "deposit", label: "الإيداعات" },
  { id: "withdrawal", label: "السحوبات" },
];

/** Rows per step of «عرض المزيد». The first screenful is the bot's page: ten. */
const STEP = 10;

export function HistoryTab() {
  const deposits = useDeposits(true);
  const withdrawals = useWithdrawals(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(STEP);
  const [open, setOpen] = useState<string | null>(null);

  const entries = useMemo(
    () => mergeHistory(deposits.data ?? [], withdrawals.data ?? []),
    [deposits.data, withdrawals.data],
  );
  const matching = entries.filter((entry) => filter === "all" || entry.kind === filter);
  const visible = matching.slice(0, shown);

  const pending = deposits.isPending || withdrawals.isPending;
  const failed = deposits.isError || withdrawals.isError;
  const refreshing =
    (deposits.isFetching && !deposits.isPending) ||
    (withdrawals.isFetching && !withdrawals.isPending);

  return (
    <div className="space-y-5">
      <SectionTitle action={<Refreshing show={refreshing} />}>سجل المعاملات</SectionTitle>

      {/* The filter: one inset strip, three segments, the chosen one lifted onto a card. */}
      <div role="tablist" className="app-inset grid grid-cols-3 gap-1 p-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => {
              if (id === filter) return;
              tap();
              setFilter(id);
              setShown(STEP);
            }}
            className={cn(
              "min-w-0 truncate rounded-md px-2 py-1.5 text-small font-semibold transition",
              filter === id ? "bg-card text-ink shadow-teller" : "text-ink-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {pending && <RowsSkeleton count={4} />}
        {failed && !pending && (
          <ErrorLine
            message={errorMessage(deposits.error ?? withdrawals.error)}
            onRetry={() => {
              void deposits.refetch();
              void withdrawals.refetch();
            }}
          />
        )}
        {!pending && !failed && matching.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title="لا توجد عمليات بعد"
            hint="أول إيداع أو سحب تقوم به سيظهر هنا مع حالته خطوة بخطوة."
          />
        )}
        {visible.map((entry, index) => (
          <HistoryRow
            key={entry.key}
            entry={entry}
            index={index}
            expanded={open === entry.key}
            onToggle={() => setOpen((current) => (current === entry.key ? null : entry.key))}
          />
        ))}
      </div>

      {matching.length > visible.length && (
        <ActionButton
          tone="soft"
          onClick={() => {
            tap();
            setShown((count) => count + STEP);
          }}
        >
          عرض المزيد
        </ActionButton>
      )}

      <Note icon={ScrollText}>
        اضغط على أي عملية لترى تفاصيلها. للاستفسار عن عملية، أرسل رقم الطلب إلى الدعم.
      </Note>
    </div>
  );
}

function HistoryRow({
  entry,
  index,
  expanded,
  onToggle,
}: {
  entry: HistoryEntry;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (entry.kind === "deposit") {
    const deposit = entry.deposit;
    const shown = deposit.credited ?? deposit.verified ?? deposit.claimed;
    return (
      <OperationRow
        index={index}
        at={deposit.createdAt}
        amount={formatAmount(shown.amount)}
        currency={shown.currency}
        meta={["إيداع", deposit.destination?.methodName ?? "", deposit.shortId]}
        status={chipOf(deposit.status)}
        expanded={expanded}
        onToggle={onToggle}
      >
        <DepositDetails deposit={deposit} />
      </OperationRow>
    );
  }

  const withdrawal = entry.withdrawal;
  return (
    <OperationRow
      index={index}
      at={withdrawal.requestedAt}
      amount={formatAmount(withdrawal.amount.amount)}
      currency={withdrawal.amount.currency}
      meta={["سحب", withdrawal.methodName, withdrawal.shortId]}
      status={chipOf(withdrawal.status)}
      expanded={expanded}
      onToggle={onToggle}
    >
      <WithdrawalDetails withdrawal={withdrawal} />
    </OperationRow>
  );
}

/** The status in words: its label on a kind icon, and the sentence under it. */
function StatusBlock({ words, icon: Icon }: { words: StatusWords; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3">
      <span className="app-tile app-tile-brand size-8">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-small font-semibold text-ink">{words.label}</p>
        <p className="text-small text-ink-muted">{words.explain}</p>
      </div>
    </div>
  );
}

function MoneyFact({ label, money }: { label: string; money: MoneyValue }) {
  return (
    <FactRow label={label}>
      <Num>
        {formatAmount(money.amount)} {money.currency}
      </Num>
    </FactRow>
  );
}

/** `27 أيلول · 14:05` — the device's clock, like every other time in the app. */
function TimeFact({ label, iso }: { label: string; iso: string | null }) {
  if (iso === null) return null;
  const { day, month } = dayMonthOf(iso);
  return (
    <FactRow label={label}>
      <Num>{day}</Num> {month} · <Num>{timeOf(iso)}</Num>
    </FactRow>
  );
}

const isZero = (money: MoneyValue): boolean => /^0*$/.test(money.minor.replace("-", ""));

function DepositDetails({ deposit }: { deposit: DepositView }) {
  const verifiedDiffers =
    deposit.verified !== null && deposit.verified.minor !== deposit.claimed.minor;
  return (
    <>
      <StatusBlock words={depositWords(deposit.status)} icon={ReceiptText} />
      {/* The reason by its code, in the bot's words — never the staff's free-text note. */}
      {deposit.status === "REJECTED" && deposit.rejectionCode !== null && (
        <p className="rounded-md bg-bad-soft px-3 py-2 text-small text-bad">
          السبب: {rejectionReason(deposit.rejectionCode)}
        </p>
      )}
      <div className="space-y-1.5">
        <FactRow label="رقم الطلب">
          <Num>{deposit.shortId}</Num>
        </FactRow>
        <MoneyFact label="المبلغ المطلوب" money={deposit.claimed} />
        {verifiedDiffers && deposit.verified !== null && (
          <MoneyFact label="المبلغ المؤكَّد" money={deposit.verified} />
        )}
        {!isZero(deposit.fee) && <MoneyFact label="الرسوم" money={deposit.fee} />}
        {deposit.credited !== null && (
          <MoneyFact label="المضاف إلى رصيدك" money={deposit.credited} />
        )}
        {deposit.destination !== null && (
          <FactRow label="الطريقة">{deposit.destination.methodName}</FactRow>
        )}
        {deposit.externalReference !== null && (
          <FactRow label="رقم العملية">
            <span className="app-code">{deposit.externalReference}</span>
          </FactRow>
        )}
        {deposit.senderAccount !== null && (
          <FactRow label="من حساب">
            <span className="app-code">{deposit.senderAccount}</span>
          </FactRow>
        )}
      </div>
      <div className="space-y-1.5">
        <TimeFact label="فتح الطلب" iso={deposit.createdAt} />
        <TimeFact label="إرسال البيانات" iso={deposit.submittedAt} />
        <TimeFact label="القرار" iso={deposit.decidedAt} />
        <TimeFact label="إضافة الرصيد" iso={deposit.creditedAt} />
      </div>
    </>
  );
}

function WithdrawalDetails({ withdrawal }: { withdrawal: PlayerWithdrawalView }) {
  return (
    <>
      <StatusBlock words={withdrawalWords(withdrawal.status)} icon={ArrowDownToLine} />
      <div className="space-y-1.5">
        <FactRow label="رقم الطلب">
          <Num>{withdrawal.shortId}</Num>
        </FactRow>
        <MoneyFact label="المبلغ" money={withdrawal.amount} />
        {!isZero(withdrawal.fee) && <MoneyFact label="الرسوم" money={withdrawal.fee} />}
        <FactRow label="الطريقة">{withdrawal.methodName}</FactRow>
        <FactRow label="إلى">
          <span className="app-code">
            {withdrawal.payoutAddress}
            {withdrawal.payoutNetwork !== null && ` (${withdrawal.payoutNetwork})`}
          </span>
        </FactRow>
      </div>
      <div className="space-y-1.5">
        <TimeFact label="تقديم الطلب" iso={withdrawal.requestedAt} />
        <TimeFact label="القرار" iso={withdrawal.decidedAt} />
        <TimeFact label="التحويل" iso={withdrawal.paidAt} />
      </div>
    </>
  );
}
