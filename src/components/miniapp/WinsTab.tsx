/**
 * 🏆 شارك إصابتك — a photo or a short video of a win, from the phone, with a line of the player's
 * own (owner, 2026-09-27: «مشاركة الإصابة»).
 *
 * THE SAME PIPELINE AS THE BOT'S BUTTON: the file is sent to the server (`POST /v1/wins`), kept in
 * the operator's Telegram media store, reviewed by staff, and posted to the operator's channels
 * once published — «🏆 إصابة جديدة! 🔥 <first name>: <caption>». The player is told by the bot, in
 * private, and the list below follows it: it polls while a share is still waiting.
 *
 * WHAT IS CHECKED HERE, AND WHY ONLY THIS: the type and the size, the two things a player can fix
 * by picking another file, before a 50 MB upload is spent finding out. Everything else — the hourly
 * limit, the caption's length, an operator with no media store — is the server's, and its Arabic
 * answer is shown verbatim.
 */
import { Clapperboard, ImagePlus, Send, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useMyWins, useShareWin } from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type { WinShareStatus, WinShareView } from "@/lib/api/types";
import { dayMonthOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  EmptyState,
  ErrorLine,
  Num,
  RowsSkeleton,
  SectionTitle,
  StatusChip,
} from "./primitives";
import { enterDelay, type ChipStatus } from "./row-style";

/** The server's own limits (media.constants on the backend), checked first so nobody waits. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** The server keeps at most this much of the caption and refuses longer. */
const MAX_CAPTION = 300;

const CHIP: Record<WinShareStatus, ChipStatus> = {
  PENDING: "pending",
  PUBLISHED: "approved",
  REJECTED: "rejected",
};

const WORDS: Record<WinShareStatus, string> = {
  PENDING: "بانتظار النشر",
  PUBLISHED: "انتشرت 🎉",
  REJECTED: "لم تُنشر",
};

/** Why a picked file cannot be sent, or null when it can. */
function problemOf(file: File): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) return "نقبل الصور (JPG أو PNG أو WEBP) والفيديو (MP4 أو MOV) فقط.";
  if (isImage && file.size > MAX_IMAGE_BYTES) return "الصورة أكبر من 10 ميغابايت.";
  if (isVideo && file.size > MAX_VIDEO_BYTES) return "الفيديو أكبر من 50 ميغابايت.";
  return null;
}

export function WinsTab() {
  const wins = useMyWins(true);
  const share = useShareWin();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // A local preview of the picked file; revoked when it changes or the screen goes.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isVideo = file !== null && VIDEO_TYPES.includes(file.type);
  const busy = share.isPending;
  const disabled = file === null || busy || caption.length > MAX_CAPTION;

  const pick = (picked: File) => {
    setSent(false);
    share.reset();
    const issue = problemOf(picked);
    setProblem(issue);
    setFile(issue === null ? picked : null);
  };

  const submit = async () => {
    if (file === null || disabled) return;
    tap();
    try {
      await share.mutateAsync({ file, caption });
      setFile(null);
      setCaption("");
      setSent(true);
    } catch {
      // The mutation holds the failure; it is rendered under the form in the server's own Arabic.
    }
  };

  const rows = wins.data ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>شارك إصابتك 🏆</SectionTitle>
        <Card className="space-y-3">
          <p className="text-small text-ink-muted">
            ابعتلنا صورة أو فيديو لإصابتك 📸🎥 مع تعليق إذا حابب، ورح تنتشر بقنواتنا بعد المراجعة.
          </p>

          <label
            className={cn(
              "relative grid aspect-[5/3] w-full cursor-pointer place-items-center overflow-hidden rounded-xl",
              "bg-secondary outline-1 -outline-offset-1 outline-hairline",
              "transition active:scale-[0.99] active:outline-brand/40",
              busy && "app-busy",
            )}
          >
            <input
              type="file"
              accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                // Cleared, so picking the same file again still fires a change.
                event.target.value = "";
                if (picked !== undefined) pick(picked);
              }}
            />
            {preview === null ? (
              <span className="flex flex-col items-center gap-2 px-4 text-center">
                <ImagePlus className="size-6 text-ink-muted" />
                <span className="text-small font-medium text-ink-muted">اختر صورة أو فيديو</span>
              </span>
            ) : isVideo ? (
              <video
                src={preview}
                className="absolute inset-0 size-full object-cover"
                muted
                playsInline
                controls
              />
            ) : (
              <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
            )}
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-small font-semibold text-ink" htmlFor="win-caption">
                تعليقك (اختياري)
              </label>
              <span className="whitespace-nowrap text-micro text-ink-muted">
                <Num>{Math.max(0, MAX_CAPTION - caption.length)}</Num> حرف متبقٍ
              </span>
            </div>
            <textarea
              id="win-caption"
              value={caption}
              onChange={(event) => {
                setCaption(event.target.value);
                setSent(false);
              }}
              maxLength={MAX_CAPTION}
              rows={2}
              placeholder="مثلاً: ربحت على الروليت 🔥"
              className="app-field resize-none"
            />
          </div>

          <ActionButton icon={Send} disabled={disabled} busy={busy} onClick={() => void submit()}>
            {busy ? "جارٍ الإرسال…" : "شارك الإصابة"}
          </ActionButton>

          {problem !== null && <ErrorLine message={problem} />}
          {share.isError && <ErrorLine message={errorMessage(share.error)} />}
          {sent && (
            <p className="app-enter rounded-xl bg-ok-soft px-3 py-2.5 text-small text-ok">
              ✅ وصلتنا إصابتك! رح نراجعها وننشرها قريباً 🔥
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>مشاركاتك</SectionTitle>
        {wins.isPending ? (
          <RowsSkeleton count={2} />
        ) : wins.isError ? (
          <ErrorLine message={errorMessage(wins.error)} onRetry={() => void wins.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="ما شاركت أي إصابة بعد"
            hint="أول إصابة بتشاركها رح تظهر هون مع حالتها."
          />
        ) : (
          <div className="space-y-2.5">
            {rows.map((win, index) => (
              <WinRow key={win.id} win={win} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WinRow({ win, index }: { win: WinShareView; index: number }) {
  const { day, month } = dayMonthOf(win.createdAt);
  const picture = win.mediaKind === "VIDEO" ? win.thumbnailUrl : (win.mediaUrl ?? win.thumbnailUrl);
  const [broken, setBroken] = useState(false);

  return (
    <Card style={enterDelay(index)} className="app-enter flex items-center gap-3">
      <span className="app-tile relative size-14 shrink-0 overflow-hidden">
        {picture !== null && !broken ? (
          <img
            src={picture}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : win.mediaKind === "VIDEO" ? (
          <Clapperboard className="size-5" />
        ) : (
          <Trophy className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="truncate text-body font-semibold text-ink">
          {win.caption ?? (win.mediaKind === "VIDEO" ? "فيديو إصابة" : "صورة إصابة")}
        </div>
        <div className="truncate text-micro text-ink-muted">
          <Num>{day}</Num> {month} · {WORDS[win.status]}
        </div>
      </div>
      <StatusChip status={CHIP[win.status]} />
    </Card>
  );
}
