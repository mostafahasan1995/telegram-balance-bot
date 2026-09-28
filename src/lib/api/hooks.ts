/**
 * Every read and write the screens are allowed to make, as hooks.
 *
 * WHY THE SCREENS MAY NOT CALL `api()` DIRECTLY: a query key written twice is a cache that
 * invalidates in one place and not the other. Creating a deposit has to make the wallet, the
 * deposit list and the home screen stale together, and that only works if one file owns the keys.
 *
 * STALENESS, DELIBERATELY CHOSEN PER READ:
 *  - the wallet is a live casino read on the server side, so it is refetched on focus but not
 *    polled: a player switching back to the app wants a fresh number, a player standing still does
 *    not need one every ten seconds;
 *  - a deposit that is still open IS polled, because the whole point of the screen is watching a
 *    stranger approve it;
 *  - the payment methods and the casino credentials barely change, so they are cached for minutes.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "./client";
import { tenantSlug } from "./runtime-config";
import type {
  BonusAwardView,
  Branding,
  CasinoCredentials,
  DepositStatus,
  DepositView,
  GiftLimitsView,
  GiftRecipientPreviewView,
  GiftStatus,
  MeResponse,
  Paginated,
  PaymentMethodView,
  PlayerBonusTransferView,
  PlayerBonusView,
  PlayerGiftView,
  PlayerReferralSummaryView,
  PlayerWheelView,
  PlayerWithdrawalView,
  SpinResultView,
  WalletView,
  WheelSpinStatus,
  WinShareView,
  WithdrawalStatus,
} from "./types";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const queryKeys = {
  me: ["me"] as const,
  wallet: ["wallet"] as const,
  paymentMethods: ["payment-methods"] as const,
  payoutMethods: ["payment-methods", "payout"] as const,
  deposits: ["deposits"] as const,
  deposit: (shortId: string) => ["deposits", shortId] as const,
  withdrawals: ["withdrawals"] as const,
  casinoCredentials: ["casino-credentials"] as const,
  wheel: ["wheel"] as const,
  /** The bonus wallet, its offers and latest lines — one read, so one key. */
  bonus: ["bonus"] as const,
  /** One prefix for the gift limits and the gift list: a new gift changes both. */
  gifts: ["gifts"] as const,
  giftLimits: ["gifts", "limits"] as const,
  giftList: ["gifts", "list"] as const,
  referrals: ["referrals"] as const,
  /** The player's own shared wins (🏆). */
  wins: ["wins"] as const,
  /** Keyed by slug: one webview only ever shows one operator, but the key must say which. */
  branding: (slug: string) => ["branding", slug] as const,
};

/**
 * The rows out of a list answer, however it is wrapped.
 *
 * `api()` already unwraps the `{ data, meta }` envelope, so a paginated route arrives here as a
 * bare array — NOT as `{ data: [...] }`. Reading `.data` off it gave `undefined`, and the screens
 * that then called `.some()` or `.map()` on it threw, which the query surfaced as "could not
 * complete" on the home screen while the wallet beside it loaded fine. One helper, so the three
 * lists cannot drift apart on the point again.
 */
function rowsOf<T>(answer: Paginated<T> | T[]): T[] {
  if (Array.isArray(answer)) return answer;
  return Array.isArray(answer.data) ? answer.data : [];
}

/**
 * MONEY ON THE WIRE IS `{ amount, currencyCode }`, A DECIMAL STRING.
 *
 * The API's MoneyDto takes `amount: "250000.00"` — never minor units, and never a number. Sending
 * `{ minor }` is what "The request payload is invalid" meant: the field the server validates was
 * simply not there. The amount stays a string the whole way, so nothing rounds it.
 */
function moneyBody(amount: string, currencyCode: string): { amount: string; currencyCode: string } {
  return { amount, currencyCode };
}

/** The statuses a deposit is still moving through — the ones worth polling. */
const OPEN_DEPOSIT: readonly DepositStatus[] = [
  "DRAFT",
  "AWAITING_PROOF",
  "SUBMITTED",
  "UNDER_REVIEW",
  "PENDING_SECOND_APPROVAL",
  "APPROVED",
  "CREDITING",
];

export function isOpenDeposit(status: DepositStatus): boolean {
  return OPEN_DEPOSIT.includes(status);
}

