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
  "PENDING_ICHANCY" | "ACTIVE" | "BLOCKED" | "SUSPENDED" | "SELF_EXCLUDED" | "CLOSED";

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

/**
 * Every status the backend's `deposit_status` can send — the history screen shows them all, so a
 * status missing here would be a row the app cannot describe. (CANCELLED is kept for older rows.)
 */
export type DepositStatus =
  | "DRAFT"
  | "AWAITING_PROOF"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "PENDING_SECOND_APPROVAL"
  | "APPROVED"
  | "CREDITING"
  | "CREDITED"
  | "CREDIT_FAILED"
  | "NEEDS_RECONCILIATION"
  | "REJECTED"
  | "EXPIRED"
  | "REVERSED"
  | "CANCELLED";

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

/** The backend's `payment_rail` enum, spelled as it sends it (prisma/schema.prisma). */
export type PaymentRail = "BANK_TRANSFER" | "MOBILE_WALLET" | "CASH_OFFICE" | "CRYPTO" | "INTERNAL";

/**
 * What a rail asks the player for, as the backend's rail drivers name it (rail.interface.ts). These
 * used to be written in camelCase here, which matched nothing the server ever sent.
 */
export type RailProofField =
  "REFERENCE" | "SENDER_ACCOUNT" | "SENDER_NAME" | "RECEIPT_IMAGE" | "TX_HASH" | "NETWORK";

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
  /**
   * Paid in DOLLARS (USDT, «شام كاش دولار») and credited in `currencyCode` (owner, 2026-09-27). The
   * player is told `usdRate` the moment they pick it. Optional: a backend older than the field
   * simply never shows the notice.
   */
  usdPriced?: boolean;
  /** What ONE dollar is worth in `currencyCode`, as a decimal string ("13800"), or null. */
  usdRate?: string | null;
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

/** `withdrawal_status`, all of it (UNDER_REVIEW and FAILED are kept for older answers). */
export type WithdrawalStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DEBITING"
  | "DEBITED"
  | "PAYING"
  | "PAID"
  | "DEBIT_FAILED"
  | "NEEDS_RECONCILIATION"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED";

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
  /**
   * The Ichancy player site's games page — where the home screen's 🎮 tile goes, the same link as
   * the bot's «🎮 ألعاب Ichancy». Optional: a backend older than the field simply never sends it.
   */
  gamesUrl?: string | null;
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
  "NO_PRIZE" | "AWARDED" | "CREDITING" | "CREDITED" | "CREDIT_FAILED" | "NEEDS_RECONCILIATION";

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
  /**
   * Where a CREDITED prize went: the bonus wallet (every spin since 2026-09-27) or the casino
   * balance (older spins). Optional: a backend older than the field never sends it.
   */
  creditedTo?: "BONUS_WALLET" | "ICHANCY" | null;
}

/** Why a player cannot spin right now. */
export type WheelIneligibilityReason =
  "DISABLED" | "NO_QUALIFYING_DEPOSIT" | "ALREADY_SPUN" | "PLAYER_NOT_ACTIVE" | "NOT_LINKED";

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

/**
 * 🎁 إهداء رصيد — a gift's status, in the backend's own names (`gift_status`).
 *
 * `NEEDS_RECONCILIATION` is NOT a failure: nobody could prove where the money is yet, and a person
 * is checking. `DEBIT_FAILED` moved nothing. `REFUNDED` means the amount came back to the sender.
 */
export type GiftStatus =
  | "REQUESTED"
  | "DEBITING"
  | "DEBITED"
  | "CREDITING"
  | "COMPLETED"
  | "DEBIT_FAILED"
  | "REFUNDING"
  | "REFUNDED"
  | "NEEDS_RECONCILIATION";

/** The other player, as much as a player may know: a first name and a masked handle. */
export interface GiftCounterpartyView {
  firstName: string | null;
  /** «@ah***d», or null when they have no Telegram username. */
  maskedUsername: string | null;
}

/** GET /v1/gifts and GET /v1/gifts/:shortId — one of the player's own gifts. */
export interface PlayerGiftView {
  shortId: string;
  /** A RECEIVED gift is always COMPLETED: a recipient never sees an attempt that missed them. */
  direction: "SENT" | "RECEIVED";
  status: GiftStatus;
  amount: Money;
  counterparty: GiftCounterpartyView;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
}

/** GET /v1/gifts/limits — the operator's rules, what is left of today, and the balance. */
export interface GiftLimitsView {
  enabled: boolean;
  currencyCode: string;
  min: Money;
  max: Money;
  dailyCount: number;
  dailyAmount: Money;
  usedTodayCount: number;
  usedTodayAmount: Money;
  remainingTodayCount: number;
  remainingTodayAmount: Money;
  /** Null means the casino could not be read — never that the balance is zero. */
  balance: Money | null;
}

/** GET /v1/gifts/recipient?query= — who that text names. */
export interface GiftRecipientPreviewView extends GiftCounterpartyView {
  /** The text that was checked, echoed back so the app sends exactly it. */
  query: string;
}

/** How often referral earnings are settled: Damascus midnights; a week runs Saturday to Friday. */
export type ReferralSettlementPeriod = "DAILY" | "WEEKLY";

/** Only CREDITED reached the bonus wallet; BELOW_MINIMUM was worked out and held under the minimum. */
export type ReferralEarningStatus =
  "CREDITED" | "BELOW_MINIMUM" | "NOTHING_DUE" | "REFERRER_INACTIVE" | "INELIGIBLE";

