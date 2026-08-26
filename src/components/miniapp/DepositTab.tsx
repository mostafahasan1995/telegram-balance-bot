import { ImagePlus, Landmark, Wallet } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Card, SectionTitle, StatusChip } from "./primitives";
import {
  CURRENCY,
  deposits,
  formatCompact,
  formatMoney,
  paymentMethods,
} from "@/lib/miniapp-data";

const quickAmounts = [10000, 25000, 50000, 100000];

export function DepositTab() {
  const [methodId, setMethodId] = useState(paymentMethods[0].id);
  const [amount, setAmount] = useState("50000");
  const method = paymentMethods.find((m) => m.id === methodId)!;
  const numeric = Number(amount.replace(/[^\d]/g, "")) || 0;
  const outOfRange = numeric > 0 && (numeric < method.min || numeric > method.max);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionTitle>1 · اختر طريقة الدفع</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((m) => {
            const active = m.id === methodId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethodId(m.id)}
                className={cn(
                  "rounded-2xl p-4 text-start shadow-teller ring-1 transition-colors",
                  active
                    ? "bg-brand-soft ring-brand/50"
                    : "bg-card ring-hairline hover:ring-brand/30",
                )}
              >
                <div
                  className={cn(
                    "mb-3 grid size-9 place-items-center rounded-xl",
                    active ? "bg-brand text-brand-foreground" : "bg-secondary text-ink-muted",
                  )}
                >
                  {m.id === "bank" ? (
                    <Landmark className="size-4" />
                  ) : (
                    <Wallet className="size-4" />
                  )}
                </div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-[10px] tabular-nums text-ink-muted">
                  {formatCompact(m.min)} - {formatCompact(m.max)}
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
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              className="w-full bg-transparent text-3xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-ink-muted/40"
              placeholder="0"
            />
            <span className="text-base font-medium text-brand">{CURRENCY}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium tabular-nums ring-1 ring-hairline transition-colors hover:ring-brand/40"
              >
                +{formatCompact(value)}
              </button>
            ))}
          </div>
          <p
            className={cn(
              "text-[11px] tabular-nums",
              outOfRange ? "text-bad" : "text-ink-muted",
            )}
          >
            الحد المسموح لهذه الطريقة: {formatCompact(method.min)} -{" "}
            {formatCompact(method.max)} {CURRENCY}
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>3 · إثبات الدفع</SectionTitle>
        <Card className="space-y-4 p-5">
          <div className="space-y-1">
            <h3 className="text-base font-medium">إكمال عملية الإيداع</h3>
            <p className="text-sm text-ink-muted">
              أدخل رقم المرجع وقم بإرفاق صورة الإيصال لتأكيد العملية.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="px-1 text-xs font-medium" htmlFor="ref">
              رقم المرجع (Reference)
            </label>
            <input
              id="ref"
              dir="ltr"
              placeholder="REF-000000"
              className="w-full rounded-xl border border-hairline bg-secondary px-3 py-2.5 font-mono text-sm outline-none transition-shadow focus:ring-2 focus:ring-brand/25"
            />
          </div>

          <div className="space-y-1.5">
            <span className="px-1 text-xs font-medium">إيصال الدفع</span>
            <label className="grid aspect-[4/3] w-full cursor-pointer place-items-center rounded-2xl bg-secondary outline-1 -outline-offset-1 outline-hairline transition-colors hover:bg-accent">
              <input type="file" accept="image/*" className="hidden" />
              <div className="flex flex-col items-center gap-2">
                <ImagePlus className="size-6 text-ink-muted" />
                <span className="text-[10px] font-medium tracking-[0.15em] text-ink-muted">
                  ارفاق صورة الإيصال
                </span>
              </div>
            </label>
          </div>

          <button
            type="button"
            className="w-full rounded-2xl bg-brand py-3.5 text-sm font-medium text-brand-foreground ring-1 ring-brand transition-transform active:scale-[0.98]"
          >
            إرسال طلب الإيداع
          </button>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>سجل الإيداعات</SectionTitle>
        <div className="space-y-2">
          {deposits.map((deposit) => (
            <Card key={deposit.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary">
                  <span className="text-[11px] font-bold tabular-nums">{deposit.day}</span>
                  <span className="text-[9px] text-ink-muted">{deposit.month}</span>
                </div>
                <div>
                  <div className="text-sm font-medium tabular-nums" dir="ltr">
                    {formatMoney(deposit.amount)} {CURRENCY}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {deposit.method} · {deposit.time} · {deposit.ref}
                  </div>
                </div>
              </div>
              <StatusChip status={deposit.status} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
