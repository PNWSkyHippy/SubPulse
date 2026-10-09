import { randomBytes } from 'node:crypto';
import express, { Router } from 'express';
import type Stripe from 'stripe';
import { Store, nowISO } from './store';
import { IdTokenVerifier, userAuth } from './auth';

/**
 * Stripe Financial Connections (balances only).
 *
 * 1. App -> POST /stripe/link-session (Firebase ID token). We create a
 *    Financial Connections session for the user's Stripe customer and store
 *    its client secret under a one-time nonce.
 * 2. App opens GET /stripe/link/:nonce in the browser. That page runs
 *    Stripe.js collectFinancialConnectionsAccounts() and then redirects to
 *    subpulse://stripe-linked.
 * 3. App -> POST /stripe/refresh: we refresh and read balances for every
 *    linked account and write them to the user's `balances` collection.
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test keys work).
 */
export function stripeRouter(opts: { store: Store; stripe: Stripe | null; publishableKey: string; publicUrl: string; verify: IdTokenVerifier }): Router {
  const { store, stripe, publishableKey, publicUrl, verify } = opts;
  const r = Router();
  r.use(express.json());

  const needStripe = (res: express.Response) => {
    if (!stripe || !publishableKey) {
      res.status(503).json({ error: 'Stripe is not configured on this gateway (set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY).' });
      return true;
    }
    return false;
  };

  async function customerFor(uid: string, email?: string): Promise<string> {
    const existing = await store.getStripeCustomer(uid);
    if (existing) return existing;
    const c = await stripe!.customers.create({ email, metadata: { subpulseUid: uid } });
    await store.setStripeCustomer(uid, c.id);
    return c.id;
  }

  r.post('/link-session', userAuth(verify), async (req, res) => {
    if (needStripe(res)) return;
    const user = (req as any).user as { uid: string; email?: string };
    try {
      const customer = await customerFor(user.uid, user.email);
      const returnUrl = typeof req.body?.returnUrl === 'string' && req.body.returnUrl.startsWith('subpulse://') ? req.body.returnUrl : 'subpulse://stripe-linked';
      const session = await stripe!.financialConnections.sessions.create({
        account_holder: { type: 'customer', customer },
        permissions: ['balances'],
        filters: { country: 'US', account_subcategories: ['checking', 'savings'] },
      });
      const nonce = randomBytes(24).toString('hex');
      await store.putLinkSession(nonce, { uid: user.uid, clientSecret: session.client_secret!, returnUrl, expiresAt: Date.now() + 15 * 60 * 1000 });
      res.json({ url: `${publicUrl}/stripe/link/${nonce}` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? 'Could not start Stripe linking' });
    }
  });

  r.get('/link/:nonce', async (req, res) => {
    if (needStripe(res)) return;
    const s = await store.takeLinkSession(req.params.nonce);
    if (!s || s.expiresAt < Date.now()) {
      res.status(410).send('This link has expired. Start again from the SubPulse app.');
      return;
    }
    const esc = (v: string) => JSON.stringify(v).replace(/</g, '\\u003c');
    res.set('Content-Security-Policy', "default-src 'self' https://js.stripe.com https://*.stripe.com; script-src 'unsafe-inline' https://js.stripe.com; frame-src https://*.stripe.com; style-src 'unsafe-inline'");
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link your bank · SubPulse</title>
<style>body{background:#08090A;color:#E3E2E3;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{max-width:360px;padding:24px;text-align:center}button{background:#00F59B;color:#08090A;border:0;border-radius:6px;padding:14px 20px;font-weight:600;font-size:16px;width:100%}p{color:#9AA3A0}</style>
<script src="https://js.stripe.com/v3/"></script></head><body><main><h2>Link a bank account</h2><p>SubPulse requests read-only balance access through Stripe. It cannot move money.</p><button id="go">Continue with Stripe</button><p id="msg"></p></main>
<script>
const stripe = Stripe(${esc(publishableKey)});
const back = ${esc(s.returnUrl)};
document.getElementById('go').onclick = async () => {
  const r = await stripe.collectFinancialConnectionsAccounts({ clientSecret: ${esc(s.clientSecret)} });
  const n = (r.financialConnectionsSession && r.financialConnectionsSession.accounts || []).length;
  document.getElementById('msg').textContent = r.error ? r.error.message : (n + ' account(s) linked. Returning to SubPulse…');
  setTimeout(() => { location.href = back + '?linked=' + n; }, 800);
};
</script></body></html>`);
  });

  r.post('/refresh', userAuth(verify), async (req, res) => {
    if (needStripe(res)) return;
    const user = (req as any).user as { uid: string };
    try {
      const customer = await store.getStripeCustomer(user.uid);
      if (!customer) {
        res.json({ updated: 0 });
        return;
      }
      const accounts = await stripe!.financialConnections.accounts.list({ account_holder: { customer }, limit: 50 });
      let updated = 0;
      for (const acct of accounts.data) {
        if (acct.status !== 'active') continue;
        let a = acct;
        try {
          a = await stripe!.financialConnections.accounts.refresh(acct.id, { features: ['balance'] });
        } catch {
          /* refresh may be rate limited; use the last known balance */
        }
        const bal = a.balance;
        if (!bal) continue;
        const currency = Object.keys(bal.current ?? {})[0] ?? 'usd';
        const available = bal.cash?.available?.[currency] ?? bal.current?.[currency];
        if (available === undefined) continue;
        await store.upsertBalance(user.uid, `stripe_${a.id}`, {
          name: a.display_name ?? a.subcategory ?? 'Bank account',
          institution: a.institution_name,
          last4: a.last4 ?? undefined,
          available: available / 100,
          current: (bal.current?.[currency] ?? available) / 100,
          currency: currency.toUpperCase(),
          source: 'stripe',
          updatedAt: nowISO(),
        });
        updated++;
      }
      res.json({ updated });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? 'Stripe refresh failed' });
    }
  });

  return r;
}
