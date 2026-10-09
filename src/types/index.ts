/**
 * Core data model.
 *
 * `Subscription` is kept as the name of the main record for backwards
 * compatibility with documents already stored in Firestore, but it now
 * represents ANY recurring (or one-time) obligation: a streaming service,
 * a lease, a utility bill, a magazine, a loan payment, a one-off fee.
 * Every field added after v1 is optional so old documents still load;
 * read them through the helpers in utils/billing.ts, which apply defaults.
 */

export type BillingCycle =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'once';

export const ALL_BILLING_CYCLES: BillingCycle[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
  'once',
];

export type ItemKind =
  | 'subscription'
  | 'lease'
  | 'utility'
  | 'magazine'
  | 'insurance'
  | 'loan'
  | 'membership'
  | 'one-time'
  | 'other';

export const ALL_ITEM_KINDS: ItemKind[] = [
  'subscription',
  'lease',
  'utility',
  'magazine',
  'insurance',
  'loan',
  'membership',
  'one-time',
  'other',
];

export type ItemStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export interface SplitShare {
  contactId: string;
  /** Fraction of the cost this contact owes, 0..1. */
  share: number;
}

export interface Subscription {
  id: string;
  name: string;
  cost: number; // cost per billing cycle, in `currency`
  currency: string; // e.g. 'USD'
  billingCycle: BillingCycle;
  /**
   * ISO yyyy-mm-dd. For auto-pay items this is any known charge date and is
   * rolled forward automatically. For manual-pay items it is the CURRENT
   * UNPAID due date: it stays put (and becomes overdue) until a payment is
   * recorded, which advances it by one cycle.
   */
  nextRenewalDate: string;
  reminderDaysBefore: number;
  category?: string;
  notes?: string;
  /** Known prices on other cycles, used for exact annual-switch savings. */
  alternatePrices?: Partial<Record<BillingCycle, number>>;
  createdAt: string;
  ownerId: string;

  // ---- v2 (SubPulse) fields, all optional ----
  kind?: ItemKind;
  status?: ItemStatus;
  /** Card / bank auto-debit. When false the item can go overdue. Default true for subscriptions. */
  autoPay?: boolean;
  /** Link to the built-in catalog of known services (data/catalog.ts). */
  catalogId?: string;
  /** Contact who is paid (landlord, utility rep...) */
  payeeContactId?: string;
  /** People sharing the cost. */
  splits?: SplitShare[];
  /** Days after the due date at which overdue escalation steps fire. Default [1, 3, 7]. */
  escalationDays?: number[];
  /** Last time a payment was recorded (ISO date). */
  lastPaidDate?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  ownerId: string;
  itemId: string;
  amount: number;
  currency: string;
  /** ISO date the payment was made. */
  paidDate: string;
  /** ISO due date this payment settles. */
  dueDate: string;
  method?: string;
  note?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  ownerId: string;
  /** Item this note is attached to, if any. */
  itemId?: string;
  title: string;
  body: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ContactSource = 'device' | 'vcard' | 'manual';

export interface Contact {
  id: string;
  ownerId: string;
  name: string;
  phone?: string;
  email?: string;
  source: ContactSource;
  /** Id in the source system (device contact id), used to de-duplicate re-imports. */
  externalId?: string;
  createdAt: string;
}

export type BalanceSource = 'stripe' | 'manual';

export interface AccountBalance {
  id: string;
  ownerId: string;
  name: string;
  institution?: string;
  last4?: string;
  available: number;
  current?: number;
  currency: string;
  source: BalanceSource;
  updatedAt: string;
}

export interface MonthlySpendSummary {
  totalMonthly: number;
  byCategory: Record<string, number>;
  byCurrency: Record<string, number>;
  subscriptionCount: number;
}

/** Fields a caller provides when creating an item. */
export type NewSubscription = Omit<Subscription, 'id' | 'ownerId' | 'createdAt'>;
