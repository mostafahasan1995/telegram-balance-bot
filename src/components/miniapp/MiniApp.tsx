/**
 * The whole app: the sign-in gate, the six tabs, the bar that switches them, and the extras'
 * screens (📜 and the owner's other 2026-09-27 features) that open from the home screen's grid.
 *
 * IT LIVES IN A COMPONENT AND NOT IN A ROUTE because it is reachable at two paths — / and
 * /<tenant>, which is how an operator's mini app is addressed (app.<domain>/<tenant>). Both
 * routes render this, so there is one shell and no chance of the two drifting.
 *
 * THE OPERATOR'S SKIN IS APPLIED HERE, ONCE. `brand.style` is four CSS custom properties on the
 * root element below; every `bg-brand`, `text-brand-ink` and `ring-brand` in the other five files
 * resolves through them, so an operator changes colour without a single component being told.
 * Nothing waits for it: the header has a name before the request comes back, and the backdrop is a
 * fixed layer at `z-index: -1` that cannot move a pixel of layout whenever the picture arrives.
 *
 * THE ROOT PAINTS NO BACKGROUND OF ITS OWN, deliberately. The body's is the page colour, and the
 * backdrop sits between the two; a `bg-background` here would be painted on top of the operator's
 * picture and hide it.
 */
import {
  ArrowDownToLine,
  ArrowRight,
  FerrisWheel,
  Home,
  LifeBuoy,
  ReceiptText,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountTab } from "@/components/miniapp/AccountTab";
import { AppBackdrop, AppHeader, BrandMark } from "@/components/miniapp/brand";
import { DepositTab } from "@/components/miniapp/DepositTab";
import { GiftTab } from "@/components/miniapp/GiftTab";
import { HistoryTab } from "@/components/miniapp/HistoryTab";
import { HomeTab, type ExtraScreenId } from "@/components/miniapp/HomeTab";
import { OffersTab } from "@/components/miniapp/OffersTab";
import { ReferralsTab } from "@/components/miniapp/ReferralsTab";
import { ActionButton, Card } from "@/components/miniapp/primitives";
import { SupportTab } from "@/components/miniapp/SupportTab";
import { useBrand, type BrandView } from "@/components/miniapp/use-brand";
import { WheelTab } from "@/components/miniapp/WheelTab";
import { WinsTab } from "@/components/miniapp/WinsTab";
import { WithdrawTab } from "@/components/miniapp/WithdrawTab";
import { showBackButton, tap } from "@/lib/api/telegram";
import { useSession } from "@/lib/api/use-session";
import { cn } from "@/lib/utils";

/*
 * The wheel wears the ferris wheel, not the gift box it used to: 🎁 is «إهداء رصيد» now, on the
 * home screen's extras, and one icon must not mean two things in the same app.
 */
const tabs = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "deposit", label: "إيداع", icon: ReceiptText },
  { id: "withdraw", label: "سحب", icon: ArrowDownToLine },
  { id: "wheel", label: "العجلة", icon: FerrisWheel },
  { id: "account", label: "الحساب", icon: User },
  { id: "support", label: "الدعم", icon: LifeBuoy },
] as const;

type TabId = (typeof tabs)[number]["id"];

/**
 * The owner's extras (2026-09-27) that are screens of this app, reached from the home screen's
 * grid rather than the bar — six slots are all a 320px bar holds. A feature not listed here has no
 * tile on the home screen (HomeTab asks `canOpen`), so a screen is switched on by adding its line.
 * 🎮 is not here at all: it opens the Ichancy site outside the app.
 */
const extraScreens: Partial<Record<ExtraScreenId, () => ReactNode>> = {
  history: () => <HistoryTab />,
  gift: () => <GiftTab />,
  wins: () => <WinsTab />,
  offers: () => <OffersTab />,
  referrals: () => <ReferralsTab />,
};

type ScreenId = TabId | ExtraScreenId;

function isTab(id: ScreenId): id is TabId {
  return tabs.some((entry) => entry.id === id);
}

function canOpen(id: ExtraScreenId): boolean {
  return extraScreens[id] !== undefined;
}

/**
 * Where a screen sits along the strip: a bar tab at its slot, an extra past the end — one step
 * below home — so opening one moves forward and leaving it moves back.
 */
function indexOf(id: ScreenId): number {
  return isTab(id) ? tabs.findIndex((entry) => entry.id === id) : tabs.length;
}

/**
 * NOTHING IS RENDERED BEFORE THE SESSION EXISTS. Every screen's query is authenticated, so mounting
 * a tab first would only buy a round trip that answers 401 — and, worse, a flash of empty state
 * that looks like "you have no deposits".
 */
