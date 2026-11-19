/**
 * Plans, entitlement and admin policy.
 *
 * Free tier is a product promise: two profiles, forever, no expiry and no
 * server dependency. Enforcement therefore lives in the shared core so the web
 * UI, the desktop shell and the Android app all agree — a client-side hide is
 * not a policy.
 *
 * IMPORTANT: this is client-side entitlement for an offline-first product. It
 * stops accidental overuse and makes the offer explicit; it is not DRM and it
 * cannot police a modified binary. Server-side truth for paid seats belongs in
 * Supabase (see docs/IP-POLICY.md and the account section of the README).
 */
import type { BrowserFamily } from './extensions';

/** Starter is the time-boxed demo allowance; 'free' is the lifetime tier. */
export type PlanId = 'free' | 'starter' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  /** null = unlimited */
  profileLimit: number | null;
  browsers: BrowserFamily[];
  features: string[];
  summary: string;
}

/**
 * What the shells actually run.
 *
 * v3.1.1 advertised "five bundled engines" — Joe Browser, Chrome, Edge, Brave and
 * Firefox. Only one engine is bundled: the Chromium that Electron and the Android
 * WebView provide. Chrome, Edge and Brave are *compatible identities* on that
 * engine (their own brands send a Chromium-shaped UA and Client Hints), which is
 * coherent. Firefox is Gecko: a Firefox UA on a Chromium engine is a contradiction
 * a detector can see in one call, so it is not offered at all rather than faked.
 */
export interface BrowserSupport {
  family: BrowserFamily;
  label: string;
  /** the engine a profile in this family really runs on */
  engine: 'chromium';
  available: boolean;
  note: string;
}

export const BROWSER_SUPPORT: BrowserSupport[] = [
  { family: 'joe', label: 'Joe Browser', engine: 'chromium', available: true, note: 'Bundled Chromium build. No browser installed on the machine is used.' },
  { family: 'chrome', label: 'Chrome', engine: 'chromium', available: true, note: 'Chrome-compatible identity on the bundled Chromium.' },
  { family: 'edge', label: 'Edge', engine: 'chromium', available: true, note: 'Edge-compatible identity on the bundled Chromium.' },
  { family: 'brave', label: 'Brave', engine: 'chromium', available: true, note: 'Brave-compatible identity on the bundled Chromium.' },
  { family: 'firefox', label: 'Firefox', engine: 'chromium', available: false, note: 'Not offered: this build bundles no Gecko engine, and a Firefox identity on Chromium would be incoherent.' },
];

export function browserSupport(family: BrowserFamily): BrowserSupport {
  return BROWSER_SUPPORT.find((b) => b.family === family) ?? BROWSER_SUPPORT[BROWSER_SUPPORT.length - 1];
}

export function isBrowserAvailable(family: BrowserFamily): boolean {
  return browserSupport(family).available;
}

/** Identities a user can actually choose today. */
export const SELECTABLE_BROWSERS: BrowserFamily[] = BROWSER_SUPPORT.filter((b) => b.available).map((b) => b.family);

const ALL_BROWSERS: BrowserFamily[] = SELECTABLE_BROWSERS;

export const FREE_PROFILE_LIMIT = 2;

export const DEMO_PROFILE_LIMIT = 6;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 'Lifetime',
    profileLimit: FREE_PROFILE_LIMIT,
    browsers: ['chrome', 'joe'],
    summary: 'Two profiles you keep forever.',
    features: [
      '2 browser profiles, no expiry',
      'Chrome and Joe Browser engines',
      'Isolated cookies, cache and storage per profile',
      'Coherent device fingerprint per profile',
      'Local probe and independent detector links',
      'Browsing history per profile',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Demo',
    price: 'Time-boxed',
    profileLimit: DEMO_PROFILE_LIMIT,
    browsers: ALL_BROWSERS,
    summary: 'Explore every engine with the sample workspace.',
    features: [
      'Sample workspace with six profiles',
      'Every bundled engine unlocked while exploring',
      'Sign in to choose Free (2 lifetime profiles) or Premium',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 'Subscription',
    profileLimit: null,
    browsers: ALL_BROWSERS,
    summary: 'Unlimited profiles, every bundled engine, advanced controls.',
    features: [
      'Unlimited browser profiles',
      'Joe Browser, Chrome, Edge and Brave identities on the bundled engine',
      'Advanced fingerprint classes and observed-device rotation',
      'Proxy monitor with offline and rotation alerts',
      'Bulk create, import and per-profile history export',
      'Paste-as-human typing and extension library',
      'Desktop ⇄ Android sync',
    ],
  },
};

