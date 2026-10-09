import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Store } from './store';
import type { AgentContext } from './mcp';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function bearer(req: Request): string | null {
  const h = req.headers.authorization ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Agent auth for /mcp: the bearer token is hashed and looked up in mcpTokens. */
export function agentAuth(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token || !token.startsWith('sp_')) {
      res.status(401).set('WWW-Authenticate', 'Bearer').json({ jsonrpc: '2.0', error: { code: -32001, message: 'Missing or invalid SubPulse agent token' }, id: null });
      return;
    }
    const rec = await store.lookupToken(sha256(token)).catch(() => null);
    if (!rec) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unknown or revoked token' }, id: null });
      return;
    }
    (req as any).agent = { uid: rec.ownerId, label: rec.label, scopes: rec.scopes } satisfies AgentContext;
    next();
  };
}

export type IdTokenVerifier = (idToken: string) => Promise<{ uid: string; email?: string }>;

/** App-user auth for /stripe/*: a Firebase ID token from the signed-in app. */
export function userAuth(verify: IdTokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    try {
      (req as any).user = await verify(token);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
    }
  };
}
