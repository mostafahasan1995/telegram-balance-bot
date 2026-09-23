/**
 * The shapes the backend actually answers with, copied from its view files rather than inferred.
 *
 * WHY THEY ARE COPIED AND NOT SHARED: the two repositories deploy separately, so a shared package
 * would have to be versioned and published for every field. These are small, they change rarely,
 * and a mismatch shows up as a type error here rather than as `undefined` on a screen.
 *
 * MONEY IS NEVER A NUMBER. Every amount arrives as a decimal STRING (`amount`) beside its integer
 * minor units (`minor`). Parsing either into a JS number would round 12,345,678.90 wrong, so the
 * app formats the string and does its arithmetic on `minor` with BigInt.
 */

export interface Money {
  minor: string;
  amount: string;
  currency: string;
}

/** The wallet's own money shape: no currency, because the wallet states it once. */
export interface WalletMoney {
  minor: string;
  amount: string;
}

export type PlayerStatus =
  | 'PENDING_ICHANCY'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'SUSPENDED'
  | 'SELF_EXCLUDED'
  | 'CLOSED';

export interface PlayerView {
  id: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  status: PlayerStatus;
  currencyCode: string;
  /** Whether the Ichancy mirror account exists yet. */
  ichancyLinked: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface MeResponse {
  player: PlayerView;
  eligibility: {
    eligible: boolean;
    reason: string | null;
    excludedUntil: string | null;
  };
}

export type DepositStatus =
  | 'DRAFT'
  | 'AWAITING_PROOF'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CREDITED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PendingDepositView {
  shortId: string;
  status: DepositStatus;
  amount: WalletMoney;
  createdAt: string;
  expiresAt: string | null;
}

export interface WalletView {
  currency: string;
  ledger: {
    owed: WalletMoney;
    casinoMirror: WalletMoney;
  };
  /** `available: false` means the casino could not be read — NOT that the balance is zero. */
  casino: {
    available: boolean;
    balance: WalletMoney | null;
    readAt: string;
  };
  pending: {
    count: number;
    total: WalletMoney;
    items: PendingDepositView[];
  };
}

export type PaymentRail = 'CASH_AGENT' | 'EWALLET' | 'BANK_TRANSFER' | 'CRYPTO';

export type RailProofField = 'reference' | 'senderAccount' | 'txHash' | 'image';

export interface PaymentMethodView {
  id: string;
  code: string;
  displayName: string;
  rail: PaymentRail;
  currencyCode: string;
  verificationMode: string;
  minAmount: string;
  maxAmount: string;
  feeFixed: string;
  feeBps: number;
  requiresReference: boolean;
  instructions: string | null;
  /** From the rail driver, so the app renders the right form without hardcoding rails. */
  requiredProofFields: readonly RailProofField[];
}

export interface DepositDestinationView {
  methodCode: string;
  methodName: string;
  instructions: string | null;
  requiresReference: boolean;
  label: string | null;
  accountIdentifier: string | null;
  accountHolder: string | null;
}

export interface DepositView {
  shortId: string;
  status: DepositStatus;
  claimed: Money;
  verified: Money | null;
  credited: Money | null;
  fee: Money;
  externalReference: string | null;
  senderAccount: string | null;
  proofCount: number;
  createdAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  creditedAt: string | null;
  rejectionCode: string | null;
  rejectionNote: string | null;
  destination: DepositDestinationView | null;
}

export type WithdrawalStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export interface PlayerWithdrawalView {
  shortId: string;
  status: WithdrawalStatus;
  methodCode: string;
  methodName: string;
  payoutAddress: string;
  payoutNetwork: string | null;
  amount: Money;
  fee: Money;
  requestedAt: string;
  decidedAt: string | null;
  paidAt: string | null;
}

/** GET /v1/me/casino-credentials — read when the player asks to see them, never cached to disk. */
export interface CasinoCredentials {
  site: string;
  login: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601. The app refreshes on this instead of decoding the JWT. */
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

/** POST /v1/auth/telegram answers with the session AND who signed in. */
export interface LoginResult {
  player: PlayerView;
  tokens: AuthTokens;
  isNewPlayer: boolean;
  /** What happened to the `start_param` referral. Observability only; never a failure. */
  referral: string;
}

/** The envelope every list route answers with. */
export interface Paginated<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
}

/**
 * `GET /v1/app/:slug/branding` — how THIS operator's app should look.
 *
 * Every field but the title is nullable, and the title is the operator's own display name when
 * they set nothing, so an operator who never opens the appearance screen still has an app that
 * looks finished. Nothing here is a secret: it is a name, a colour and three image links an
 * operator chose to put in front of their own players, which is why the route needs no session —
 * the app has to paint before it can sign anybody in.
 */
export interface Branding {
  title: string;
  tagline: string | null;
  /** `#rrggbb`, or null to keep the app's own colour. Measured for contrast before it is used. */
  brandColor: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  wheelBackgroundUrl: string | null;
  currencyCode: string;
}

/**
 * Where a spin's prize stands, in the backend's own names (`wheel_spin_status`).
 *
 * IT IS NOT A PAYMENT STATUS, and two of the six catch people out: `NO_PRIZE` is a segment worth
 * nothing, so it is finished the moment it is drawn and there is no credit to wait for; and
 * `NEEDS_RECONCILIATION` does not mean the prize failed — it means nobody could prove whether it
 * landed, so a person has to look. A screen that lumped either in with "on its way" would be
 * telling the player to wait for something that is never coming.
 */
export type WheelSpinStatus =
  | 'NO_PRIZE'
  | 'AWARDED'
  | 'CREDITING'
  | 'CREDITED'
  | 'CREDIT_FAILED'
  | 'NEEDS_RECONCILIATION';

/** A segment as a player sees it — the weights that decide the draw never leave the server. */
export interface WheelSegmentView {
  label: string;
  amount: string;
  amountMinor: string;
}

export interface WheelSpinView {
  id: string;
  shortId: string;
  prizeLabel: string;
  amount: string;
  amountMinor: string;
  currencyCode: string;
  status: WheelSpinStatus;
  createdAt: string;
  creditedAt: string | null;
}

/** Why a player cannot spin right now. */
export type WheelIneligibilityReason =
  | 'DISABLED'
  | 'NO_QUALIFYING_DEPOSIT'
  | 'ALREADY_SPUN'
  | 'PLAYER_NOT_ACTIVE'
  | 'NOT_LINKED';

/** GET /v1/wheel */
export interface PlayerWheelView {
  enabled: boolean;
  currencyCode: string;
  /** The smallest single credited deposit that earns a spin. */
  minDeposit: string;
  minDepositMinor: string;
  /** Empty while the operator has never configured a wheel — then there is nothing to draw. */
  segments: WheelSegmentView[];
  canSpin: boolean;
  /** Why not, when `canSpin` is false. */
  reason: WheelIneligibilityReason | null;
  /** This player's spin in the current campaign, once they have had it. */
  spin: WheelSpinView | null;
}

/** POST /v1/wheel/spin */
export interface SpinResultView {
  spin: WheelSpinView;
  /** The wheel the server drew from — the list `landOn` indexes, so the app draws THIS one. */
  segments: WheelSegmentView[];
  /**
   * The index in `segments` the server drew. Null when the prize is no longer on the wheel (a
   * replay after the operator edited it): show the result with NO animation.
   */
  landOn: number | null;
  /** True when this answered with the player's existing spin instead of making a new one. */
  replayed: boolean;
}
