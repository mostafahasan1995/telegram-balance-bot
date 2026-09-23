import { createFileRoute } from "@tanstack/react-router";

import { MiniApp } from "@/components/miniapp/MiniApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الكاشير — شحن الرصيد ومتابعة الإيداعات" },
      {
        name: "description",
        content:
          "تطبيق مصغر لشحن رصيد حسابك، إرسال رقم مرجع الدفع، متابعة الإيداعات، وعرض بيانات حسابك.",
      },
      { property: "og:title", content: "الكاشير — شحن الرصيد ومتابعة الإيداعات" },
      {
        property: "og:description",
        content: "اشحن رصيدك، أرسل رقم العملية، وتابع رصيدك على المنصة مباشرة من تلغرام.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiniApp,
});
