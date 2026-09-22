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

/**
 * NOTHING IS RENDERED BEFORE THE SESSION EXISTS. Every screen's query is authenticated, so mounting
 * a tab first would only buy a round trip that answers 401 — and, worse, a flash of empty state
 * that looks like "you have no deposits".
 */
export function MiniApp() {
  const session = useSession();
  const [tab, setTab] = useState<TabId>("home");

  if (session.state !== "ready") return <Gate session={session} />;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-28 text-ink selection:bg-brand/10">
      <main className="mx-auto max-w-md px-4 pt-6">
        {tab === "home" && (
          <HomeTab onDeposit={() => setTab("deposit")} onWithdraw={() => setTab("withdraw")} />
        )}
        {tab === "deposit" && <DepositTab />}
        {tab === "withdraw" && <WithdrawTab />}
        {tab === "wheel" && <WheelTab />}
        {tab === "account" && <AccountTab />}
        {tab === "support" && <SupportTab />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-hairline bg-background/85 backdrop-blur-md">
        {/* px-3, not px-6: six items have to stay readable on a 320px phone without shrinking. */}
        <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  active ? "text-brand" : "text-ink-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl",
                    active && "bg-brand-soft",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
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
      <div className="w-full max-w-sm space-y-4 text-center">
        {session.state === "signing-in" && (
          <p className="text-sm text-ink-muted">جارٍ تسجيل الدخول…</p>
        )}

        {session.state === "failed" && (
          <>
            <p className="text-sm text-bad">
              {session.error ?? "تعذّر تسجيل الدخول. يرجى المحاولة مرة أخرى."}
            </p>
            <button
              type="button"
              onClick={session.retry}
              className="w-full rounded-2xl bg-brand py-3 text-sm font-medium text-brand-foreground"
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
                setBusy(true);
                void session.submitCode(code.trim()).finally(() => setBusy(false));
              }}
              className="w-full rounded-2xl bg-brand py-3 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              {busy ? "جارٍ التحقق…" : "دخول"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
