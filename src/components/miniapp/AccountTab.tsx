import { BadgeCheck, ExternalLink, KeyRound } from "lucide-react";

import { Card, CopyField, SectionTitle } from "./primitives";
import { CURRENCY, profile } from "@/lib/miniapp-data";

export function AccountTab() {
  return (
    <div className="space-y-7">
      <section className="space-y-4 rounded-3xl bg-panel p-5 text-panel-foreground shadow-teller">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-full bg-white/10 text-lg font-medium outline-1 -outline-offset-1 outline-white/10">
            MH
          </div>
          <div className="space-y-0.5">
            <div className="font-medium">{profile.username}</div>
            <div className="text-xs tabular-nums text-panel-foreground/60" dir="ltr">
              ID: {profile.telegramId}
            </div>
          </div>
          <div className="ms-auto flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium">
            <BadgeCheck className="size-3.5 text-brand" />
            {profile.accountState}
          </div>
        </div>

        <div className="grid gap-2">
          <CopyField label="كود الإحالة" value={profile.referralCode} onPanel />
          <CopyField label="رابط الدعوة" value={profile.inviteLink} onPanel />
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="space-y-0.5">
            <span className="text-[10px] text-panel-foreground/50">حالة اللعب</span>
            <div className="text-xs font-medium text-brand">
              {profile.linked ? "حساب مرتبط" : "غير مرتبط"}
            </div>
          </div>
          <div className="text-start text-[10px] tabular-nums text-panel-foreground/50">
            {CURRENCY} CURRENCY
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>بيانات الدخول للمنصة</SectionTitle>
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-brand" />
            {profile.site}
            <ExternalLink className="size-3.5 text-ink-muted" />
          </div>
          <CopyField label="اسم المستخدم" value={profile.siteUser} />
          <CopyField label="كلمة السر" value={profile.sitePassword} masked />
          <p className="text-[11px] leading-relaxed text-ink-muted">
            احفظ هذه البيانات ولا تشاركها مع أي شخص. يُنصح بتغيير كلمة السر من الموقع بعد
            أول تسجيل دخول — الشحن والسحب يبقى يعمل بشكل طبيعي.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>الشروط والأحكام</SectionTitle>
        <Card className="divide-y divide-hairline">
          {["شروط الاستخدام", "سياسة الإيداع والسحب", "سياسة الخصوصية"].map((item) => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center justify-between px-5 py-3.5 text-sm"
            >
              {item}
              <span className="text-ink-muted">←</span>
            </button>
          ))}
        </Card>
      </section>
    </div>
  );
}
