/**
 * The wheel of fortune: one spin per campaign, drawn by the server.
 *
 * NOTHING ON THIS SCREEN DECIDES ANYTHING. The app posts an empty spin and the answer names the
 * segment to stop on (`landOn`), so every rotation below is theatre played over a result that
 * already exists. That is also why a replayed spin — or a prize the operator has since taken off
 * the wheel — is shown standing still: re-running the animation would act out a draw that did not
 * happen now, and the player would watch their own prize "being decided" a second time.
 *
 * AND THE PRIZE IS NOT THE END OF IT. The credit is queued to a worker that talks to the casino, so
 * the card under the wheel reports where the money actually is and the query keeps polling until it
 * stops moving. A player who closes the app mid-credit finds that card already finished on return.
 */
import { Gift } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { figureBackground, type BrandView } from "@/components/miniapp/brand";
import { errorMessage } from "@/lib/api/client";
import { useSpinWheel, useWheel } from "@/lib/api/hooks";
import { tap } from "@/lib/api/telegram";
import type {
  WheelIneligibilityReason,
  WheelSegmentView,
  WheelSpinStatus,
  WheelSpinView,
} from "@/lib/api/types";
import { formatAmount, formatWhole, timeOf } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  ActionButton,
  Card,
  ErrorLine,
  Hero,
  Money,
  Note,
  Num,
  Refreshing,
  SectionTitle,
  Skeleton,
} from "./primitives";

/** The wheel is drawn in a 200×200 box, so every length below is in those units. */
const CENTRE = 100;
const RADIUS = 94;
/** Where a caption sits along its slice: far enough out to have room, inside the rim. */
const LABEL_RADIUS = 60;

/** Full turns before the wheel settles — enough to read as a spin, short enough to sit through. */
const TURNS = 6;
const SPIN_MS = 4200;

/** A stable empty list, so a wheel that has no segments yet does not re-render on identity. */
const NO_SEGMENTS: readonly WheelSegmentView[] = [];

