import { randomUUID } from 'node:crypto';
import type { AccountBalance, Contact, Note, Payment, Subscription } from '../../src/types';
import type { Promotion } from '../../src/utils/insights';
import { ActivityEntry, clean, nowISO, Store, TokenRecord } from './store';

/** In-memory store for tests and `DEMO_MODE=1` local runs. */
export class MemoryStore implements Store {
  tokens = new Map<string, TokenRecord>();
  items = new Map<string, Subscription>();
  payments = new Map<string, Payment>();
  notes = new Map<string, Note>();
  contacts = new Map<string, Contact>();
  balances = new Map<string, AccountBalance>();
  promotions = new Map<string, Promotion>();
  activity: ActivityEntry[] = [];
  customers = new Map<string, string>();
  links = new Map<string, { uid: string; clientSecret: string; returnUrl: string; expiresAt: number }>();

  async lookupToken(hash: string) {
    return this.tokens.get(hash) ?? null;
  }
  async listItems(uid: string) {
    return [...this.items.values()].filter((i) => i.ownerId === uid);
  }
  async getItem(uid: string, id: string) {
    const i = this.items.get(id);
    return i && i.ownerId === uid ? i : null;
  }
  async addItem(uid: string, item: Omit<Subscription, 'id' | 'ownerId' | 'createdAt'>) {
    const doc = { ...clean(item), id: randomUUID(), ownerId: uid, createdAt: nowISO(), updatedAt: nowISO() } as Subscription;
    this.items.set(doc.id, doc);
    return doc;
  }
  async updateItem(uid: string, id: string, updates: Partial<Subscription>) {
    const cur = await this.getItem(uid, id);
    if (!cur) throw new Error('Item not found');
    const next = { ...cur, ...updates, id, ownerId: uid, updatedAt: nowISO() } as Subscription;
    for (const [k, v] of Object.entries(updates)) if (v === undefined) delete (next as any)[k];
    this.items.set(id, next);
    return next;
  }
  async recordPayment(uid: string, payment: Omit<Payment, 'id' | 'ownerId' | 'createdAt'>, itemUpdates: Partial<Subscription>) {
    await this.updateItem(uid, payment.itemId, itemUpdates);
    const p = { ...clean(payment), id: randomUUID(), ownerId: uid, createdAt: nowISO() } as Payment;
    this.payments.set(p.id, p);
    return p;
  }
  async listPayments(uid: string) {
    return [...this.payments.values()].filter((p) => p.ownerId === uid);
  }
  async listNotes(uid: string) {
    return [...this.notes.values()].filter((n) => n.ownerId === uid);
  }
  async addNote(uid: string, note: Pick<Note, 'title' | 'body' | 'itemId' | 'tags'>) {
    const n = { ...clean(note), id: randomUUID(), ownerId: uid, createdAt: nowISO(), updatedAt: nowISO() } as Note;
    this.notes.set(n.id, n);
    return n;
  }
  async listContacts(uid: string) {
    return [...this.contacts.values()].filter((c) => c.ownerId === uid);
  }
  async listBalances(uid: string) {
    return [...this.balances.values()].filter((b) => b.ownerId === uid);
  }
  async upsertBalance(uid: string, id: string, b: Omit<AccountBalance, 'id' | 'ownerId'>) {
    this.balances.set(id, { ...b, id, ownerId: uid });
  }
  async listPromotions() {
    return [...this.promotions.values()];
  }
  async upsertPromotion(p: Promotion) {
    this.promotions.set(p.id, p);
  }
  async logActivity(e: ActivityEntry) {
    this.activity.push(e);
  }
  async getStripeCustomer(uid: string) {
    return this.customers.get(uid) ?? null;
  }
  async setStripeCustomer(uid: string, customerId: string) {
    this.customers.set(uid, customerId);
  }
  async putLinkSession(nonce: string, data: { uid: string; clientSecret: string; returnUrl: string; expiresAt: number }) {
    this.links.set(nonce, data);
  }
  async takeLinkSession(nonce: string) {
    const v = this.links.get(nonce) ?? null;
    this.links.delete(nonce);
    return v;
  }
}