export function MiniApp() {
  const session = useSession();
  const brand = useBrand();
  const [tab, setTab] = useState<ScreenId>("home");
  /**
   * Which way the last switch went along the bar. The incoming panel's animation follows it, so the
   * six screens read as one strip the player is moving along rather than six unrelated pages.
   */
  const [forward, setForward] = useState(true);

  /**
   * THE ONE PLACE A TAB CHANGES, and therefore the one place the haptic lives — the screens that
   * switch tabs themselves (the home screen's two big buttons, its method rows, its extras) go
   * through here, so a tap is felt exactly once however it was reached.
   */
  function go(next: ScreenId): void {
    if (next === tab) return;
    tap();
    setForward(indexOf(next) > indexOf(tab));
    setTab(next);
  }

  /*
   * An extra is one step below home, so Telegram's own ← is shown there and takes the player back
   * — the in-page «الرئيسية» above the screen does the same outside Telegram. The setters are
   * stable, so this runs only when the screen changes.
   */
  const extra = isTab(tab) ? null : tab;
  useEffect(() => {
    if (extra === null) return undefined;
    return showBackButton(() => {
      tap();
      setForward(false);
      setTab("home");
    });
  }, [extra]);

  const renderExtra = extra === null ? undefined : extraScreens[extra];
  // An extra lights up home in the bar: it is where the player came from and how they go back.
  const active = indexOf(isTab(tab) ? tab : "home");
  const ready = session.state === "ready";

  return (
    <div dir="rtl" style={brand.style} className="min-h-screen text-ink selection:bg-brand/15">
      <AppBackdrop url={brand.backgroundUrl} />

      {!ready ? (
        <Gate session={session} brand={brand} />
      ) : (
        <>
          <main className="app-page mx-auto w-full max-w-md px-4">
            <AppHeader brand={brand} />

            {/* Keyed on the tab so React mounts a fresh node and the enter animation runs again.
                The old `{tab === "x" && …}` already remounted every panel; this only gives it
                something to watch. */}
            <div key={tab} className={forward ? "app-enter-forward" : "app-enter-back"}>
              {tab === "home" && (
                <HomeTab
                  brand={brand}
                  onDeposit={() => go("deposit")}
                  onWithdraw={() => go("withdraw")}
                  onOpen={go}
                  canOpen={canOpen}
                />
              )}
              {tab === "deposit" && <DepositTab />}
              {tab === "withdraw" && <WithdrawTab />}
              {tab === "wheel" && <WheelTab brand={brand} />}
              {tab === "account" && <AccountTab />}
              {tab === "support" && <SupportTab />}
              {renderExtra !== undefined && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => go("home")}
                    className="flex items-center gap-1.5 text-small font-semibold text-brand-ink"
                  >
                    {/* Back is to the right in an Arabic page. */}
                    <ArrowRight className="size-4" />
                    الرئيسية
                  </button>
                  {renderExtra()}
                </div>
              )}
            </div>
          </main>

          <nav className="fixed inset-x-0 bottom-0 select-none border-t border-hairline bg-background/85 backdrop-blur-md">
            {/* The padding is on this wrapper and NOT on the row below, because the indicator is
                positioned against that row: its box has to be exactly six columns wide and nothing
                else, or a sixth of it stops being a tab. */}
            <div className="app-tabbar mx-auto max-w-md px-1 pt-2">
              <div className="relative grid grid-cols-6">
                {/* ONE element moves, not six. It is a sixth of the row wide, so sliding it by its
                    own width is exactly one tab — nothing is measured, and it holds at 320px. */}
                <span
                  aria-hidden="true"
                  style={{ transform: `translateX(${-active * 100}%)` }}
                  className="app-indicator pointer-events-none absolute inset-y-0 start-0 w-1/6 px-1"
                >
                  <span className="block size-full rounded-lg bg-brand-soft" />
                </span>

                {tabs.map(({ id, label, icon: Icon }, index) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => go(id)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-2",
                        "transition active:scale-[0.94]",
                        isActive ? "text-brand-ink" : "text-ink-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0 transition-transform duration-200",
                          isActive && "-translate-y-0.5",
                        )}
                      />
                      {/* leading-none, truncate and min-w-0 on the button: at 320px a slot is 51px,
                          and a label that wraps makes the bar taller than the padding the page
                          reserved for it — while one that overflows takes the page sideways. */}
                      <span
                        className={cn(
                          "w-full truncate text-center text-nano leading-none",
                          isActive ? "font-semibold" : "font-medium",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/** Signing in, or explaining why it could not — including "you opened this outside Telegram". */
function Gate({ session, brand }: { session: ReturnType<typeof useSession>; brand: BrandView }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="app-enter w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark
            key={brand.logoUrl ?? "no-logo"}
            title={brand.title}
            logoUrl={brand.logoUrl}
            className="size-14 text-figure"
          />
          <h1 className="min-w-0 max-w-full truncate text-title font-semibold">{brand.title}</h1>
        </div>

        {session.state === "signing-in" && (
          <p className="app-waiting text-center text-small text-ink-muted">جارٍ تسجيل الدخول…</p>
        )}

        {session.state === "failed" && (
          <Card className="space-y-3 text-center">
            <p className="text-small text-bad">
              {session.error ?? "تعذّر تسجيل الدخول. يرجى المحاولة مرة أخرى."}
            </p>
            <ActionButton
              onClick={() => {
                tap();
                session.retry();
              }}
            >
              إعادة المحاولة
            </ActionButton>
          </Card>
        )}

        {session.state === "needs-code" && (
          <Card className="space-y-3">
            <div className="space-y-1 text-center">
              <h2 className="text-body font-semibold">افتح التطبيق من داخل تلغرام</h2>
              <p className="text-small text-ink-muted">
                أو أرسل <span className="app-code">/login</span> إلى البوت وأدخل الرمز الظاهر.
              </p>
            </div>
            <input
              dir="ltr"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCD-EFGH"
              aria-label="رمز الدخول"
              className="app-field app-code text-center"
            />
            {session.error !== null && (
              <p className="text-center text-small text-bad">{session.error}</p>
            )}
            <ActionButton
              disabled={code.trim().length === 0 || busy}
              busy={busy}
              onClick={() => {
                tap();
                setBusy(true);
                void session.submitCode(code.trim()).finally(() => setBusy(false));
              }}
            >
              {busy ? "جارٍ التحقق…" : "دخول"}
            </ActionButton>
          </Card>
        )}
      </div>
    </div>
  );
}
