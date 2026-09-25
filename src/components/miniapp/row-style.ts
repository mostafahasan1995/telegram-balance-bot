/**
 * The two plain functions the screens' lists share with `primitives.tsx`: which colour a row's
 * status chip wears, and the stagger a row arrives with.
 *
 * They live apart from the components because a module React Fast Refresh can hot-swap must
 * export nothing but components.
 */
import type { CSSProperties } from "react";

/**
 * The three colours a request can wear. Deliberately NOT the backend's status enum: a player only
 * needs "waiting", "done" or "no", and mapping the nine real statuses here would put a business
 * rule in a chip. Each screen maps its own rows with `chipOf`.
 */
export type ChipStatus = "pending" | "approved" | "rejected";

/** The one place that decides which colour a deposit or withdrawal wears. */
export function chipOf(status: string): ChipStatus {
  if (status === "CREDITED" || status === "APPROVED" || status === "PAID") return "approved";
  if (
    status === "REJECTED" ||
    status === "EXPIRED" ||
    status === "CANCELLED" ||
    status === "FAILED"
  ) {
    return "rejected";
  }
  return "pending";
}

/**
 * The stagger a list uses as it arrives.
 *
 * CAPPED ON PURPOSE: twenty deposits at 35ms each would take most of a second to finish appearing,
 * and the twentieth row is not worth waiting for. After the sixth they all arrive together.
 */
export function enterDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 5) * 35}ms` };
}
