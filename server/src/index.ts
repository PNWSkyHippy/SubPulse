import Stripe from 'stripe';
import { createApp } from './app';
import { MemoryStore } from './memoryStore';
import { Store } from './store';
import { sha256 } from './auth';
import { todayLocal } from '../../src/utils/dateHelpers';

/**
 * Entry point. Environment:
 *   PORT                    (Cloud Run sets this; default 8080)
 *   PUBLIC_URL              public https URL of this service (for Stripe link pages)
 *   FIREBASE_PROJECT_ID     your Firebase project id (uses Application Default Credentials)
 *   STRIPE_SECRET_KEY       optional; enables balances
 *   STRIPE_PUBLISHABLE_KEY  optional; needed with the secret key
 *   ADMIN_TOKEN             optional; enables POST /admin/promotions
 *   DEMO_MODE=1             run with an in-memory store and a demo token (no Firebase needed)
 */
async function main() {
  const demo = process.env.DEMO_MODE === '1';
  let store: Store;
  let verifyIdToken: (t: string) => Promise<{ uid: string; email?: string }>;

  if (demo) {
    const mem = new MemoryStore();
    const token = process.env.DEMO_TOKEN ?? 'sp_live_demo';
    mem.tokens.set(sha256(token), { ownerId: 'demo-user', label: 'Demo agent', scopes: ['read', 'write', 'payments', 'cancel'] });
    const today = todayLocal();
    const iso = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
    await mem.addItem('demo-user', { name: 'Netflix', cost: 17.99, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(5), reminderDaysBefore: 3, catalogId: 'netflix', category: 'Streaming' });
    await mem.addItem('demo-user', { name: 'Apartment Lease', cost: 1200, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(-4), reminderDaysBefore: 3, kind: 'lease', category: 'Housing' });
    await mem.addItem('demo-user', { name: 'Spotify Premium', cost: 11.99, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(12), reminderDaysBefore: 3 });
    await mem.addItem('demo-user', { name: 'Apple Music', cost: 10.99, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(20), reminderDaysBefore: 3 });
    store = mem;
    verifyIdToken = async () => ({ uid: 'demo-user' });
    console.log(`DEMO_MODE: in-memory store, agent token "${token}"`);
  } else {
    const { FirestoreStore } = await import('./firestoreStore');
    const { getAuth } = await import('firebase-admin/auth');
    store = new FirestoreStore();
    verifyIdToken = async (t) => {
      const d = await getAuth().verifyIdToken(t);
      return { uid: d.uid, email: d.email };
    };
  }

  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const port = Number(process.env.PORT ?? 8080);
  const app = createApp({
    store,
    verifyIdToken,
    stripe,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
    adminToken: process.env.ADMIN_TOKEN,
  });
  app.listen(port, () => console.log(`SubPulse gateway listening on :${port} (MCP at /mcp)`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