/** The statuses a cash-out is still waiting on a person for — the ones worth polling. */
const OPEN_WITHDRAWAL: readonly WithdrawalStatus[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DEBITING",
  "DEBITED",
  "PAYING",
];

export function isOpenWithdrawal(status: WithdrawalStatus): boolean {
  return OPEN_WITHDRAWAL.includes(status);
}

/**
 * The operator's own look, read before anything else and never waited on.
 *
 * NOT GATED ON THE SESSION, unlike every other read here: the route is public precisely so the app
 * can paint while it is still signing in — and so a player who lands on the code screen still sees
 * their operator's app rather than a grey box.
 *
 * FAILURE IS NORMAL AND SILENT. An operator that has set nothing, a slug that does not resolve, a
 * backend that predates the route — all of them answer 404, and the screens already look right
 * with every field absent. So: no retry, a long stale time, and nothing anywhere reads its error.
 */
export function useBranding(): UseQueryResult<Branding> {
  const tenant = tenantSlug();
  return useQuery({
    queryKey: queryKeys.branding(tenant ?? ""),
    queryFn: () => api<Branding>(`/v1/app/${encodeURIComponent(tenant ?? "")}/branding`),
    // A slug is the whole address of the thing being asked for; without one there is nothing to ask.
    enabled: tenant !== null,
    staleTime: 10 * MINUTE,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useMe(enabled: boolean): UseQueryResult<MeResponse> {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<MeResponse>("/v1/me"),
    enabled,
    staleTime: MINUTE,
  });
}

export function useWallet(enabled: boolean): UseQueryResult<WalletView> {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => api<WalletView>("/v1/wallet"),
    enabled,
    staleTime: 15 * SECOND,
    refetchOnWindowFocus: true,
  });
}

export function usePaymentMethods(enabled: boolean): UseQueryResult<PaymentMethodView[]> {
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: async () => {
      return rowsOf(
        await api<Paginated<PaymentMethodView> | PaymentMethodView[]>("/v1/payment-methods"),
      );
    },
    enabled,
    staleTime: 5 * MINUTE,
  });
}

/**
 * The methods a player can be PAID through — the withdrawal screen's list.
 *
 * NOT the deposit list. The withdrawal screen used to read `GET /v1/payment-methods`, which is what
 * a player can PAY IN with: another set, with another minimum folded in, and a method the operator
 * has configured for deposits is not thereby one it pays out through. `/v1/payment-methods/payout`
 * is the same list the bot's 💸 offers (WithdrawalService.payoutMethodsFor): switched on, configured,
 * never INTERNAL.
 */
export function usePayoutMethods(enabled: boolean): UseQueryResult<PaymentMethodView[]> {
  return useQuery({
    queryKey: queryKeys.payoutMethods,
    queryFn: async () => {
      return rowsOf(
        await api<Paginated<PaymentMethodView> | PaymentMethodView[]>("/v1/payment-methods/payout"),
      );
    },
    enabled,
    staleTime: 5 * MINUTE,
  });
}

export function useDeposits(enabled: boolean): UseQueryResult<DepositView[]> {
  return useQuery({
    queryKey: queryKeys.deposits,
    queryFn: async () => {
      return rowsOf(await api<Paginated<DepositView> | DepositView[]>("/v1/deposits?limit=20"));
    },
    enabled,
    staleTime: 10 * SECOND,
    // Keep watching while anything is still open; stop the moment nothing is.
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (rows === undefined) return false;
      return rows.some((row) => isOpenDeposit(row.status)) ? 15 * SECOND : false;
    },
  });
}

export function useWithdrawals(enabled: boolean): UseQueryResult<PlayerWithdrawalView[]> {
  return useQuery({
    queryKey: queryKeys.withdrawals,
    queryFn: async () => {
      return rowsOf(
        await api<Paginated<PlayerWithdrawalView> | PlayerWithdrawalView[]>(
          "/v1/withdrawals?limit=20",
        ),
      );
    },
    enabled,
    staleTime: 10 * SECOND,
    /*
     * WATCHED WHILE ONE IS OPEN, exactly like a deposit.
     *
     * The card pulses while a cash-out is still waiting on a person, and a pulse is a promise that
     * the screen is watching. Without this it was not: nothing refetched, and a withdrawal that had
     * just been paid went on breathing "under review" until the player closed the app and came
     * back. A Telegram webview rarely fires a window focus, so focus alone cannot carry it.
     */
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (rows === undefined) return false;
      return rows.some((row) => isOpenWithdrawal(row.status)) ? 15 * SECOND : false;
    },
  });
}

