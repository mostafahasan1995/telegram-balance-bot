/**
 * The plain functions the screens' lists share with `primitives.tsx`: which colour a row's status
 * chip wears, the stagger a row arrives with, and — for the history screen — what each status means
 * in words and how the two lists become one.
 *
 * They live apart from the components because a module React Fast Refresh can hot-swap must
 * export nothing but components.
 */
import type { CSSProperties } from "react";

import type {
  DepositStatus,
  DepositView,
  PlayerWithdrawalView,
  WithdrawalStatus,
} from "@/lib/api/types";

/**
 * The three colours a request can wear. Deliberately NOT the backend's status enum: a player only
 * needs "waiting", "done" or "no", and mapping the nine real statuses here would put a business
 * rule in a chip. Each screen maps its own rows with `chipOf`.
 */
export type ChipStatus = "pending" | "approved" | "rejected";

/** The one place that decides which colour a deposit or withdrawal wears. */
export function chipOf(status: string): ChipStatus {
  if (status === "CREDITED" || status === "APPROVED" || status === "PAID") return "approved";
  if (
    status === "REJECTED" ||
    status === "EXPIRED" ||
    status === "CANCELLED" ||
    status === "FAILED" ||
    status === "DEBIT_FAILED" ||
    status === "REVERSED"
  ) {
    return "rejected";
  }
  return "pending";
}

/**
 * The stagger a list uses as it arrives.
 *
 * CAPPED ON PURPOSE: twenty deposits at 35ms each would take most of a second to finish appearing,
 * and the twentieth row is not worth waiting for. After the sixth they all arrive together.
 */
