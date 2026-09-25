/**
 * The one screen that is only words: a box that reaches the operator's support group (the staff
 * group when there is none), and two facts about what happens next. The answer comes back from the
 * bot, in the player's private chat with it, under «الدعم الفني».
 *
 * THE TWO CARDS BELOW THE BOX DO NOT NAVIGATE and are not drawn as though they do — they carry no
 * chevron, because a control that looks tappable and answers nothing is the fastest way to make an
 * app feel broken. They are facts, in the same card shape as the rest of the app.
 */
import { Activity, LifeBuoy, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useSendSupportMessage } from "@/lib/api/hooks";
import { requestWriteAccess, tap } from "@/lib/api/telegram";

import { ActionButton, Card, ErrorLine, Note, Num, SectionTitle } from "./primitives";

/** The backend refuses anything longer, so the box stops the player before the round trip does. */
const MAX_MESSAGE = 3000;

export function SupportTab() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  /** The player said no to the bot messaging them, so the answer may have nowhere to land. */
  const [noWriteAccess, setNoWriteAccess] = useState(false);
  /** Telegram's permission popup is open; the box must not send a second time behind it. */
  const [asking, setAsking] = useState(false);
  const send = useSendSupportMessage();

  const text = message.trim();
  const busy = asking || send.isPending;
  const disabled = text.length === 0 || busy;

  const submit = async () => {
    if (disabled) return;
    tap();
    // The answer comes back from the bot, in the player's private chat with it — which a bot
    // cannot open by itself. So ask first. The message goes either way: a refusal only means the
    // player is told how to let the answer reach them.
    setAsking(true);
    const granted = await requestWriteAccess();
    setAsking(false);
    try {
      await send.mutateAsync(text);
      setMessage("");
      setSent(true);
      setNoWriteAccess(granted === false);
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
          <ActionButton icon={Send} disabled={disabled} busy={busy} onClick={() => void submit()}>
            {busy ? "جارٍ الإرسال…" : "إرسال إلى الدعم"}
          </ActionButton>
          {send.isError && <ErrorLine message={errorMessage(send.error)} />}
          {sent && (
            <p className="app-enter rounded-xl bg-ok-soft px-3 py-2.5 text-small text-ok">
              ✅ وصلت رسالتك! رح يوصلك رد الدعم الفني هون بمحادثة البوت 💬
            </p>
          )}
          {sent && noWriteAccess && (
            <p className="app-enter rounded-xl bg-warn-soft px-3 py-2.5 text-small text-warn">
              ⚠️ حتى يوصلك الرد، اسمح للبوت يراسلك من محادثة البوت.
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
              <div className="truncate text-micro text-ink-muted">الإيداع، السحب، ربط الحساب</div>
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