/** Read only when the player asks to see them: the answer carries a password. */
export function useCasinoCredentials(enabled: boolean): UseQueryResult<CasinoCredentials> {
  return useQuery({
    queryKey: queryKeys.casinoCredentials,
    queryFn: () => api<CasinoCredentials>("/v1/me/casino-credentials"),
    enabled,
    staleTime: 5 * MINUTE,
    retry: false,
  });
}

export interface CreateDepositInput {
  paymentMethodId: string;
  /** The decimal the player typed, normalised — "250000.00". Never minor units, never a number. */
  amount: string;
  currencyCode: string;
  externalReference?: string;
  senderAccount?: string;
}

/**
 * WHY THE IDEMPOTENCY KEY IS MINTED HERE: a phone that changes network mid-POST retries the same
 * gesture, and without a key that is a second deposit for money that was sent once. The key is
 * generated per submission, not per hook, so a player who genuinely opens two deposits gets two.
 */
export function useCreateDeposit(): UseMutationResult<DepositView, unknown, CreateDepositInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepositInput) =>
      api<DepositView>("/v1/deposits", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: {
          paymentMethodId: input.paymentMethodId,
          amount: moneyBody(input.amount, input.currencyCode),
          ...(input.externalReference === undefined
            ? {}
            : { externalReference: input.externalReference }),
          ...(input.senderAccount === undefined ? {} : { senderAccount: input.senderAccount }),
          source: "MINIAPP",
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits });
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export function useSubmitReference(): UseMutationResult<
  DepositView,
  unknown,
  { shortId: string; reference: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shortId, reference }) =>
      api<DepositView>(`/v1/deposits/${shortId}/reference`, {
        method: "POST",
        body: { reference },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits });
    },
  });
}

export function useSubmitTxHash(): UseMutationResult<
  DepositView,
  unknown,
  { shortId: string; txHash: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shortId, txHash }) =>
      api<DepositView>(`/v1/deposits/${shortId}/tx-hash`, { method: "POST", body: { txHash } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits });
    },
  });
}

/**
 * The receipt image. `imageBase64` may keep its `data:` prefix — the backend strips it, because
 * doing that here is exactly the step a client forgets.
 */
export function useSubmitProof(): UseMutationResult<
  DepositView,
  unknown,
  { shortId: string; imageBase64: string; mimeType: string; externalReference?: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shortId, imageBase64, mimeType, externalReference }) =>
      api<DepositView>(`/v1/deposits/${shortId}/proof`, {
        method: "POST",
        body: {
          imageBase64,
          mimeType,
          ...(externalReference === undefined ? {} : { externalReference }),
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits });
    },
  });
}

