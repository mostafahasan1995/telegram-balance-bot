export type DepositStatus = "pending" | "approved" | "rejected";

export type PaymentMethod = {
  id: string;
  name: string;
  hint: string;
  min: number;
  max: number;
};

export type Deposit = {
  id: string;
  ref: string;
  amount: number;
  method: string;
  day: string;
  month: string;
  time: string;
  status: DepositStatus;
};

export const CURRENCY = "NSP";

export const balance = {
  amount: 105000,
  updatedAt: "14:48",
  pendingAmount: 50000,
};

export const paymentMethods: PaymentMethod[] = [
  {
    id: "bank",
    name: "تحويل بنكي",
    hint: "يُراجع خلال 15 دقيقة",
    min: 5000,
    max: 5000000,
  },
  {
    id: "wallet",
    name: "المحافظ الإلكترونية",
    hint: "يُراجع خلال 5 دقائق",
    min: 5000,
    max: 5000000,
  },
];

export const deposits: Deposit[] = [
  {
    id: "1",
    ref: "REF-884120",
    amount: 50000,
    method: "تحويل بنكي",
    day: "26",
    month: "آب",
    time: "14:31",
    status: "pending",
  },
  {
    id: "2",
    ref: "REF-881904",
    amount: 15000,
    method: "محفظة إلكترونية",
    day: "24",
    month: "آب",
    time: "09:15",
    status: "approved",
  },
  {
    id: "3",
    ref: "REF-879335",
    amount: 120000,
    method: "تحويل بنكي",
    day: "21",
    month: "آب",
    time: "20:02",
    status: "approved",
  },
  {
    id: "4",
    ref: "REF-874001",
    amount: 8000,
    method: "محفظة إلكترونية",
    day: "18",
    month: "آب",
    time: "11:44",
    status: "rejected",
  },
];

export const profile = {
  name: "M H",
  username: "@Steve1995H",
  telegramId: "912911246",
  currency: CURRENCY,
  accountState: "نشط",
  linked: true,
  site: "ichancy.com",
  siteUser: "p912911246_7fszgwgh",
  sitePassword: "n3V4zyBww3bfAa1!",
  referralCode: "ref_912911246",
  inviteLink: "https://t.me/Ichancy_global_syria_bot?start=ref_912911246",
};

export const health = {
  version: "v2.4.0",
  services: [
    { id: "bot", name: "بوت تلغرام", state: "ok" as const, latency: "82ms" },
    { id: "platform", name: "منصة الألعاب", state: "ok" as const, latency: "310ms" },
    { id: "payments", name: "بوابة الدفع", state: "degraded" as const, latency: "1.4s" },
    { id: "sync", name: "مزامنة الرصيد", state: "ok" as const, latency: "126ms" },
  ],
};

export const statusLabel: Record<DepositStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCompact(value: number) {
  return value.toLocaleString("en-US");
}