export function WheelTab({ brand }: { brand: BrandView }) {
  const wheel = useWheel(true);
  const spin = useSpinWheel();

  /** Set only by a spin made on this screen; null means "wherever the server's answer puts it". */
  const [spun, setSpun] = useState<{ rotation: number; animate: boolean } | null>(null);
  /** True while the wheel is still turning: the prize must not be readable before it stops. */
  const [turning, setTurning] = useState(false);
  const stopTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    };
  }, []);

  const view = wheel.data;
  // Once a spin has happened, the wheel that was SPUN is the one to draw: `landOn` indexes the list
  // the POST answered with, and a refetch could arrive with an edited one mid-animation.
  const segments = spin.data?.segments ?? view?.segments ?? NO_SEGMENTS;
  const step = segments.length === 0 ? 0 : 360 / segments.length;
  const prize = view?.spin ?? spin.data?.spin ?? null;

  const rotation = spun?.rotation ?? restingRotation(segments, prize, step);
  const animate = spun?.animate ?? false;

  async function pull(): Promise<void> {
    tap();
    try {
      const result = await spin.mutateAsync();
      const landOn = result.landOn;
      const width = result.segments.length === 0 ? 0 : 360 / result.segments.length;

      // Nothing to point at: the drawn prize is off the wheel. Leave it where it stands.
      if (landOn === null) {
        setSpun({ rotation, animate: false });
        return;
      }
      // A spin the player has already seen, or a player who asked not to be moved: same answer,
      // put the pointer on it at once.
      if (result.replayed || prefersReducedMotion()) {
        setSpun({ rotation: -landOn * width, animate: false });
        return;
      }
      setSpun({ rotation: TURNS * 360 - landOn * width, animate: true });
      setTurning(true);
      stopTimer.current = window.setTimeout(() => setTurning(false), SPIN_MS);
    } catch {
      // The mutation holds the failure; it is rendered below in the server's own Arabic.
    }
  }

  // A disc, a line and a button — the shape the card is about to have, so the wheel does not drop
  // into place under the player's thumb.
  if (wheel.isPending) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <SectionTitle>عجلة الحظ</SectionTitle>
          <Hero className="space-y-4">
            <Skeleton className="mx-auto aspect-square w-full max-w-[300px] rounded-full" />
            <Skeleton className="mx-auto h-4 w-48 rounded-md" />
            <Skeleton className="h-12 rounded-lg" />
          </Hero>
        </section>
      </div>
    );
  }
  if (wheel.isError || view === undefined) {
    return <ErrorLine message={errorMessage(wheel.error)} onRetry={() => void wheel.refetch()} />;
  }

  const minimum = (
    <Num>
      {formatWhole(view.minDeposit)} {view.currencyCode}
    </Num>
  );
  const busy = spin.isPending || turning;
  const blocked = !view.canSpin || spin.isSuccess;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {/* The prize keeps being re-read until the casino confirms the credit; this is the only
            sign on screen that the card below is still moving. */}
        <SectionTitle action={<Refreshing show={wheel.isFetching && !wheel.isPending} />}>
          عجلة الحظ
        </SectionTitle>
        {/*
         * The one card in the app that carries a picture of its own — the operator's wheel
         * background, behind the same scrim the page uses, painted inside the card's rounded box
         * so nothing about the layout knows it is there. The class only goes on when there IS a
         * picture: its layer is a scrim, and a scrim over nothing is just a card washed out.
         */}
        <Hero
          className={cn("space-y-4", brand.wheelBackgroundUrl !== null && "app-figure-bg")}
          style={figureBackground(brand.wheelBackgroundUrl)}
        >
          <Wheel segments={segments} rotation={rotation} animate={animate} />

          <p className="text-center text-small text-ink-muted">
            كل إيداع مؤكد بقيمة {minimum} يمنحك دورة
          </p>

          <ActionButton
            disabled={blocked || busy || segments.length === 0}
            busy={busy}
            onClick={() => void pull()}
          >
            {busy ? "جارٍ الدوران…" : "أدر العجلة"}
          </ActionButton>

          {!view.canSpin && view.reason !== null && (
            <p className="app-inset px-3 py-2.5 text-center text-small text-ink-muted">
              {whyNot(view.reason, minimum)}
            </p>
          )}

          {spin.isError && <ErrorLine message={errorMessage(spin.error)} />}
        </Hero>
      </section>

      {prize !== null && !turning && <Result spin={prize} />}

      <Note icon={Gift}>
        دورة واحدة لكل حملة، والنتيجة تُحسم على الخادم قبل أن تدور العجلة. تُضاف الجائزة إلى رصيدك
        على المنصة تلقائياً، ولا حاجة لمراسلة الدعم قبل أن تستقر حالة الجائزة.
      </Note>
    </div>
  );
}

/** What the player drew, and what is happening to it. */
function Result({ spin }: { spin: WheelSpinView }) {
  const note = creditNote(spin.status);

  return (
    <section className="space-y-3">
      <SectionTitle>نتيجتك</SectionTitle>
      {/* The one overshoot in the app. Everywhere else this would be wrong — here the card is the
          payoff of a wheel that has just stopped, and arriving flatly would undercut it. */}
      <Card className="app-prize space-y-3 text-center">
        <div className="space-y-1">
          <p className="break-words text-small font-semibold text-ink">{spin.prizeLabel}</p>
          {spin.amountMinor !== "0" && (
            <Money
              amount={formatAmount(spin.amount)}
              currency={spin.currencyCode}
              className="justify-center text-figure font-semibold text-ink"
              unitClassName="text-small"
            />
          )}
        </div>

        {/* Keyed on the wording: the status settles while the player watches, and the new note
            should fade in rather than replace the old one between two frames. */}
        <p key={note.text} className={cn("app-value rounded-md px-3 py-2 text-small", note.tone)}>
          {note.text}
        </p>

        <p className="text-micro text-ink-muted">
          <span className="app-code">{spin.shortId}</span>
          {" · "}
          <Num>{timeOf(spin.createdAt)}</Num>
        </p>
      </Card>
    </section>
  );
}

