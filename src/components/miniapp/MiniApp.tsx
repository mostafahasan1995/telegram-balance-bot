/**
 * The whole app: the sign-in gate, the six tabs, and the bar that switches them.
 *
 * IT LIVES IN A COMPONENT AND NOT IN A ROUTE because it is reachable at two paths — / and
 * /<tenant>, which is how an operator's mini app is addressed (app.<domain>/<tenant>). Both
 * routes render this, so there is one shell and no chance of the two drifting.
 */
import { ArrowDownToLine, Gift, Home, LifeBuoy, ReceiptText, User } from "lucide-react";
import { useState } from "react";

import { AccountTab } from "@/components/miniapp/AccountTab";
import { DepositTab } from "@/components/miniapp/DepositTab";
import { HomeTab } from "@/components/miniapp/HomeTab";
import { SupportTab } from "@/components/miniapp/SupportTab";
import { WheelTab } from "@/components/miniapp/WheelTab";
import { WithdrawTab } from "@/components/miniapp/WithdrawTab";
import { tap } from "@/lib/api/telegram";
import { useSession } from "@/lib/api/use-session";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "deposit", label: "إيداع", icon: ReceiptText },
  { id: "withdraw", label: "سحب", icon: ArrowDownToLine },
  { id: "wheel", label: "العجلة", icon: Gift },
  { id: "account", label: "الحساب", icon: User },
  { id: "support", label: "الدعم", icon: LifeBuoy },
] as const;

type TabId = (typeof tabs)[number]["id"];

/** Where a tab sits in the bar. `TabId` is the bar's own union, so -1 cannot come back. */
function indexOf(id: TabId): number {
  return tabs.findIndex((entry) => entry.id === id);
}

/**
 * NOTHING IS RENDERED BEFORE THE SESSION EXISTS. Every screen's query is authenticated, so mounting
 * a tab first would only buy a round trip that answers 401 — and, worse, a flash of empty state
 * that looks like "you have no deposits".
 */
export function MiniApp() {
  const session = useSession();
  const [tab, setTab] = useState<TabId>("home");
  /**
   * Which way the last switch went along the bar. The incoming panel's animation follows it, so the
   * six screens read as one strip the player is moving along rather than six unrelated pages.
   */
  const [forward, setForward] = useState(true);

  /**
   * THE ONE PLACE A TAB CHANGES, and therefore the one place the haptic lives — the screens that
   * switch tabs themselves (the home screen's two big buttons, its method rows) go through here, so
   * a tap is felt exactly once however it was reached.
   */
  function go(next: TabId): void {
    if (next === tab) return;
    tap();
    setForward(indexOf(next) > indexOf(tab));
    setTab(next);
  }

  if (session.state !== "ready") return <Gate session={session} />;

  const active = indexOf(tab);

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-28 text-ink selection:bg-brand/10">
      <main className="mx-auto max-w-md px-4 pt-6">
        {/* Keyed on the tab so React mounts a fresh node and the enter animation runs again. The
            old `{tab === "x" && …}` already remounted every panel; this only gives it something to
            watch. */}
        <div key={tab} className={forward ? "app-enter-forward" : "app-enter-back"}>
          {tab === "home" && (
            <HomeTab onDeposit={() => go("deposit")} onWithdraw={() => go("withdraw")} />
          )}
          {tab === "deposit" && <DepositTab />}
          {tab === "withdraw" && <WithdrawTab />}
          {tab === "wheel" && <WheelTab />}
          {tab === "account" && <AccountTab />}
          {tab === "support" && <SupportTab />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 select-none border-t border-hairline bg-background/85 backdrop-blur-md">
        {/* The padding is on this wrapper and NOT on the row below, because the indicator is
            positioned against that row: its box has to be exactly six columns wide and nothing
            else, or a sixth of it stops being a tab. */}
        <div className="mx-auto max-w-md px-1 pb-2 pt-2">
          <div className="relative grid grid-cols-6">
            {/* ONE element moves, not six. It is a sixth of the row wide, so sliding it by its own
                width is exactly one tab — nothing is measured, and it holds at 320px. */}
            <span
              aria-hidden="true"
              style={{ transform: `translateX(${-active * 100}%)` }}
              className="app-indicator pointer-events-none absolute inset-y-0 start-0 w-1/6 px-1"
            >
              <span className="block size-full rounded-2xl bg-brand-soft" />
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
                    "relative flex flex-col items-center gap-1 rounded-2xl py-2",
                    "transition active:scale-[0.94]",
                    isActive ? "text-brand" : "text-ink-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] transition-transform duration-200",
                      isActive && "-translate-y-0.5",
                    )}
                  />
                  {/* leading-none and nowrap: at 320px a slot is 51px, and a label that wraps
                      makes the bar taller than the padding the page reserved for it. */}
                  <span className="whitespace-nowrap text-[10px] font-medium leading-none">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

/** Signing in, or explaining why it could not — including "you opened this outside Telegram". */
function Gate({ session }: { session: ReturnType<typeof useSession> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background px-6 text-ink"
    >
      <div className="app-enter w-full max-w-sm space-y-4 text-center">
        {session.state === "signing-in" && (
          <p className="app-waiting text-sm text-ink-muted">جارٍ تسجيل الدخول…</p>
        )}

        {session.state === "failed" && (
          <>
            <p className="text-sm text-bad">
              {session.error ?? "تعذّر تسجيل الدخول. يرجى المحاولة مرة أخرى."}
            </p>
            <button
              type="button"
              onClick={() => {
                tap();
                session.retry();
              }}
              className="w-full rounded-2xl bg-brand py-3 text-sm font-medium text-brand-foreground transition active:scale-[0.98]"
            >
              إعادة المحاولة
            </button>
          </>
        )}

        {session.state === "needs-code" && (
          <>
            <h1 className="text-base font-semibold">افتح التطبيق من داخل تلغرام</h1>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              أو أرسل <span className="font-mono">/login</span> إلى البوت وأدخل الرمز الظاهر.
            </p>
            <input
              dir="ltr"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCD-EFGH"
              className="w-full rounded-xl border border-hairline bg-secondary px-3 py-2.5 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-brand/25"
            />
            {session.error !== null && <p className="text-[12px] text-bad">{session.error}</p>}
            <button
              type="button"
              disabled={code.trim().length === 0 || busy}
              onClick={() => {
                tap();
                setBusy(true);
                void session.submitCode(code.trim()).finally(() => setBusy(false));
              }}
              className={cn(
                "w-full rounded-2xl bg-brand py-3 text-sm font-medium text-brand-foreground",
                "transition active:scale-[0.98] disabled:opacity-50",
                busy && "app-busy",
              )}
            >
              {busy ? "جارٍ التحقق…" : "دخول"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
