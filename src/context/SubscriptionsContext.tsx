import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { AccountBalance, Contact, NewSubscription, Note, Payment, Subscription } from '../types';
import { scheduleReminderNotification, cancelReminderNotification } from '../utils/notifications';
import { applyPayment } from '../utils/billing';
import { todayLocal } from '../utils/dateHelpers';
import { Promotion } from '../utils/insights';
import { contactDedupeKey } from '../utils/vcard';

/**
 * All of the user's synced data. Every collection is per-user (ownerId ==
 * auth uid) and protected by firestore.rules. The MCP gateway server reads
 * and writes the same collections, so agent changes show up here live.
 */
export const COLLECTIONS = {
  items: 'subscriptions', // kept for compatibility with v1 data
  payments: 'payments',
  notes: 'notes',
  contacts: 'contacts',
  balances: 'balances',
  promotions: 'promotions', // public, read-only feed maintained by the admin/server
} as const;

interface SubscriptionsContextValue {
  subscriptions: Subscription[];
  payments: Payment[];
  notes: Note[];
  contacts: Contact[];
  balances: AccountBalance[];
  promotions: Promotion[];
  loading: boolean;
  addSubscription: (sub: NewSubscription) => Promise<string>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  /** Records a payment and advances the item's due date by one cycle. */
  recordPayment: (itemId: string, opts?: { amount?: number; paidDate?: Date; method?: string; note?: string }) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  addNote: (note: Pick<Note, 'title' | 'body' | 'itemId' | 'tags'>) => Promise<string>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addContact: (c: Pick<Contact, 'name' | 'phone' | 'email' | 'source' | 'externalId'>) => Promise<string>;
  /** Bulk import, skipping people already present. Returns how many were added. */
  importContacts: (list: Pick<Contact, 'name' | 'phone' | 'email' | 'source' | 'externalId'>[]) => Promise<number>;
  deleteContact: (id: string) => Promise<void>;
  upsertManualBalance: (b: Pick<AccountBalance, 'name' | 'available' | 'currency'> & { id?: string }) => Promise<void>;
  deleteBalance: (id: string) => Promise<void>;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | undefined>(undefined);

/** Firestore rejects `undefined` field values; drop them. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** For updates: keys explicitly set to undefined are deleted from the document (e.g. removing a payee). */
function toUpdate(obj: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
}

function useOwnedCollection<T>(name: string, uid: string | undefined, onData?: (rows: T[]) => void): [T[], boolean] {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const cb = useRef(onData);
  cb.current = onData;
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, name), where('ownerId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
        setRows(data);
        setLoading(false);
        cb.current?.(data);
      },
      (err) => {
        console.warn(`Firestore ${name} listener error`, err);
        setLoading(false);
      }
    );
  }, [name, uid]);
  return [rows, loading];
}

