import { createFileRoute } from "@tanstack/react-router";
import { Home, LifeBuoy, ReceiptText, User } from "lucide-react";
import { useState } from "react";

import { AccountTab } from "@/components/miniapp/AccountTab";
import { DepositTab } from "@/components/miniapp/DepositTab";
import { HomeTab } from "@/components/miniapp/HomeTab";
import { SupportTab } from "@/components/miniapp/SupportTab";
import { health } from "@/lib/miniapp-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ichancy Cashier — شحن الرصيد ومتابعة الإيداعات" },
      {
        name: "description",
        content:
          "تطبيق مصغر لشحن رصيد حسابك، إرسال رقم مرجع الدفع، متابعة الإيداعات، وعرض بيانات حسابك وحالة الخدمة.",
      },
      { property: "og:title", content: "Ichancy Cashier — شحن الرصيد ومتابعة الإيداعات" },
      {
        property: "og:description",
        content:
          "اشحن رصيدك، أرسل رقم المرجع مع صورة الإيصال، وتابع رصيدك على المنصة مباشرة من تلغرام.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiniApp,
});

const tabs = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "deposit", label: "العمليات", icon: ReceiptText },
  { id: "account", label: "الحساب", icon: User },
  { id: "support", label: "الدعم", icon: LifeBuoy },
] as const;

type TabId = (typeof tabs)[number]["id"];

function MiniApp() {
  const [tab, setTab] = useState<TabId>("home");
  const degraded = health.services.some((s) => s.state !== "ok");

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-28 text-ink selection:bg-brand/10">
      <div className="sticky top-0 z-10 border-b border-hairline bg-background/85 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 animate-pulse rounded-full",
                degraded ? "bg-warn" : "bg-brand",
              )}
            />
            <span className="text-[11px] font-medium tracking-wide text-ink-muted">
              حالة الخدمة: {degraded ? "بطء جزئي" : "متصل"}
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-ink-muted">{health.version}</span>
        </div>
      </div>

      <main className="mx-auto max-w-md px-4 pt-6">
        {tab === "home" && <HomeTab onDeposit={() => setTab("deposit")} />}
        {tab === "deposit" && <DepositTab />}
        {tab === "account" && <AccountTab />}
        {tab === "support" && <SupportTab />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-8 py-3">
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