export function useCancelDeposit(): UseMutationResult<DepositView, unknown, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (shortId: string) =>
      api<DepositView>(`/v1/deposits/${shortId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits });
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

export interface CreateWithdrawalInput {
  paymentMethodId: string;
  /** The decimal the player typed, normalised. Same rule as the deposit's. */
  amount: string;
  currencyCode: string;
  payoutAddress: string;
}

export function useCreateWithdrawal(): UseMutationResult<
  PlayerWithdrawalView,
  unknown,
  CreateWithdrawalInput
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWithdrawalInput) =>
      api<PlayerWithdrawalView>("/v1/withdrawals", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: {
          paymentMethodId: input.paymentMethodId,
          amount: moneyBody(input.amount, input.currencyCode),
          payoutAddress: input.payoutAddress,
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.withdrawals });
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/**
 * 202 and an empty body: the ticket card reached the support group (or the staff group when there
 * is none), there is nothing to render. The answer arrives later from the bot, in private.
 */
export function useSendSupportMessage(): UseMutationResult<void, unknown, string> {
  return useMutation({
    mutationFn: (message: string) =>
      api<void>("/v1/support/messages", { method: "POST", body: { message } }),
  });
}

/** The statuses a prize is still moving through — the only ones worth another round trip. */
const SETTLING_SPIN: readonly WheelSpinStatus[] = ["AWARDED", "CREDITING"];

/**
 * The wheel: its segments, whether this player may spin, and their spin once they have had it.
 *
 * POLLED ONLY WHILE A PRIZE IS IN FLIGHT. The credit is handed to a worker that talks to the
 * casino, so the result card has to settle by itself while the player watches it; the moment the
 * spin reaches a final status there is nothing left to watch and the polling stops.
 */
export function useWheel(enabled: boolean): UseQueryResult<PlayerWheelView> {
  return useQuery({
    queryKey: queryKeys.wheel,
    queryFn: () => api<PlayerWheelView>("/v1/wheel"),
    enabled,
    staleTime: 15 * SECOND,
    refetchInterval: (query) => {
      const status = query.state.data?.spin?.status;
      return status !== undefined && SETTLING_SPIN.includes(status) ? 5 * SECOND : false;
    },
  });
}

/**
 * One spin. No body: there is nothing a client may say about a spin.
 *
 * AND NO IDEMPOTENCY KEY, deliberately — unlike every other write in this file. One spin per
 * campaign is a unique index on the server, so a retried tap, a replayed request, a second phone,
 * all already answer with the first spin (`replayed: true`). A client key here would be a second,
 * weaker copy of a guarantee that is already absolute.
 */
export function useSpinWheel(): UseMutationResult<SpinResultView, unknown, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<SpinResultView>("/v1/wheel/spin", { method: "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wheel });
      // Since 2026-09-27 a prize lands in the bonus wallet with the spin, so the 🔥 tab is stale
      // from this moment. The casino balance is refreshed too, for a spin made before that change.
      void client.invalidateQueries({ queryKey: queryKeys.bonus });
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

// ── 🎁 إهداء رصيد ──────────────────────────────────────────────────────────────────────────

/** The statuses a gift is still moving through — the worker settles them within seconds. */
const SETTLING_GIFT: readonly GiftStatus[] = [
  "REQUESTED",
  "DEBITING",
  "DEBITED",
  "CREDITING",
  "REFUNDING",
];

export function isSettlingGift(status: GiftStatus): boolean {
  return SETTLING_GIFT.includes(status);
}

/** The operator's gift rules, today's usage and the balance. Re-read on focus, never polled. */
export function useGiftLimits(enabled: boolean): UseQueryResult<GiftLimitsView> {
  return useQuery({
    queryKey: queryKeys.giftLimits,
    queryFn: () => api<GiftLimitsView>("/v1/gifts/limits"),
    enabled,
    staleTime: 15 * SECOND,
    refetchOnWindowFocus: true,
  });
}

/**
 * The player's gifts, sent and received, newest first.
 *
 * POLLED ONLY WHILE ONE OF THEIR OWN IS STILL MOVING, like the wheel's prize: the transfer runs on
 * a worker a few seconds after the tap, and the row has to settle by itself while the player
 * watches it. The moment nothing is moving, the polling stops.
 */
export function useGifts(enabled: boolean): UseQueryResult<PlayerGiftView[]> {
  return useQuery({
    queryKey: queryKeys.giftList,
    queryFn: async () => {
      return rowsOf(await api<Paginated<PlayerGiftView> | PlayerGiftView[]>("/v1/gifts?limit=20"));
    },
    enabled,
    staleTime: 10 * SECOND,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (rows === undefined) return false;
      return rows.some((row) => row.direction === "SENT" && isSettlingGift(row.status))
        ? 3 * SECOND
        : false;
    },
  });
}

/**
 * Who a typed recipient is — a first name and a masked handle, after every rule about the two
 * players. A MUTATION, not a query: it runs when the player presses "check", never on a keystroke,
 * and a refusal (not found, yourself, unavailable) is the answer the screen shows.
 */
export function useCheckGiftRecipient(): UseMutationResult<
  GiftRecipientPreviewView,
  unknown,
  string
> {
  return useMutation({
    mutationFn: (query: string) =>
      api<GiftRecipientPreviewView>(`/v1/gifts/recipient?query=${encodeURIComponent(query)}`),
  });
}

export interface CreateGiftInput {
  /** Exactly the text the recipient check answered for. */
  recipient: string;
  /** The decimal the player typed, normalised — "10000.00". Never minor units, never a number. */
  amount: string;
  currencyCode: string;
}

/**
 * Give. The idempotency key is minted per submission, for the deposit's reason: a phone that
 * changes network mid-POST retries the same gesture, and a gift sent twice is the player's money
 * given away twice.
 */
export function useCreateGift(): UseMutationResult<PlayerGiftView, unknown, CreateGiftInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGiftInput) =>
      api<PlayerGiftView>("/v1/gifts", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: {
          recipient: input.recipient,
          amount: moneyBody(input.amount, input.currencyCode),
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.gifts });
      // The debit lands seconds later; the balance on every screen is stale from this moment.
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/**
 * The referral screen: the invite link, the terms priced on 100,000 lost, the player's figures and
 * latest earnings. Refetched on focus, not polled: the figures move once per settlement period, on
 * the backend's clock.
 */
export function useReferrals(enabled: boolean): UseQueryResult<PlayerReferralSummaryView> {
  return useQuery({
    queryKey: queryKeys.referrals,
    queryFn: () => api<PlayerReferralSummaryView>("/v1/referrals"),
    enabled,
    staleTime: MINUTE,
    refetchOnWindowFocus: true,
  });
}

/**
 * 🔥 العروض: the bonus wallet, the bar to the threshold, the offers running now, the latest lines.
 *
 * POLLED ONLY WHILE A MOVE IS ON ITS WAY. A move to the casino balance is credited by a worker, so
 * the card has to settle by itself while the player watches it; the moment nothing is in flight the
 * polling stops.
 */
export function useBonus(enabled: boolean): UseQueryResult<PlayerBonusView> {
  return useQuery({
    queryKey: queryKeys.bonus,
    queryFn: () => api<PlayerBonusView>("/v1/bonus"),
    enabled,
    staleTime: 15 * SECOND,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.pendingTransfer != null ? 5 * SECOND : false),
  });
}

/** «استلم الهدية». Once per player on the server; the key makes a retried tap answer with the first. */
export function useClaimBonusOffer(): UseMutationResult<BonusAwardView, unknown, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) =>
      api<BonusAwardView>(`/v1/bonus/offers/${encodeURIComponent(offerId)}/claim`, {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.bonus });
    },
  });
}

/** «عندي كود». The code goes as typed; the server normalises case, spaces and Arabic digits. */
export function useRedeemBonusCode(): UseMutationResult<BonusAwardView, unknown, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api<BonusAwardView>("/v1/bonus/redeem", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: { code },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.bonus });
    },
  });
}

/** «حوّل للرصيد»: the WHOLE wallet, once it reached the threshold. The credit lands seconds later. */
export function useBonusTransfer(): UseMutationResult<PlayerBonusTransferView, unknown, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<PlayerBonusTransferView>("/v1/bonus/transfer", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.bonus });
      // The casino balance is about to grow: every screen showing it is stale from this moment.
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/**
 * 🏆 The player's own shared wins, newest first, with where each one stands. Polled only while one
 * is still waiting for staff — the moment it is posted (or not) the screen says so by itself.
 */
export function useMyWins(enabled: boolean): UseQueryResult<WinShareView[]> {
  return useQuery({
    queryKey: queryKeys.wins,
    queryFn: async () => rowsOf(await api<Paginated<WinShareView> | WinShareView[]>("/v1/wins")),
    enabled,
    staleTime: 15 * SECOND,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (rows === undefined) return false;
      return rows.some((row) => row.status === "PENDING") ? 20 * SECOND : false;
    },
  });
}

export interface ShareWinInput {
  file: File;
  caption: string;
}

/**
 * One win: the photo or video as multipart `file`, and the player's words as `caption`. No
 * idempotency key — the server caps shares per hour, and a retried upload is at worst a second
 * card staff reject in one tap.
 */
export function useShareWin(): UseMutationResult<WinShareView, unknown, ShareWinInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, caption }: ShareWinInput) => {
      const body = new FormData();
      body.append("file", file, file.name);
      if (caption.trim().length > 0) body.append("caption", caption.trim());
      return api<WinShareView>("/v1/wins", { method: "POST", body });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wins });
    },
  });
}

function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID !== undefined) return cryptoApi.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