export function SubscriptionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [subscriptions, loadingItems] = useOwnedCollection<Subscription>(COLLECTIONS.items, uid, (subs) => {
    // Re-schedule local reminders whenever the synced list changes
    // (e.g. after editing on another device, or an agent marking a bill paid).
    subs.forEach((sub) => scheduleReminderNotification(sub).catch(() => {}));
  });
  const [payments] = useOwnedCollection<Payment>(COLLECTIONS.payments, uid);
  const [notes] = useOwnedCollection<Note>(COLLECTIONS.notes, uid);
  const [contacts] = useOwnedCollection<Contact>(COLLECTIONS.contacts, uid);
  const [balances] = useOwnedCollection<AccountBalance>(COLLECTIONS.balances, uid);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  useEffect(() => {
    if (!uid) return;
    // Promotions are a shared read-only feed; a missing collection just means none yet.
    getDocs(collection(db, COLLECTIONS.promotions))
      .then((snap) => setPromotions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Promotion, 'id'>) }))))
      .catch(() => setPromotions([]));
  }, [uid]);

  const requireUid = () => {
    if (!uid) throw new Error('Must be signed in');
    return uid;
  };
  const now = () => new Date().toISOString();

  const addSubscription: SubscriptionsContextValue['addSubscription'] = async (sub) => {
    const owner = requireUid();
    const createdAt = now();
    const ref = await addDoc(collection(db, COLLECTIONS.items), { ...clean(sub), ownerId: owner, createdAt, updatedAt: createdAt });
    await scheduleReminderNotification({ ...sub, id: ref.id, ownerId: owner, createdAt }).catch(() => {});
    return ref.id;
  };

  const updateSubscription: SubscriptionsContextValue['updateSubscription'] = async (id, updates) => {
    await updateDoc(doc(db, COLLECTIONS.items, id), { ...toUpdate(updates), updatedAt: now() });
    const existing = subscriptions.find((s) => s.id === id);
    if (existing) await scheduleReminderNotification({ ...existing, ...updates }).catch(() => {});
  };

  const deleteSubscription: SubscriptionsContextValue['deleteSubscription'] = async (id) => {
    await cancelReminderNotification(id);
    await deleteDoc(doc(db, COLLECTIONS.items, id));
  };

  const recordPayment: SubscriptionsContextValue['recordPayment'] = async (itemId, opts = {}) => {
    const owner = requireUid();
    const item = subscriptions.find((s) => s.id === itemId);
    if (!item) throw new Error('Item not found');
    const paidDate = opts.paidDate ?? todayLocal();
    const { updates, settledDueDate } = applyPayment(item, paidDate);
    const batch = writeBatch(db);
    const payRef = doc(collection(db, COLLECTIONS.payments));
    batch.set(
      payRef,
      clean({
        ownerId: owner,
        itemId,
        amount: opts.amount ?? item.cost,
        currency: item.currency,
        paidDate: paidDate.toISOString().slice(0, 10),
        dueDate: settledDueDate,
        method: opts.method,
        note: opts.note,
        createdAt: now(),
      })
    );
    batch.update(doc(db, COLLECTIONS.items, itemId), { ...clean(updates), updatedAt: now() });
    await batch.commit();
    await scheduleReminderNotification({ ...item, ...updates }).catch(() => {});
  };

  const deletePayment = async (id: string) => deleteDoc(doc(db, COLLECTIONS.payments, id));

  const addNote: SubscriptionsContextValue['addNote'] = async (note) => {
    const owner = requireUid();
    const t = now();
    const ref = await addDoc(collection(db, COLLECTIONS.notes), clean({ ...note, ownerId: owner, createdAt: t, updatedAt: t }));
    return ref.id;
  };
  const updateNote: SubscriptionsContextValue['updateNote'] = async (id, updates) => {
    await updateDoc(doc(db, COLLECTIONS.notes, id), { ...toUpdate(updates), updatedAt: now() });
  };
  const deleteNote = async (id: string) => deleteDoc(doc(db, COLLECTIONS.notes, id));

  const addContact: SubscriptionsContextValue['addContact'] = async (c) => {
    const owner = requireUid();
    const ref = await addDoc(collection(db, COLLECTIONS.contacts), clean({ ...c, ownerId: owner, createdAt: now() }));
    return ref.id;
  };

  const importContacts: SubscriptionsContextValue['importContacts'] = async (list) => {
    const owner = requireUid();
    const seen = new Set(contacts.map(contactDedupeKey));
    const fresh = list.filter((c) => {
      const k = contactDedupeKey(c);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Firestore batches are limited to 500 writes.
    for (let i = 0; i < fresh.length; i += 450) {
      const batch = writeBatch(db);
      for (const c of fresh.slice(i, i + 450)) {
        batch.set(doc(collection(db, COLLECTIONS.contacts)), clean({ ...c, ownerId: owner, createdAt: now() }));
      }
      await batch.commit();
    }
    return fresh.length;
  };
  const deleteContact = async (id: string) => deleteDoc(doc(db, COLLECTIONS.contacts, id));

  const upsertManualBalance: SubscriptionsContextValue['upsertManualBalance'] = async (b) => {
    const owner = requireUid();
    const data = { name: b.name, available: b.available, currency: b.currency, source: 'manual' as const, ownerId: owner, updatedAt: now() };
    if (b.id) await updateDoc(doc(db, COLLECTIONS.balances, b.id), data);
    else await addDoc(collection(db, COLLECTIONS.balances), data);
  };
  const deleteBalance = async (id: string) => deleteDoc(doc(db, COLLECTIONS.balances, id));

  return (
    <SubscriptionsContext.Provider
      value={{
        subscriptions,
        payments,
        notes,
        contacts,
        balances,
        promotions,
        loading: loadingItems,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        recordPayment,
        deletePayment,
        addNote,
        updateNote,
        deleteNote,
        addContact,
        importContacts,
        deleteContact,
        upsertManualBalance,
        deleteBalance,
      }}
    >
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions(): SubscriptionsContextValue {
  const ctx = useContext(SubscriptionsContext);
  if (!ctx) throw new Error('useSubscriptions must be used within a SubscriptionsProvider');
  return ctx;
}