export interface Account {
  email: string;
  plan: PlanId;
  role: 'owner' | 'admin' | 'member';
  /** ISO timestamp; null for lifetime/free */
  renewsAt?: string | null;
  /**
   * True only when a server session proved this identity *and* the server
   * assigned the role. A role string on its own is not evidence: v3.1.1 typed
   * the owner address into a text box and became the owner with no password.
   */
  verified?: boolean;
  /** Provenance of `plan`, shown in the UI instead of implying a checked state. */
  source?: 'local' | 'server' | 'cache';
}

/**
 * The account seeded into `public.app_admins` by
 * `supabase/migrations/0002_entitlements.sql`. It is a bootstrap value for the
 * database, NOT an authorisation check in the client — see `isAdmin`.
 */
export const OWNER_EMAIL = 'pritamsarkar1321@gmail.com';

/**
 * Administrator check.
 *
 * Requires a verified server session carrying an administrator role. Nothing in
 * this app may grant that role locally, so an offline or edited workspace can
 * never escalate itself.
 */
export function isAdmin(account: Account | null | undefined): boolean {
  return !!account && account.verified === true && (account.role === 'owner' || account.role === 'admin');
}

/** True when the plan was confirmed by the server (as opposed to a local default). */
export function isVerifiedAccount(account: Account | null | undefined): boolean {
  return !!account && account.verified === true;
}

export function planFor(account: Account | null | undefined): Plan {
  if (isAdmin(account)) return PLANS.premium;
  if (account?.plan === 'premium') return PLANS.premium;
  if (account?.plan === 'starter') return PLANS.starter;
  return PLANS.free;
}

export interface Entitlement {
  allowed: boolean;
  /** human explanation, shown verbatim in the UI */
  reason: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

/** Can this account create `adding` more profiles right now? */
export function checkProfileQuota(account: Account | null | undefined, used: number, adding = 1): Entitlement {
  const plan = planFor(account);
  const limit = plan.profileLimit;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const allowed = limit === null || used + adding <= limit;
  return {
    allowed,
    limit,
    used,
    remaining,
    reason: allowed
      ? limit === null
        ? 'Unlimited profiles on this plan'
        : `${remaining} of ${limit} free profiles left`
      : plan.id === 'starter'
        ? `The demo workspace holds ${DEMO_PROFILE_LIMIT} profiles. Sign in to continue with Free (${FREE_PROFILE_LIMIT} lifetime profiles) or Premium (unlimited).`
        : `The free plan includes ${FREE_PROFILE_LIMIT} profiles for life. Upgrade for unlimited profiles — existing profiles are never removed.`,
  };
}

export function browserAllowed(account: Account | null | undefined, family: BrowserFamily): boolean {
  return planFor(account).browsers.includes(family);
}

/** Browsers a user cannot pick yet, with the reason for the upsell row. */
export function lockedBrowsers(account: Account | null | undefined): BrowserFamily[] {
  const allowed = new Set(planFor(account).browsers);
  return ALL_BROWSERS.filter((b) => !allowed.has(b));
}

/**
 * Download/visibility gate for the custom engine. Kept separate from
 * `browserAllowed` so the licence text can be shown before a download starts.
 */
export function engineRequiresPremium(family: BrowserFamily): boolean {
  return family === 'joe' || family === 'edge' || family === 'brave';
}
