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
} from '@tanstack/react-query';

import { api } from './client';
import type {
  CasinoCredentials,
  DepositStatus,
  DepositView,
  MeResponse,
  Paginated,
  PaymentMethodView,
  PlayerWheelView,
  PlayerWithdrawalView,
  SpinResultView,
  WalletView,
  WheelSpinStatus,
} from './types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const queryKeys = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  paymentMethods: ['payment-methods'] as const,
  deposits: ['deposits'] as const,
  deposit: (shortId: string) => ['deposits', shortId] as const,
  withdrawals: ['withdrawals'] as const,
  casinoCredentials: ['casino-credentials'] as const,
  wheel: ['wheel'] as const,
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
  'DRAFT',
  'AWAITING_PROOF',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
];

export function isOpenDeposit(status: DepositStatus): boolean {
  return OPEN_DEPOSIT.includes(status);
}

export function useMe(enabled: boolean): UseQueryResult<MeResponse> {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<MeResponse>('/v1/me'),
    enabled,
    staleTime: MINUTE,
  });
}

export function useWallet(enabled: boolean): UseQueryResult<WalletView> {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => api<WalletView>('/v1/wallet'),
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
        await api<Paginated<PaymentMethodView> | PaymentMethodView[]>('/v1/payment-methods'),
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
      return rowsOf(await api<Paginated<DepositView> | DepositView[]>('/v1/deposits?limit=20'));
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
          '/v1/withdrawals?limit=20',
        ),
      );
    },
    enabled,
    staleTime: 10 * SECOND,
  });
}

/** Read only when the player asks to see them: the answer carries a password. */
export function useCasinoCredentials(enabled: boolean): UseQueryResult<CasinoCredentials> {
  return useQuery({
    queryKey: queryKeys.casinoCredentials,
    queryFn: () => api<CasinoCredentials>('/v1/me/casino-credentials'),
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
      api<DepositView>('/v1/deposits', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          paymentMethodId: input.paymentMethodId,
          amount: moneyBody(input.amount, input.currencyCode),
          ...(input.externalReference === undefined
            ? {}
            : { externalReference: input.externalReference }),
          ...(input.senderAccount === undefined ? {} : { senderAccount: input.senderAccount }),
          source: 'MINIAPP',
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
        method: 'POST',
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
      api<DepositView>(`/v1/deposits/${shortId}/tx-hash`, { method: 'POST', body: { txHash } }),
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
        method: 'POST',
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
      api<DepositView>(`/v1/deposits/${shortId}/cancel`, { method: 'POST' }),
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
      api<PlayerWithdrawalView>('/v1/withdrawals', {
        method: 'POST',
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

/** 202 and an empty body: the card reached the staff group, there is nothing to render. */
export function useSendSupportMessage(): UseMutationResult<void, unknown, string> {
  return useMutation({
    mutationFn: (message: string) =>
      api<void>('/v1/support/messages', { method: 'POST', body: { message } }),
  });
}

/** The statuses a prize is still moving through — the only ones worth another round trip. */
const SETTLING_SPIN: readonly WheelSpinStatus[] = ['AWARDED', 'CREDITING'];

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
    queryFn: () => api<PlayerWheelView>('/v1/wheel'),
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
    mutationFn: () => api<SpinResultView>('/v1/wheel/spin', { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wheel });
      // A credited prize is real money on the casino side, so the balance on the home screen and
      // the account screen is stale from this moment.
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID !== undefined) return cryptoApi.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