/**
 * The wheel itself: one SVG slice per segment, turned as a whole by a CSS transform.
 *
 * WHY THE POINTER IS A SECOND SVG AND NOT PART OF THIS ONE: it is the one thing that must NOT
 * rotate. It sits over the wheel, outside the element the transform is on.
 */
function Wheel({
  segments,
  rotation,
  animate,
}: {
  segments: readonly WheelSegmentView[];
  rotation: number;
  animate: boolean;
}) {
  const count = segments.length;
  // Crowded wheels need smaller type; the box does not grow on a phone.
  const labelSize = count > 9 ? 6.5 : count > 6 ? 8 : 9.5;

  // INLINE AND NOT A UTILITY CLASS: the angle is a number the server chose, so there is no class to
  // name it. The easing is an expo-out — away hard, then a long crawl into the stop, which is how a
  // real wheel gives up — and a duration of zero is how "show the result without the spin" is said.
  const turn: CSSProperties = {
    transform: `rotate(${round(rotation)}deg)`,
    transitionProperty: "transform",
    transitionDuration: animate ? `${SPIN_MS}ms` : "0ms",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label="عجلة الحظ"
        className="size-full"
        style={turn}
      >
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} className="fill-secondary" />

        {count === 1 ? (
          // A single segment has no arc to draw between two edges — it is the whole disc.
          <circle cx={CENTRE} cy={CENTRE} r={RADIUS} className="fill-brand" />
        ) : (
          segments.map((segment, index) => (
            <path
              key={`slice-${index}-${segment.label}`}
              d={slicePath(index, count)}
              strokeWidth={1}
              className={cn("stroke-card", index % 2 === 0 ? "fill-brand" : "fill-brand-soft")}
            />
          ))
        )}

        {segments.map((segment, index) => (
          <SegmentLabel
            key={`label-${index}-${segment.label}`}
            segment={segment}
            index={index}
            count={count}
            size={labelSize}
          />
        ))}

        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          fill="none"
          strokeWidth={3}
          className="stroke-hairline"
        />
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={13}
          strokeWidth={2}
          className="fill-card stroke-hairline"
        />
      </svg>

      {/* Centred with `inset-x-0` and a margin rather than a translate: this bar is inside an RTL
          document, and a logical inset would put the tip on the wrong side of the wheel. */}
      <svg
        viewBox="0 0 20 16"
        aria-hidden="true"
        className="absolute inset-x-0 -top-1 mx-auto h-4 w-5 drop-shadow"
      >
        <path d="M 10 16 L 0 0 L 20 0 Z" className="fill-brand" />
      </svg>
    </div>
  );
}

/** One slice's caption, running along its radius and never upside down. */
function SegmentLabel({
  segment,
  index,
  count,
  size,
}: {
  segment: WheelSegmentView;
  index: number;
  count: number;
  size: number;
}) {
  const angle = -90 + index * (360 / count);
  const [x, y] = pointOn(angle, LABEL_RADIUS);
  // Past the vertical a radial caption reads back to front; turning the whole thing keeps it up.
  const upright = Math.cos(toRadians(angle)) < 0 ? angle + 180 : angle;
  // A segment worth nothing says so in its label, so repeating a bare "0" under it adds noise.
  const amount = segment.amountMinor === "0" ? null : formatWhole(segment.amount);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      transform={`rotate(${round(upright)} ${x} ${y})`}
      fontSize={size}
      className={cn(
        "font-semibold",
        // The odd slices are the soft tint, which is nearly the card colour — a caption in the
        // raw brand on top of it can be a pale colour on a pale colour. `brand-ink` is the one
        // the branding module keeps readable.
        index % 2 === 0 ? "fill-brand-foreground" : "fill-brand-ink",
      )}
    >
      <tspan x={x} dy={amount === null ? size * 0.35 : -size * 0.15}>
        {segment.label}
      </tspan>
      {amount !== null && (
        <tspan x={x} dy={size * 1.15} className="tabular-nums">
          {amount}
        </tspan>
      )}
    </text>
  );
}

