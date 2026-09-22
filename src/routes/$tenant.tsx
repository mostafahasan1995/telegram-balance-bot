/**
 * `app.<domain>/<tenant>` — the address an operator's players are actually given.
 *
 * The slug is NOT read here and never sent anywhere: the operator is decided by which bot signed
 * the initData, and a client-supplied tenant would be a client deciding whose player it is. The
 * segment exists so each operator can have its own link (and its own bot's mini-app URL), not so
 * the app can choose an operator.
 */
import { createFileRoute } from "@tanstack/react-router";

import { MiniApp } from "@/components/miniapp/MiniApp";

export const Route = createFileRoute("/$tenant")({
  component: MiniApp,
});
