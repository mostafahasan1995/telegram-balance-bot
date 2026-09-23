/**
 * The one screen that is only words: a box that reaches the staff group, and two facts about what
 * happens next.
 *
 * THE TWO CARDS BELOW THE BOX DO NOT NAVIGATE and are not drawn as though they do — they carry no
 * chevron, because a control that looks tappable and answers nothing is the fastest way to make an
 * app feel broken. They are facts, in the same card shape as the rest of the app.
 */
import { Activity, CheckCircle2, LifeBuoy, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useSendSupportMessage } from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";

import { ActionButton, Card, ErrorLine, Note, Num, SectionTitle } from "./primitives";

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
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle
          action={
            <span className="whitespace-nowrap text-micro text-ink-muted">
              <Num>{MAX_MESSAGE - message.length}</Num> حرف متبقٍ
            </span>
          }
        >
          راسل الدعم
        </SectionTitle>
        <Card className="space-y-3">
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setSent(false);
            }}
            maxLength={MAX_MESSAGE}
            rows={5}
            aria-label="رسالتك إلى الدعم"
            placeholder="اكتب رسالتك: رقم العملية، المبلغ، وما الذي حصل."
            className="app-field resize-none"
          />
          <ActionButton
            icon={Send}
            disabled={disabled}
            busy={send.isPending}
            onClick={() => void submit()}
          >
            {send.isPending ? "جارٍ الإرسال…" : "إرسال إلى الدعم"}
          </ActionButton>
          {send.isError && <ErrorLine message={errorMessage(send.error)} />}
          {sent && (
            <p className="app-enter flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2.5 text-small text-ok">
              <CheckCircle2 className="size-4 shrink-0" />
              وصلت رسالتك إلى فريق الدعم، سيتم الرد قريباً.
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>قنوات الدعم</SectionTitle>
        <div className="space-y-2.5">
          <Card className="flex items-center gap-3">
            <span className="app-tile app-tile-brand size-11">
              <MessageCircle className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="truncate text-body font-semibold text-ink">محادثة مع الدعم</div>
              <div className="truncate text-micro text-ink-muted">
                متوسط الرد <Num>5</Num> دقائق · طوال أيام الأسبوع
              </div>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <span className="app-tile size-11">
              <LifeBuoy className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="truncate text-body font-semibold text-ink">الأسئلة الشائعة</div>
              <div className="truncate text-micro text-ink-muted">
                الإيداع، السحب، ربط الحساب
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Note icon={Activity}>
        إذا تأخر ظهور رصيدك أكثر من <Num>30</Num> دقيقة بعد إرسال رقم المرجع، أرسل رقم العملية إلى
        الدعم مع صورة الإيصال.
      </Note>
    </div>
  );
}
