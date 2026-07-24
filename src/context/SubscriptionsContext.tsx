import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { Subscription } from '../types';
import { scheduleReminderNotification, cancelReminderNotification } from '../utils/notifications';

interface SubscriptionsContextValue {
  subscriptions: Subscription[];
  loading: boolean;
  addSubscription: (sub: Omit<Subscription, 'id' | 'ownerId' | 'createdAt'>) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | undefined>(undefined);

const COLLECTION = 'subscriptions';

export function SubscriptionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, COLLECTION), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs: Subscription[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subscription, 'id'>) }));
      setSubscriptions(subs);
      setLoading(false);
      // Re-schedule local reminders whenever the synced list changes
      // (e.g. after editing on another device).
      subs.forEach((sub) => scheduleReminderNotification(sub));
    });
    return unsubscribe;
  }, [user]);

  const addSubscription: SubscriptionsContextValue['addSubscription'] = async (sub) => {
    if (!user) throw new Error('Must be signed in to add a subscription');
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...sub,
      ownerId: user.uid,
      createdAt: new Date().toISOString(),
    });
    await scheduleReminderNotification({ ...sub, id: docRef.id, ownerId: user.uid, createdAt: new Date().toISOString() });
  };

  const updateSubscription: SubscriptionsContextValue['updateSubscription'] = async (id, updates) => {
    await updateDoc(doc(db, COLLECTION, id), updates);
    const updated = subscriptions.find((s) => s.id === id);
    if (updated) await scheduleReminderNotification({ ...updated, ...updates });
  };

  const deleteSubscription: SubscriptionsContextValue['deleteSubscription'] = async (id) => {
    await cancelReminderNotification(id);
    await deleteDoc(doc(db, COLLECTION, id));
  };

  return (
    <SubscriptionsContext.Provider
      value={{ subscriptions, loading, addSubscription, updateSubscription, deleteSubscription }}
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
