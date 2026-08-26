import { ArrowLeft, ArrowUpRight, Landmark, ShieldCheck, Wallet } from "lucide-react";

import { Card, SectionTitle, StatusChip } from "./primitives";
import {
  CURRENCY,
  balance,
  deposits,
  formatCompact,
  formatMoney,
  paymentMethods,
} from "@/lib/miniapp-data";

export function HomeTab({ onDeposit }: { onDeposit: () => void }) {
  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-ink-muted">
            الرصيد الحالي على المنصة
          </span>
          <div className="flex items-baseline gap-2" dir="ltr">
            <h1 className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
              {formatMoney(balance.amount)}
            </h1>
            <span className="text-lg font-medium text-brand">{CURRENCY}</span>
          </div>
          <p className="text-[11px] text-ink-muted">
            آخر مزامنة {balance.updatedAt} · بانتظار الموافقة{" "}
            <span className="tabular-nums">{formatCompact(balance.pendingAmount)}</span>{" "}
            {CURRENCY}
          </p>
        </div>

        <button
          type="button"
          onClick={onDeposit}
          className="w-full rounded-2xl bg-brand py-4 text-base font-medium text-brand-foreground shadow-teller ring-1 ring-brand transition-transform active:scale-[0.98]"
        >
          شحن الرصيد
        </button>
      </section>

      <section className="space-y-3">
        <SectionTitle>طرق الدفع المتاحة</SectionTitle>
        <div className="grid gap-3">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={onDeposit}
              className="group flex items-center justify-between rounded-2xl bg-card p-4 text-start shadow-teller ring-1 ring-hairline transition-colors hover:ring-brand/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-secondary text-ink-muted">
                  {method.id === "bank" ? (
                    <Landmark className="size-5" />
                  ) : (
                    <Wallet className="size-5" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="font-medium">{method.name}</div>
                  <div className="text-[11px] tabular-nums text-ink-muted" dir="rtl">
                    الحدود: {formatCompact(method.min)} - {formatCompact(method.max)}{" "}
                    {CURRENCY}
                  </div>
                  <div className="text-[11px] text-ink-muted">{method.hint}</div>
                </div>
              </div>
              <ArrowLeft className="size-4 text-ink-muted transition-colors group-hover:text-brand" />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          action={
            <span className="flex items-center gap-1 text-xs font-medium text-brand">
              عرض الكل <ArrowUpRight className="size-3.5" />
            </span>
          }
        >
          آخر العمليات
        </SectionTitle>
        <div className="space-y-2">
          {deposits.slice(0, 2).map((deposit) => (
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
                    {deposit.method} · {deposit.ref}
                  </div>
                </div>
              </div>
              <StatusChip status={deposit.status} />
            </Card>
          ))}
        </div>
      </section>

      <Card className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
        <p className="text-[12px] leading-relaxed text-ink-muted">
          الرصيد يُقرأ مباشرة من حسابك على المنصة الخارجية. لا تشارك رقم المرجع أو صورة
          الإيصال مع أي شخص غير الدعم الرسمي.
        </p>
      </Card>
    </div>
  );
}
