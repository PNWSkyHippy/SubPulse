import * as Crypto from 'expo-crypto';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

/**
 * Client side of the SubPulse gateway (see /server): agent tokens for the
 * MCP endpoint, and the Stripe Financial Connections link/refresh calls.
 *
 * Tokens: generated on the device, shown to the user once, and only their
 * SHA-256 hash is stored (doc id in `mcpTokens`). The server hashes the
 * bearer token on each request and looks up the owner + scopes.
 */

export type McpScope = 'read' | 'write' | 'payments' | 'cancel';

export const SCOPE_INFO: Record<McpScope, { title: string; detail: string }> = {
  read: { title: 'Query recurring balances & due dates', detail: 'List items, payments, notes, savings, cash-flow.' },
  write: { title: 'Add & edit entries and notes', detail: 'Create items, update amounts/dates, attach notes.' },
  payments: { title: 'Record payments', detail: 'Mark bills paid (advances the due date).' },
  cancel: { title: 'Pause / cancel tracking', detail: 'Change an item status to paused or cancelled.' },
};

export interface McpTokenRecord {
  id: string; // sha256 hash
  label: string;
  scopes: McpScope[];
  createdAt: string;
  last4: string;
  ownerId: string;
}

function base64url(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += chars[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += chars[n & 63];
  }
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX });
}

/** Creates a token, stores its hash, and returns the plaintext (show once, never stored). */
export async function createMcpToken(label: string, scopes: McpScope[]): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in first');
  const token = 'sp_live_' + base64url(Crypto.getRandomBytes(32));
  const hash = await sha256Hex(token);
  await setDoc(doc(db, 'mcpTokens', hash), {
    ownerId: uid,
    label: label.trim() || 'Agent',
    scopes,
    createdAt: new Date().toISOString(),
    last4: token.slice(-4),
  });
  return token;
}

export function watchMcpTokens(cb: (rows: McpTokenRecord[]) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  return onSnapshot(query(collection(db, 'mcpTokens'), where('ownerId', '==', uid)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<McpTokenRecord, 'id'>) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  );
}

export interface McpActivity {
  id: string;
  tool: string;
  label: string;
  at: string;
  ok: boolean;
}

export function watchMcpActivity(cb: (rows: McpActivity[]) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  return onSnapshot(
    query(collection(db, 'mcpActivity'), where('ownerId', '==', uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<McpActivity, 'id'>) })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)),
    () => cb([])
  );
}

export async function revokeMcpToken(hash: string): Promise<void> {
  await deleteDoc(doc(db, 'mcpTokens', hash));
}

export const mcpEndpoint = (gatewayUrl: string) => `${gatewayUrl.replace(/\/+$/, '')}/mcp`;

/** Ready-to-paste client configuration snippets. */
export function clientConfigs(gatewayUrl: string, token: string) {
  const url = mcpEndpoint(gatewayUrl);
  return {
    claudeCode: `claude mcp add subpulse --transport http --header "Authorization: Bearer ${token}" ${url}`,
    geminiCli: JSON.stringify({ mcpServers: { subpulse: { httpUrl: url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
    generic: JSON.stringify({ mcpServers: { subpulse: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
  };
}

async function authedFetch(gatewayUrl: string, path: string, body?: unknown): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first');
  if (!gatewayUrl) throw new Error('Set the gateway URL in Settings → Agentic MCP gateway first.');
  const idToken = await user.getIdToken();
  const res = await fetch(`${gatewayUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Gateway error ${res.status}`);
  return json;
}

export async function gatewayHealth(gatewayUrl: string): Promise<{ ok: boolean; version?: string; stripe?: boolean }> {
  const res = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/health`);
  return res.json();
}

/** Starts Stripe Financial Connections: returns a hosted page URL to open in the browser. */
export async function startStripeLink(gatewayUrl: string): Promise<{ url: string }> {
  return authedFetch(gatewayUrl, '/stripe/link-session', { returnUrl: 'subpulse://stripe-linked' });
}

/** Asks the server to refresh balances for all linked accounts (writes `balances` docs). */
export async function refreshStripeBalances(gatewayUrl: string): Promise<{ updated: number }> {
  return authedFetch(gatewayUrl, '/stripe/refresh');
}
