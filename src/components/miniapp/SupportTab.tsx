import { Activity, LifeBuoy, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useSendSupportMessage } from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import { cn } from "@/lib/utils";

import { Card, ErrorLine, SectionTitle } from "./primitives";

/** The backend refuses anything longer, so the box stops the player before the round trip does. */
const MAX_MESSAGE = 3000;

export function SupportTab() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const send = useSendSupportMessage();

  const text = message.trim();
  const disabled = text.length === 0 || send.isPending;

  const submit = async () => {
    if (disabled) return;
    tap();
    try {
      await send.mutateAsync(text);
      setMessage("");
      setSent(true);
    } catch {
      // The mutation holds the failure; it is rendered under the box in the server's own Arabic.
    }
  };

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionTitle
          action={
            <span className="text-[11px] tabular-nums text-ink-muted">
              {MAX_MESSAGE - message.length} حرف متبقٍ
            </span>
          }
        >
          راسل الدعم
        </SectionTitle>
        <Card className="space-y-3 p-5">
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setSent(false);
            }}
            maxLength={MAX_MESSAGE}
            rows={5}
            placeholder="اكتب رسالتك: رقم العملية، المبلغ، وما الذي حصل."
            className="w-full resize-none rounded-xl border border-hairline bg-secondary px-3 py-2.5 text-sm leading-relaxed outline-none transition-shadow focus:ring-2 focus:ring-brand/25"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium ring-1 transition-transform active:scale-[0.98]",
              disabled
                ? "bg-secondary text-ink-muted ring-hairline"
                : "bg-brand text-brand-foreground ring-brand",
            )}
          >
            <Send className="size-4" />
            {send.isPending ? "جارٍ الإرسال…" : "إرسال إلى الدعم"}
          </button>
          {send.isError && <ErrorLine message={errorMessage(send.error)} />}
          {sent && (
            <div className="rounded-2xl bg-ok-soft px-4 py-3 text-center">
              <p className="text-[12px] leading-relaxed text-ok">
                ✅ وصلت رسالتك إلى فريق الدعم، سيتم الرد قريباً.
              </p>
            </div>
          )}
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
