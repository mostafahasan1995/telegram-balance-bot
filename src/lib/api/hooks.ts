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
  PlayerWithdrawalView,
  WalletView,
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
};

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
      const page = await api<Paginated<PaymentMethodView> | PaymentMethodView[]>(
        '/v1/payment-methods',
      );
      // The route is paginated, but a bare array is accepted so a change there cannot blank the
      // deposit screen.
      return Array.isArray(page) ? page : page.data;
    },
    enabled,
    staleTime: 5 * MINUTE,
  });
}

export function useDeposits(enabled: boolean): UseQueryResult<DepositView[]> {
  return useQuery({
    queryKey: queryKeys.deposits,
    queryFn: async () => {
      const page = await api<Paginated<DepositView>>('/v1/deposits?limit=20');
      return page.data;
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
      const page = await api<Paginated<PlayerWithdrawalView>>('/v1/withdrawals?limit=20');
      return page.data;
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
  /** Minor units, as a decimal string — never a JS number. */
  amountMinor: string;
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
          amount: { minor: input.amountMinor },
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
  amountMinor: string;
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
          amount: { minor: input.amountMinor },
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

function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID !== undefined) return cryptoApi.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