/** One of the player's own referral earnings. */
export interface PlayerReferralEarningView {
  id: string;
  kind: "LOSS_COMMISSION" | "FIRST_DEPOSIT_REWARD";
  periodKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** The invited friend's first name, or their @username. */
  friendName: string | null;
  amount: string;
  amountMinor: string;
  status: ReferralEarningStatus;
  createdAt: string;
}

/** GET /v1/referrals — the player's referral screen (the bot's 🤝 renders the same object). */
export interface PlayerReferralSummaryView {
  /** False: the operator has the programme off. */
  enabled: boolean;
  /** `https://t.me/<bot>?start=ref_<telegram id>`; null when it cannot be built. */
  inviteLink: string | null;
  currencyCode: string;
  terms: {
    commissionBps: number;
    /** The rate as a person reads it: "10", "2.5". */
    commissionPercent: string;
    settlementPeriod: ReferralSettlementPeriod;
    minPayout: string;
    minPayoutMinor: string;
    signupReward: string;
    signupRewardMinor: string;
    /** 100,000 lost, priced at the rate: what the inviter earns from it. */
    example: { loss: string; lossMinor: string; commission: string; commissionMinor: string };
  };
  stats: { invited: number; active: number; earned: string; earnedMinor: string };
  lastPeriod: {
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    earned: string;
    earnedMinor: string;
  } | null;
  nextSettlementAt: string | null;
  recent: PlayerReferralEarningView[];
}

// ── 🔥 العروض: the bonus wallet, offers and codes (backend src/modules/bonus/views/bonus.view.ts) ──

/** Why a wallet line exists. The first six are awards; the last two are the wallet's own moves. */
export type BonusEntrySource =
  | "WELCOME"
  | "OFFER"
  | "PROMO_CODE"
  | "WHEEL"
  | "REFERRAL"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "TRANSFER_REFUND";

/** WELCOME pays itself to each new account; TIMED_GIFT is claimed once, while it runs. */
export type BonusOfferKind = "WELCOME" | "TIMED_GIFT";

/** A move of the wallet to the casino balance. CREDITED and REFUNDED are final. */
export type BonusTransferStatus =
  "REQUESTED" | "CREDITING" | "CREDITED" | "REFUNDED" | "NEEDS_RECONCILIATION";

/** Why the wallet cannot be moved now. */
export type BonusTransferBlockReason =
  | "OPERATOR_PAUSED"
  | "EMPTY"
  | "BELOW_THRESHOLD"
  | "NOT_LINKED"
  | "PLAYER_NOT_ACTIVE"
  | "IN_FLIGHT";

/** One wallet line. `amount` is SIGNED: a move out is negative. */
export interface BonusEntryView {
  id: string;
  source: BonusEntrySource;
  /** The Arabic line, as the bot shows it. */
  description: string;
  amount: string;
  amountMinor: string;
  balanceAfter: string;
  balanceAfterMinor: string;
  createdAt: string;
}

export interface PlayerOfferView {
  id: string;
  kind: BonusOfferKind;
  title: string;
  description: string | null;
  amount: string;
  amountMinor: string;
  startsAt: string | null;
  endsAt: string | null;
  /** A running gift this player has not claimed yet. */
  claimable: boolean;
  /** The player already has it. */
  claimed: boolean;
}

export interface PlayerBonusTransferView {
  id: string;
  shortId: string;
  status: BonusTransferStatus;
  amount: string;
  amountMinor: string;
  createdAt: string;
  creditedAt: string | null;
  refundedAt: string | null;
}

/** GET /v1/bonus — everything the 🔥 tab shows. */
export interface PlayerBonusView {
  /** False while the operator has promotions off: nothing to claim or redeem (the wallet stays). */
  enabled: boolean;
  currencyCode: string;
  balance: string;
  balanceMinor: string;
  /** The wallet can be moved once it holds this much. */
  threshold: string;
  thresholdMinor: string;
  /** 0–10000, never full before the wallet can move. */
  progressBps: number;
  canTransfer: boolean;
  transferBlockedReason: BonusTransferBlockReason | null;
  pendingTransfer: PlayerBonusTransferView | null;
  offers: PlayerOfferView[];
  /** The latest lines, newest first. */
  entries: BonusEntryView[];
}

/** POST /v1/bonus/offers/:id/claim and POST /v1/bonus/redeem. */
export interface BonusAwardView {
  amount: string;
  amountMinor: string;
  balance: string;
  balanceMinor: string;
  /** The redeemed code (uppercase), or null for a claim. */
  code: string | null;
  /** The offer's title, or null for a code. */
  title: string | null;
}

/**
 * 🏆 شارك إصابتك (2026-09-27): where a shared win stands — waiting for staff, posted, or not
 * posted. `REJECTED` is shown softly: the player was thanked, and may share another.
 */
export type WinShareStatus = "PENDING" | "PUBLISHED" | "REJECTED";

/** POST /v1/wins and GET /v1/wins — one of the player's own shares. */
export interface WinShareView {
  id: string;
  status: WinShareStatus;
  via: "BOT" | "APP";
  mediaKind: "PHOTO" | "VIDEO" | "DOCUMENT";
  caption: string | null;
  /** The photo or video; null for a video too big for the server to fetch back (use the thumb). */
  mediaUrl: string | null;
  /** A video's still; null for a photo. */
  thumbnailUrl: string | null;
  createdAt: string;
  decidedAt: string | null;
}