export function enterDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 5) * 35}ms` };
}

/**
 * What a status means, in the words the bot's 📜 سجل المعاملات uses for the same row
 * (modules/player/telegram/history.render.ts in the backend): a short label and one sentence that
 * says what is happening and whether the player has to do anything. "قيد المراجعة" on its own is
 * what makes people write to support.
 */
export interface StatusWords {
  label: string;
  explain: string;
}

const NO_ACTION = "لا حاجة لأي إجراء منك.";

const DEPOSIT_WORDS: Record<DepositStatus, StatusWords> = {
  DRAFT: { label: "بانتظار التحويل", explain: "بدأت الطلب ولم تصلنا بيانات التحويل بعد." },
  AWAITING_PROOF: {
    label: "بانتظار الإثبات",
    explain: "أرسل رقم العملية أو صورة الإيصال ليتمكن فريقنا من مراجعة طلبك.",
  },
  SUBMITTED: {
    label: "قيد المراجعة",
    explain: `وصلتنا بيانات التحويل، وسيراجعها فريقنا خلال دقائق. ${NO_ACTION}`,
  },
  UNDER_REVIEW: { label: "قيد المراجعة", explain: `أحد موظفينا يراجع طلبك الآن. ${NO_ACTION}` },
  PENDING_SECOND_APPROVAL: {
    label: "قيد المراجعة",
    explain: `طلبك بانتظار موافقة ثانية، وهذا إجراء أمان معتاد. ${NO_ACTION}`,
  },
  APPROVED: {
    label: "تمت الموافقة",
    explain: "تمت الموافقة على طلبك، وجارٍ إضافة الرصيد إلى حسابك.",
  },
  CREDITING: { label: "جارٍ الشحن", explain: "جارٍ إضافة الرصيد إلى حسابك في Ichancy." },
  CREDITED: { label: "تم الشحن", explain: "أُضيف المبلغ إلى رصيدك في Ichancy." },
  CREDIT_FAILED: {
    label: "قيد المتابعة",
    explain: `تم التحقق من دفعتك، لكن إضافة الرصيد تأخذ وقتاً أطول من المعتاد. فريقنا يتابع الأمر، و${NO_ACTION}`,
  },
  NEEDS_RECONCILIATION: {
    label: "قيد المتابعة",
    explain: `فريقنا يتأكد يدوياً من وصول الرصيد إلى حسابك. ${NO_ACTION}`,
  },
  REJECTED: {
    label: "مرفوض",
    explain: "لم يُقبل الطلب. إذا كنت تعتقد أن هناك خطأ، تواصل مع الدعم.",
  },
  EXPIRED: {
    label: "منتهي الصلاحية",
    explain:
      "انتهت صلاحية الطلب لأن بيانات التحويل لم تصل في الوقت المحدد. يمكنك بدء إيداع جديد متى شئت.",
  },
  REVERSED: {
    label: "مُلغى",
    explain: "أُلغيت هذه العملية بعد تنفيذها. للاستفسار تواصل مع الدعم.",
  },
  CANCELLED: { label: "ملغى", explain: "أُلغي الطلب ولم يُضف أو يُخصم أي مبلغ." },
};

const WITHDRAWAL_WORDS: Record<WithdrawalStatus, StatusWords> = {
  REQUESTED: {
    label: "قيد المراجعة",
    explain: `وصلنا طلبك، وسيراجعه فريقنا قريباً. ${NO_ACTION}`,
  },
  UNDER_REVIEW: { label: "قيد المراجعة", explain: `أحد موظفينا يراجع طلبك الآن. ${NO_ACTION}` },
  APPROVED: { label: "تمت الموافقة", explain: "تمت الموافقة على طلبك، وجارٍ تنفيذه." },
  DEBITING: { label: "قيد التنفيذ", explain: "جارٍ خصم المبلغ من رصيدك في Ichancy." },
  DEBITED: { label: "قيد التحويل", explain: "خُصم المبلغ من رصيدك، وسيصلك التحويل قريباً." },
  PAYING: { label: "قيد التحويل", explain: `جارٍ إرسال المبلغ إلى حسابك. ${NO_ACTION}` },
  PAID: { label: "تم التحويل", explain: "تم تحويل المبلغ إلى الحساب الذي حددته." },
  DEBIT_FAILED: {
    label: "تعذّر التنفيذ",
    explain: "لم يُخصم أي مبلغ من رصيدك. للاستفسار تواصل مع الدعم.",
  },
  NEEDS_RECONCILIATION: {
    label: "قيد المتابعة",
    explain: `فريقنا يتأكد يدوياً من العملية. ${NO_ACTION}`,
  },
  REJECTED: {
    label: "مرفوض",
    explain: "تم رفض الطلب ولم يُخصم أي مبلغ من رصيدك. للاستفسار تواصل مع الدعم.",
  },
  CANCELLED: { label: "ملغى", explain: "أُلغي الطلب ولم يُخصم أي مبلغ من رصيدك." },
  FAILED: {
    label: "تعذّر التنفيذ",
    explain: "لم يُخصم أي مبلغ من رصيدك. للاستفسار تواصل مع الدعم.",
  },
};

/** A status this build has no words for (the backend grew one): said by its colour, not left blank. */
function fallbackWords(status: string): StatusWords {
  const chip = chipOf(status);
  if (chip === "approved") return { label: "مكتمل", explain: "اكتملت هذه العملية." };
  if (chip === "rejected") return { label: "لم تكتمل", explain: "للاستفسار تواصل مع الدعم." };
  return { label: "قيد المعالجة", explain: `طلبك قيد المعالجة. ${NO_ACTION}` };
}

export function depositWords(status: string): StatusWords {
  return Object.prototype.hasOwnProperty.call(DEPOSIT_WORDS, status)
    ? DEPOSIT_WORDS[status as DepositStatus]
    : fallbackWords(status);
}

export function withdrawalWords(status: string): StatusWords {
  return Object.prototype.hasOwnProperty.call(WITHDRAWAL_WORDS, status)
    ? WITHDRAWAL_WORDS[status as WithdrawalStatus]
    : fallbackWords(status);
}

/**
 * Why a deposit was refused, by its `rejectionCode`, in the words the bot uses (AR_REJECTION_REASONS
 * in the backend's messages.ts) — deliberately vaguer where naming the check would teach someone to
 * get round it. The staff's free-text note is never shown: it is written for colleagues.
 */
const REJECTION_REASONS: Readonly<Record<string, string>> = {
  DUPLICATE_PROOF: "هذا الإثبات أو رقم العملية مستخدم مسبقاً.",
  PROOF_UNREADABLE: "صورة الإثبات غير واضحة.",
  PROOF_MISSING: "لم يصل إثبات التحويل.",
  AMOUNT_MISMATCH: "المبلغ المحوّل لا يطابق مبلغ الطلب.",
  REFERENCE_NOT_FOUND: "لم يتم العثور على العملية.",
  WRONG_DESTINATION: "التحويل لم يصل إلى الحساب المطلوب.",
  SENDER_MISMATCH: "تعذر التحقق من العملية.",
  SUSPECTED_FRAUD: "تعذر التحقق من العملية.",
  LIMIT_EXCEEDED: "تم تجاوز الحد المسموح للإيداع.",
  PLAYER_INELIGIBLE: "الحساب غير مؤهل للإيداع حالياً.",
  EXPIRED: "انتهت صلاحية الطلب.",
  OTHER: "تعذر قبول العملية.",
};

export function rejectionReason(code: string): string {
  const known = Object.prototype.hasOwnProperty.call(REJECTION_REASONS, code);
  return (known ? REJECTION_REASONS[code] : undefined) ?? "تعذر قبول العملية.";
}

/** One row of the history screen: a deposit or a withdrawal, with the time it is ordered by. */
export type HistoryEntry =
  | { kind: "deposit"; key: string; at: string; deposit: DepositView }
  | { kind: "withdrawal"; key: string; at: string; withdrawal: PlayerWithdrawalView };

const timeValue = (iso: string): number => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
};

/** Both lists as one, newest first — the order the bot's history uses too. */
export function mergeHistory(
  deposits: readonly DepositView[],
  withdrawals: readonly PlayerWithdrawalView[],
): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    ...deposits.map((deposit): HistoryEntry => ({
      kind: "deposit",
      key: `d:${deposit.shortId}`,
      at: deposit.createdAt,
      deposit,
    })),
    ...withdrawals.map((withdrawal): HistoryEntry => ({
      kind: "withdrawal",
      key: `w:${withdrawal.shortId}`,
      at: withdrawal.requestedAt,
      withdrawal,
    })),
  ];
  return entries.sort((a, b) => timeValue(b.at) - timeValue(a.at));
}