/**
 * Where the wheel rests when the player already has a spin — after a reload, say.
 *
 * MATCHED ON THE LABEL AND THE AMOUNT, because GET /v1/wheel names the prize without saying which
 * segment it was: `WheelSegmentView` carries no id and `WheelSpinView` no index, so those two
 * fields are the only ones both shapes share. No match (the operator edited the wheel since) leaves
 * the wheel at rest rather than pointing at the wrong prize.
 */
function restingRotation(
  segments: readonly WheelSegmentView[],
  spin: WheelSpinView | null,
  step: number,
): number {
  if (spin === null) return 0;
  const index = segments.findIndex(
    (segment) => segment.label === spin.prizeLabel && segment.amountMinor === spin.amountMinor,
  );
  return index === -1 ? 0 : -index * step;
}

/** The slice for `index`, with segment 0 centred under the pointer while the wheel is at rest. */
function slicePath(index: number, count: number): string {
  const step = 360 / count;
  const from = -90 - step / 2 + index * step;
  const to = from + step;
  const [x1, y1] = pointOn(from, RADIUS);
  const [x2, y2] = pointOn(to, RADIUS);
  const largeArc = step > 180 ? 1 : 0;
  return `M ${CENTRE} ${CENTRE} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function pointOn(degrees: number, radius: number): [number, number] {
  const radians = toRadians(degrees);
  return [round(CENTRE + radius * Math.cos(radians)), round(CENTRE + radius * Math.sin(radians))];
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Two decimals: enough for a 200-unit box, and it keeps the path text readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Asked at the moment of the spin rather than at render: this is a setting a player can change
 * while the app is open, and `window` does not exist while the page is rendered on the server.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Why the button is dead, in the player's own language.
 *
 * IT RETURNS NODES, NOT A TEMPLATE STRING. The minimum is a Latin run, and interpolated into an
 * Arabic sentence with nothing isolating it bidi is free to move it to the other end of the line —
 * "تحتاج إيداعاً مؤكداً بقيمة 25,000 NSP" is exactly the shape that bug takes.
 */
function whyNot(reason: WheelIneligibilityReason, minimum: ReactNode): ReactNode {
  switch (reason) {
    case "DISABLED":
      return "العجلة غير متاحة حالياً";
    case "NO_QUALIFYING_DEPOSIT":
      return <>تحتاج إيداعاً مؤكداً بقيمة {minimum} على الأقل</>;
    case "ALREADY_SPUN":
      return "لقد استخدمت دورتك في هذه الحملة";
    case "PLAYER_NOT_ACTIVE":
      return "لا يمكن لحسابك اللعب حالياً، تواصل مع الدعم";
    case "NOT_LINKED":
      return "حسابك في Ichancy قيد التجهيز، حاول بعد قليل";
  }
}

/**
 * What is happening to the prize, and the colour that says it.
 *
 * A LOST SPIN IS NOT A FAILURE and an unresolved one is not a refusal: `NO_PRIZE` is simply a
 * segment worth nothing, and `NEEDS_RECONCILIATION` means nobody could prove whether the prize
 * landed. Both get their own wording rather than being folded into "on its way" — a player told to
 * wait for a credit that is never coming writes to support, and rightly.
 */
function creditNote(status: WheelSpinStatus): { text: string; tone: string } {
  switch (status) {
    case "NO_PRIZE":
      return {
        text: "لا جائزة هذه المرة، حظاً أوفر في الحملة القادمة",
        tone: "bg-secondary text-ink-muted",
      };
    case "AWARDED":
    case "CREDITING":
      return { text: "جارٍ إضافة الجائزة إلى رصيدك…", tone: "bg-warn-soft text-warn" };
    case "CREDITED":
      return { text: "أُضيفت الجائزة إلى رصيدك", tone: "bg-ok-soft text-ok" };
    case "CREDIT_FAILED":
    case "NEEDS_RECONCILIATION":
      return {
        text: "تعذّرت إضافة الجائزة تلقائياً، فريق الدعم يتابعها",
        tone: "bg-bad-soft text-bad",
      };
  }
}
