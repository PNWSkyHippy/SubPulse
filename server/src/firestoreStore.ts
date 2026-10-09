import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Firestore } from 'firebase-admin/firestore';
import type { AccountBalance, Contact, Note, Payment, Subscription } from '../../src/types';
import type { Promotion } from '../../src/utils/insights';
import { ActivityEntry, clean, nowISO, Store } from './store';

/**
 * Firestore-backed store using the Admin SDK (bypasses security rules), so
 * every query here MUST filter by ownerId. Collection names match the app's
 * SubscriptionsContext.
 */
export class FirestoreStore implements Store {
  db: Firestore;
  constructor() {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    }
    this.db = getFirestore();
  }

  private async owned<T>(collection: string, uid: string): Promise<T[]> {
    const snap = await this.db.collection(collection).where('ownerId', '==', uid).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async lookupToken(hash: string) {
    const d = await this.db.collection('mcpTokens').doc(hash).get();
    if (!d.exists) return null;
    const v = d.data()!;
    return { ownerId: v.ownerId, label: v.label ?? 'Agent', scopes: Array.isArray(v.scopes) ? v.scopes : ['read'] };
  }
  listItems(uid: string) {
    return this.owned<Subscription>('subscriptions', uid);
  }
  async getItem(uid: string, id: string) {
    const d = await this.db.collection('subscriptions').doc(id).get();
    if (!d.exists || d.data()!.ownerId !== uid) return null;
    return { id: d.id, ...d.data() } as Subscription;
  }
  async addItem(uid: string, item: Omit<Subscription, 'id' | 'ownerId' | 'createdAt'>) {
    const data = { ...clean(item), ownerId: uid, createdAt: nowISO(), updatedAt: nowISO() };
    const ref = await this.db.collection('subscriptions').add(data);
    return { id: ref.id, ...data } as Subscription;
  }
  private toUpdate(updates: object) {
    return Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v === undefined ? FieldValue.delete() : v]));
  }
  async updateItem(uid: string, id: string, updates: Partial<Subscription>) {
    const cur = await this.getItem(uid, id);
    if (!cur) throw new Error('Item not found');
    const { id: _i, ownerId: _o, createdAt: _c, ...safe } = updates as any;
    await this.db.collection('subscriptions').doc(id).update({ ...this.toUpdate(safe), updatedAt: nowISO() });
    return (await this.getItem(uid, id))!;
  }
  async recordPayment(uid: string, payment: Omit<Payment, 'id' | 'ownerId' | 'createdAt'>, itemUpdates: Partial<Subscription>) {
    const itemRef = this.db.collection('subscriptions').doc(payment.itemId);
    const payRef = this.db.collection('payments').doc();
    const data = { ...clean(payment), ownerId: uid, createdAt: nowISO() };
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists || snap.data()!.ownerId !== uid) throw new Error('Item not found');
      tx.set(payRef, data);
      tx.update(itemRef, { ...this.toUpdate(itemUpdates), updatedAt: nowISO() });
    });
    return { id: payRef.id, ...data } as Payment;
  }
  listPayments(uid: string) {
    return this.owned<Payment>('payments', uid);
  }
  listNotes(uid: string) {
    return this.owned<Note>('notes', uid);
  }
  async addNote(uid: string, note: Pick<Note, 'title' | 'body' | 'itemId' | 'tags'>) {
    const data = { ...clean(note), ownerId: uid, createdAt: nowISO(), updatedAt: nowISO() };
    const ref = await this.db.collection('notes').add(data);
    return { id: ref.id, ...data } as Note;
  }
  listContacts(uid: string) {
    return this.owned<Contact>('contacts', uid);
  }
  listBalances(uid: string) {
    return this.owned<AccountBalance>('balances', uid);
  }
  async upsertBalance(uid: string, id: string, b: Omit<AccountBalance, 'id' | 'ownerId'>) {
    await this.db.collection('balances').doc(id).set({ ...clean(b), ownerId: uid });
  }
  async listPromotions() {
    const snap = await this.db.collection('promotions').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Promotion);
  }
  async upsertPromotion(p: Promotion) {
    const { id, ...rest } = p;
    await this.db.collection('promotions').doc(id).set(clean(rest));
  }
  async logActivity(e: ActivityEntry) {
    await this.db.collection('mcpActivity').add(e);
  }
  async getStripeCustomer(uid: string) {
    const d = await this.db.collection('gatewayUsers').doc(uid).get();
    return (d.exists && (d.data()!.stripeCustomerId as string)) || null;
  }
  async setStripeCustomer(uid: string, customerId: string) {
    await this.db.collection('gatewayUsers').doc(uid).set({ stripeCustomerId: customerId }, { merge: true });
  }
  async putLinkSession(nonce: string, data: { uid: string; clientSecret: string; returnUrl: string; expiresAt: number }) {
    await this.db.collection('stripeLinkSessions').doc(nonce).set(data);
  }
  async takeLinkSession(nonce: string) {
    const ref = this.db.collection('stripeLinkSessions').doc(nonce);
    return this.db.runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) return null;
      tx.delete(ref);
      return d.data() as { uid: string; clientSecret: string; returnUrl: string; expiresAt: number };
    });
  }
}
