import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app';
import { MemoryStore } from '../src/memoryStore';
import { sha256 } from '../src/auth';
import { todayLocal } from '../../src/utils/dateHelpers';

const store = new MemoryStore();
let server: Server;
let base = '';
const today = todayLocal();
const iso = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);

const FULL = 'sp_live_full_access_token';
const READONLY = 'sp_live_read_only_token';
const OTHER = 'sp_live_other_user_token';

async function connect(token: string) {
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  return client;
}
const parse = (r: any) => JSON.parse(r.content[0].text);

before(async () => {
  store.tokens.set(sha256(FULL), { ownerId: 'u1', label: 'Claude', scopes: ['read', 'write', 'payments', 'cancel'] });
  store.tokens.set(sha256(READONLY), { ownerId: 'u1', label: 'Reader', scopes: ['read'] });
  store.tokens.set(sha256(OTHER), { ownerId: 'u2', label: 'Other', scopes: ['read', 'write', 'payments', 'cancel'] });
  await store.addItem('u1', { name: 'Apartment Lease', cost: 1200, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(-4), reminderDaysBefore: 3, kind: 'lease' });
  await store.addItem('u1', { name: 'Spotify Premium', cost: 11.99, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(10), reminderDaysBefore: 3 });
  await store.addItem('u1', { name: 'Apple Music', cost: 10.99, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(15), reminderDaysBefore: 3 });
  await store.addItem('u2', { name: 'Secret Other User Bill', cost: 5, currency: 'USD', billingCycle: 'monthly', nextRenewalDate: iso(3), reminderDaysBefore: 3 });
  const app = createApp({ store, verifyIdToken: async () => ({ uid: 'u1' }), adminToken: 'admin-secret' });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('health endpoint', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal((await r.json()).ok, true);
});

test('rejects missing and unknown tokens', async () => {
  const r1 = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r1.status, 401);
  const r2 = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sp_live_nope' }, body: '{}' });
  assert.equal(r2.status, 401);
});

test('tool list follows token scopes', async () => {
  const full = await connect(FULL);
  const names = (await full.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['add_item', 'add_note', 'export_csv', 'get_cashflow', 'get_item', 'get_savings_report', 'list_contacts', 'list_due', 'list_items', 'list_notes', 'record_payment', 'search_catalog', 'set_item_status', 'update_item']);
  const ro = await connect(READONLY);
  const roNames = (await ro.listTools()).tools.map((t) => t.name);
  assert.ok(!roNames.includes('record_payment') && !roNames.includes('add_item'));
  await full.close();
  await ro.close();
});

test('list_items sees only the owner\'s data with computed due state', async () => {
  const c = await connect(FULL);
  const r = parse(await c.callTool({ name: 'list_items', arguments: {} }));
  assert.equal(r.count, 3);
  assert.ok(!JSON.stringify(r).includes('Secret Other User Bill'));
  const lease = r.items.find((i: any) => i.name === 'Apartment Lease');
  assert.equal(lease.dueState, 'overdue');
  assert.equal(lease.daysOverdue, 4);
  assert.equal(lease.escalationLevel, 2);
  await c.close();
});

test('record_payment settles the overdue lease and advances it one cycle', async () => {
  const c = await connect(FULL);
  const lease = parse(await c.callTool({ name: 'list_items', arguments: { kind: 'lease' } })).items[0];
  const r = parse(await c.callTool({ name: 'record_payment', arguments: { id: lease.id, method: 'bank transfer' } }));
  assert.equal(r.payment.amount, 1200);
  assert.equal(r.payment.dueDate, iso(-4));
  assert.notEqual(r.item.dueState, 'overdue');
  assert.equal(store.payments.size, 1);
  await c.close();
});

test('savings report finds the music overlap', async () => {
  const c = await connect(FULL);
  const r = parse(await c.callTool({ name: 'get_savings_report', arguments: {} }));
  const overlap = r.opportunities.find((o: any) => o.type === 'overlap');
  assert.ok(overlap, 'expected an overlap opportunity');
  assert.equal(overlap.annualSavings, 131.88);
  await c.close();
});

test('add_item, update_item, add_note, set_item_status round-trip', async () => {
  const c = await connect(FULL);
  const created = parse(await c.callTool({ name: 'add_item', arguments: { name: 'City Water', amount: 84.5, cycle: 'monthly', dueDate: iso(9), kind: 'utility' } })).created;
  assert.equal(created.autoPay, false);
  const updated = parse(await c.callTool({ name: 'update_item', arguments: { id: created.id, amount: 90 } })).updated;
  assert.equal(updated.amount, 90);
  const note = parse(await c.callTool({ name: 'add_note', arguments: { title: 'Meter', body: 'Read on the 5th', itemId: created.id } })).created;
  assert.equal(note.itemId, created.id);
  const cancelled = parse(await c.callTool({ name: 'set_item_status', arguments: { id: created.id, status: 'cancelled' } })).updated;
  assert.equal(cancelled.status, 'cancelled');
  await c.close();
});

test('cannot touch another user\'s item by id', async () => {
  const other = [...store.items.values()].find((i) => i.ownerId === 'u2')!;
  const c = await connect(FULL);
  const r: any = await c.callTool({ name: 'record_payment', arguments: { id: other.id } });
  assert.equal(r.isError, true);
  const g: any = await c.callTool({ name: 'get_item', arguments: { id: other.id } });
  assert.equal(g.isError, true);
  await c.close();
});

test('invalid arguments are rejected by schema', async () => {
  const c = await connect(FULL);
  const r: any = await c.callTool({ name: 'add_item', arguments: { name: 'X', amount: 5, dueDate: 'next tuesday' } }).catch((e) => ({ isError: true, e }));
  assert.equal(r.isError, true);
  await c.close();
});

test('agent activity is logged', () => {
  assert.ok(store.activity.some((a) => a.tool === 'record_payment' && a.ok && a.label === 'Claude'));
});

test('promotions admin endpoint feeds the optimizer', async () => {
  const bad = await fetch(`${base}/admin/promotions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 401);
  const ok = await fetch(`${base}/admin/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-secret' },
    body: JSON.stringify([{ id: 'spot-fall', catalogId: 'spotify', title: 'Spotify 3 months 50% off', discountPct: 50, expires: iso(30) }]),
  });
  assert.equal(ok.status, 200);
  const c = await connect(FULL);
  const r = parse(await c.callTool({ name: 'get_savings_report', arguments: {} }));
  assert.ok(r.opportunities.some((o: any) => o.type === 'promotion'));
  await c.close();
});

test('stripe routes report not-configured cleanly', async () => {
  const r = await fetch(`${base}/stripe/link-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer firebase-id-token' }, body: '{}' });
  assert.equal(r.status, 503);
});
