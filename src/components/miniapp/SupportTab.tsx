import { Activity, LifeBuoy, MessageCircle, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, SectionTitle } from "./primitives";
import { health } from "@/lib/miniapp-data";

export function SupportTab() {
  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionTitle
          action={
            <span className="text-[11px] tabular-nums text-ink-muted">{health.version}</span>
          }
        >
          فحص حالة الخدمة
        </SectionTitle>
        <Card className="divide-y divide-hairline">
          {health.services.map((service) => {
            const ok = service.state === "ok";
            return (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      ok ? "bg-ok" : "bg-warn",
                    )}
                  />
                  <div>
                    <div className="text-sm font-medium">{service.name}</div>
                    <div className="text-[11px] text-ink-muted">
                      {ok ? "يعمل بشكل طبيعي" : "بطء في الاستجابة"}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                    ok ? "text-ink-muted" : "text-warn",
                  )}
                >
                  <Timer className="size-3.5" />
                  {service.latency}
                </span>
              </div>
            );
          })}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>الدعم</SectionTitle>
        <div className="grid gap-3">
          <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">محادثة مع الدعم</div>
                <div className="text-[11px] text-ink-muted">
                  متوسط الرد: 5 دقائق · 24/7
                </div>
              </div>
            </div>
            <span className="text-ink-muted">←</span>
          </Card>
          <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-secondary text-ink-muted">
                <LifeBuoy className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">الأسئلة الشائعة</div>
                <div className="text-[11px] text-ink-muted">
                  الإيداع، السحب، ربط الحساب
                </div>
              </div>
            </div>
            <span className="text-ink-muted">←</span>
          </Card>
        </div>
      </section>

      <Card className="flex items-start gap-3 p-4">
        <Activity className="mt-0.5 size-5 shrink-0 text-brand" />
        <p className="text-[12px] leading-relaxed text-ink-muted">
          إذا تأخر ظهور رصيدك أكثر من 30 دقيقة بعد إرسال رقم المرجع، أرسل رقم العملية إلى
          الدعم مع صورة الإيصال.
        </p>
      </Card>
    </div>
  );
}
