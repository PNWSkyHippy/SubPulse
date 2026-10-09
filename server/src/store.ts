import type { AccountBalance, Contact, Note, Payment, Subscription } from '../../src/types';
import type { Promotion } from '../../src/utils/insights';

/**
 * Data access used by the gateway. Implemented on Firestore (production) and
 * in memory (tests / DEMO_MODE). Every method is scoped to one owner uid;
 * the MCP layer never sees another user's documents.
 */
export interface TokenRecord {
  ownerId: string;
  label: string;
  scopes: string[];
}

export interface ActivityEntry {
  ownerId: string;
  label: string;
  tool: string;
  ok: boolean;
  at: string;
}

export interface Store {
  lookupToken(hash: string): Promise<TokenRecord | null>;
  listItems(uid: string): Promise<Subscription[]>;
  getItem(uid: string, id: string): Promise<Subscription | null>;
  addItem(uid: string, item: Omit<Subscription, 'id' | 'ownerId' | 'createdAt'>): Promise<Subscription>;
  updateItem(uid: string, id: string, updates: Partial<Subscription>): Promise<Subscription>;
  /** Atomically writes a payment and the item updates it causes. */
  recordPayment(uid: string, payment: Omit<Payment, 'id' | 'ownerId' | 'createdAt'>, itemUpdates: Partial<Subscription>): Promise<Payment>;
  listPayments(uid: string): Promise<Payment[]>;
  listNotes(uid: string): Promise<Note[]>;
  addNote(uid: string, note: Pick<Note, 'title' | 'body' | 'itemId' | 'tags'>): Promise<Note>;
  listContacts(uid: string): Promise<Contact[]>;
  listBalances(uid: string): Promise<AccountBalance[]>;
  upsertBalance(uid: string, id: string, b: Omit<AccountBalance, 'id' | 'ownerId'>): Promise<void>;
  listPromotions(): Promise<Promotion[]>;
  upsertPromotion(p: Promotion): Promise<void>;
  logActivity(e: ActivityEntry): Promise<void>;
  getStripeCustomer(uid: string): Promise<string | null>;
  setStripeCustomer(uid: string, customerId: string): Promise<void>;
  putLinkSession(nonce: string, data: { uid: string; clientSecret: string; returnUrl: string; expiresAt: number }): Promise<void>;
  takeLinkSession(nonce: string): Promise<{ uid: string; clientSecret: string; returnUrl: string; expiresAt: number } | null>;
}

export const nowISO = () => new Date().toISOString();

/** Firestore rejects undefined; drop those keys. */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
