import express from 'express';
import type Stripe from 'stripe';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Store } from './store';
import { agentAuth, IdTokenVerifier } from './auth';
import { AgentContext, buildMcpServer, SERVER_VERSION } from './mcp';
import { stripeRouter } from './stripe';
import type { Promotion } from '../../src/utils/insights';

export interface AppOptions {
  store: Store;
  verifyIdToken: IdTokenVerifier;
  stripe?: Stripe | null;
  stripePublishableKey?: string;
  publicUrl?: string;
  adminToken?: string;
}

export function createApp(o: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // Minimal CORS so browser-based MCP inspectors can connect.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'subpulse-gateway', version: SERVER_VERSION, stripe: !!o.stripe });
  });

  // ---- MCP (stateless Streamable HTTP) ----
  app.post('/mcp', express.json({ limit: '1mb' }), agentAuth(o.store), async (req, res) => {
    const ctx = (req as any).agent as AgentContext;
    const server = buildMcpServer(o.store, ctx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: e?.message ?? 'Internal error' }, id: null });
    }
  });
  const notAllowed = (_req: express.Request, res: express.Response) =>
    res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server: use POST)' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);

  // ---- Stripe ----
  app.use(
    '/stripe',
    stripeRouter({
      store: o.store,
      stripe: o.stripe ?? null,
      publishableKey: o.stripePublishableKey ?? '',
      publicUrl: (o.publicUrl ?? '').replace(/\/+$/, ''),
      verify: o.verifyIdToken,
    })
  );

  // ---- Promotions feed admin (sales / promo alerts) ----
  app.post('/admin/promotions', express.json(), async (req, res) => {
    if (!o.adminToken || req.headers.authorization !== `Bearer ${o.adminToken}`) return void res.status(401).json({ error: 'unauthorized' });
    const list: Promotion[] = Array.isArray(req.body) ? req.body : [req.body];
    for (const p of list) {
      if (!p?.id || !p?.catalogId || !p?.title) return void res.status(400).json({ error: 'each promotion needs id, catalogId, title' });
    }
    for (const p of list) await o.store.upsertPromotion(p);
    res.json({ upserted: list.length });
  });

  return app;
}
