import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Subscription } from '../../src/types';
import { ALL_BILLING_CYCLES, ALL_ITEM_KINDS } from '../../src/types';
import { applyPayment, chargesInWindow, getDueInfo, isAutoPay, kindOf, statusOf } from '../../src/utils/billing';
import { normalizeToMonthlyCost, summarizeMonthlySpend, formatISODate, todayLocal } from '../../src/utils/dateHelpers';
import { buildSavingsReport, catalogFor } from '../../src/utils/insights';
import { generateSubscriptionsCSV } from '../../src/utils/csv';
import { searchCatalog } from '../../src/data/catalog';
import { Store } from './store';

export const SERVER_VERSION = '1.0.0';

export interface AgentContext {
  uid: string;
  label: string;
  scopes: string[];
}

type Scope = 'read' | 'write' | 'payments' | 'cancel';

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

/** Compact, agent-friendly view of an item with computed due status. */
export function describeItem(s: Subscription, today = todayLocal()) {
  const due = getDueInfo(s, today);
  return {
    id: s.id,
    name: s.name,
    kind: kindOf(s),
    status: statusOf(s),
    amount: s.cost,
    currency: s.currency,
    cycle: s.billingCycle,
    monthlyEquivalent: Math.round(normalizeToMonthlyCost(s.cost, s.billingCycle) * 100) / 100,
    autoPay: isAutoPay(s),
    dueDate: due.dueDateISO,
    dueState: due.state,
    daysUntilDue: due.days,
    ...(due.state === 'overdue' ? { daysOverdue: due.daysOverdue, escalationLevel: due.escalationLevel, amountOutstanding: due.amountDue, unpaidCycles: due.unpaidCycles } : {}),
    category: s.category,
    catalogService: catalogFor(s)?.name,
    lastPaidDate: s.lastPaidDate,
    notes: s.notes,
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/**
 * Builds an MCP server bound to one user and one token's scopes. A fresh
 * instance is created per HTTP request (stateless Streamable HTTP), so there
 * is no cross-user state in memory.
 */
export function buildMcpServer(store: Store, ctx: AgentContext): McpServer {
  const server = new McpServer(
    { name: 'subpulse', version: SERVER_VERSION },
    {
      instructions:
        'SubPulse tracks the user\'s recurring bills (subscriptions, leases, utilities, loans, one-time fees). ' +
        'Amounts are per billing cycle in the item currency; use monthlyEquivalent to compare. ' +
        'Manual-pay items become overdue and escalate until record_payment is called. ' +
        'Always confirm with the user before recording payments or cancelling. Never invent amounts.',
    }
  );
  const can = (s: Scope) => ctx.scopes.includes(s);
  const uid = ctx.uid;

  const tool = <S extends z.ZodRawShape>(
    name: string,
    scope: Scope,
    config: { title: string; description: string; inputSchema: S; readOnly?: boolean; destructive?: boolean },
    handler: (args: z.infer<z.ZodObject<S>>) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>
  ) => {
    if (!can(scope)) return; // tools outside the token's scopes are not even listed
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: config.inputSchema,
        annotations: { readOnlyHint: !!config.readOnly, destructiveHint: !!config.destructive, openWorldHint: false },
      },
      (async (args: any) => {
        let ok = true;
        try {
          const r = await handler(args);
          ok = !('isError' in r && r.isError);
          return r;
        } catch (e: any) {
          ok = false;
          return fail(e?.message ?? 'Unexpected error');
        } finally {
          store.logActivity({ ownerId: uid, label: ctx.label, tool: name, ok, at: new Date().toISOString() }).catch(() => {});
        }
      }) as any
    );
  };

  // ---------------- read ----------------
  tool(
    'list_items',
    'read',
    {
      title: 'List tracked bills',
      description: 'List the user\'s recurring bills and one-time fees with due status. Filter by status, kind or a text search.',
      inputSchema: {
        status: z.enum(['active', 'paused', 'cancelled', 'completed', 'all']).optional().describe('Default: active'),
        kind: z.enum(ALL_ITEM_KINDS as [string, ...string[]]).optional(),
        search: z.string().optional(),
      },
      readOnly: true,
    },
    async ({ status = 'active', kind, search }) => {
      const items = await store.listItems(uid);
      const q = search?.toLowerCase();
      const rows = items
        .filter((s) => status === 'all' || statusOf(s) === status)
        .filter((s) => !kind || kindOf(s) === kind)
        .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q))
        .map((s) => describeItem(s))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return json({ count: rows.length, items: rows });
    }
  );

  tool(
    'get_item',
    'read',
    { title: 'Get bill details', description: 'Full details for one item, including payment history and attached notes.', inputSchema: { id: z.string() }, readOnly: true },
    async ({ id }) => {
      const item = await store.getItem(uid, id);
      if (!item) return fail(`No item with id ${id}`);
      const [payments, notes] = await Promise.all([store.listPayments(uid), store.listNotes(uid)]);
      return json({
        ...describeItem(item),
        alternatePrices: item.alternatePrices,
        payments: payments.filter((p) => p.itemId === id).sort((a, b) => b.paidDate.localeCompare(a.paidDate)).slice(0, 24),
        notes: notes.filter((n) => n.itemId === id).map((n) => ({ id: n.id, title: n.title, body: n.body, tags: n.tags, updatedAt: n.updatedAt })),
      });
    }
  );

  tool(
    'get_cashflow',
    'read',
    {
      title: 'Cash-flow summary',
      description: 'Monthly burn per currency, upcoming charges in the next N days, overdue bills and available balances.',
      inputSchema: { days: z.number().int().min(1).max(366).optional().describe('Look-ahead window, default 30') },
      readOnly: true,
    },
    async ({ days = 30 }) => {
      const [items, balances] = await Promise.all([store.listItems(uid), store.listBalances(uid)]);
      const summary = summarizeMonthlySpend(items);
      const charges = chargesInWindow(items, days);
      const overdue = items.filter((s) => getDueInfo(s).state === 'overdue').map((s) => describeItem(s));
      const outflow: Record<string, number> = {};
      for (const c of charges) outflow[c.currency] = Math.round(((outflow[c.currency] ?? 0) + c.amount) * 100) / 100;
      return json({
        monthlyBurnByCurrency: summary.byCurrency,
        activeItems: summary.subscriptionCount,
        windowDays: days,
        expectedOutflowByCurrency: outflow,
        upcoming: charges.map((c) => ({ date: c.dateISO, id: c.item.id, name: c.item.name, amount: c.amount, currency: c.currency })),
        overdue,
        balances: balances.map((b) => ({ name: b.name, available: b.available, currency: b.currency, source: b.source, updatedAt: b.updatedAt })),
      });
    }
  );

  tool(
    'list_due',
    'read',
    {
      title: 'Bills due soon or overdue',
      description: 'Bills that are overdue or due within the next N days (default 7), most urgent first.',
      inputSchema: { days: z.number().int().min(0).max(90).optional() },
      readOnly: true,
    },
    async ({ days = 7 }) => {
      const items = await store.listItems(uid);
      const rows = items
        .map((s) => describeItem(s))
        .filter((d) => d.dueState === 'overdue' || (d.dueState !== 'inactive' && d.daysUntilDue <= days))
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      return json({ count: rows.length, items: rows });
    }
  );

  tool(
    'get_savings_report',
    'read',
    {
      title: 'Savings optimizer',
      description: 'Duplicate services, bundle double-payments, overlapping services, annual-plan savings and active promotions, ranked by annual savings. confidence=list-price means it relies on typical list prices.',
      inputSchema: {},
      readOnly: true,
    },
    async () => {
      const [items, promos] = await Promise.all([store.listItems(uid), store.listPromotions()]);
      return json(buildSavingsReport(items, promos));
    }
  );

  tool(
    'list_notes',
    'read',
    { title: 'List notes', description: 'Notes, optionally only those attached to one item.', inputSchema: { itemId: z.string().optional() }, readOnly: true },
    async ({ itemId }) => {
      const notes = (await store.listNotes(uid)).filter((n) => !itemId || n.itemId === itemId);
      return json(notes.map((n) => ({ id: n.id, itemId: n.itemId, title: n.title, body: n.body, tags: n.tags, updatedAt: n.updatedAt })));
    }
  );

  tool(
    'list_contacts',
    'read',
    { title: 'List contacts', description: 'Contacts used as payees and for bill splitting.', inputSchema: { search: z.string().optional() }, readOnly: true },
    async ({ search }) => {
      const q = search?.toLowerCase();
      const rows = (await store.listContacts(uid)).filter((c) => !q || c.name.toLowerCase().includes(q));
      return json(rows.slice(0, 200).map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })));
    }
  );

  tool(
    'search_catalog',
    'read',
    { title: 'Search known services', description: 'Search the built-in catalog of known services and their typical list prices (to pre-fill add_item).', inputSchema: { query: z.string() }, readOnly: true },
    async ({ query }) => json(searchCatalog(query, 15))
  );

  tool(
    'export_csv',
    'read',
    { title: 'Export CSV', description: 'All items as CSV text (same format as the app\'s export, re-importable).', inputSchema: {}, readOnly: true },
    async () => ({ content: [{ type: 'text' as const, text: generateSubscriptionsCSV(await store.listItems(uid)) }] })
  );

  // ---------------- write ----------------
  tool(
    'add_item',
    'write',
    {
      title: 'Add a bill',
      description: 'Track a new subscription, lease, utility, loan, insurance, magazine or one-time fee.',
      inputSchema: {
        name: z.string().min(1),
        amount: z.number().nonnegative().describe('Amount per billing cycle'),
        currency: z.string().length(3).optional().describe('ISO code, default USD'),
        cycle: z.enum(ALL_BILLING_CYCLES as [string, ...string[]]).optional().describe('Default monthly'),
        dueDate: isoDate.describe('Next due/charge date'),
        kind: z.enum(ALL_ITEM_KINDS as [string, ...string[]]).optional(),
        autoPay: z.boolean().optional().describe('Card/bank debit. Defaults by kind (subscriptions yes, leases/utilities no)'),
        reminderDaysBefore: z.number().int().min(0).max(60).optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
        catalogId: z.string().optional().describe('From search_catalog'),
      },
    },
    async (a) => {
      const created = await store.addItem(uid, {
        name: a.name.trim(),
        cost: Math.round(a.amount * 100) / 100,
        currency: (a.currency ?? 'USD').toUpperCase(),
        billingCycle: (a.cycle ?? (a.kind === 'one-time' ? 'once' : 'monthly')) as any,
        nextRenewalDate: a.dueDate,
        reminderDaysBefore: a.reminderDaysBefore ?? 3,
        kind: a.kind as any,
        autoPay: a.autoPay,
        category: a.category,
        notes: a.notes,
        catalogId: a.catalogId,
        status: 'active',
      });
      return json({ created: describeItem(created) });
    }
  );

  tool(
    'update_item',
    'write',
    {
      title: 'Update a bill',
      description: 'Change amount, cycle, due date, category, auto-pay or notes of an item. Use record_payment (not this) to mark a bill paid.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        amount: z.number().nonnegative().optional(),
        currency: z.string().length(3).optional(),
        cycle: z.enum(ALL_BILLING_CYCLES as [string, ...string[]]).optional(),
        dueDate: isoDate.optional(),
        autoPay: z.boolean().optional(),
        reminderDaysBefore: z.number().int().min(0).max(60).optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ id, amount, cycle, dueDate, ...rest }) => {
      const updates: Partial<Subscription> = { ...rest } as any;
      if (amount !== undefined) updates.cost = Math.round(amount * 100) / 100;
      if (cycle) updates.billingCycle = cycle as any;
      if (dueDate) updates.nextRenewalDate = dueDate;
      if (updates.currency) updates.currency = updates.currency.toUpperCase();
      for (const k of Object.keys(updates)) if ((updates as any)[k] === undefined) delete (updates as any)[k];
      if (!Object.keys(updates).length) return fail('Nothing to update');
      const item = await store.updateItem(uid, id, updates);
      return json({ updated: describeItem(item) });
    }
  );

  tool(
    'add_note',
    'write',
    {
      title: 'Add a note',
      description: 'Create a note, optionally attached to an item (lease clauses, cancellation steps, receipts...).',
      inputSchema: { title: z.string().min(1), body: z.string(), itemId: z.string().optional(), tags: z.array(z.string()).optional() },
    },
    async ({ title, body, itemId, tags }) => {
      if (itemId && !(await store.getItem(uid, itemId))) return fail(`No item with id ${itemId}`);
      const note = await store.addNote(uid, { title, body, itemId, tags });
      return json({ created: { id: note.id, title: note.title, itemId: note.itemId } });
    }
  );

  // ---------------- payments ----------------
  tool(
    'record_payment',
    'payments',
    {
      title: 'Record a payment',
      description: 'Mark the current due date of an item as paid. Settles exactly one cycle and advances the due date. Confirm with the user first.',
      inputSchema: {
        id: z.string(),
        amount: z.number().nonnegative().optional().describe('Defaults to the item amount'),
        paidDate: isoDate.optional().describe('Defaults to today'),
        method: z.string().optional(),
        note: z.string().optional(),
      },
    },
    async ({ id, amount, paidDate, method, note }) => {
      const item = await store.getItem(uid, id);
      if (!item) return fail(`No item with id ${id}`);
      if (statusOf(item) !== 'active') return fail(`${item.name} is ${statusOf(item)}; resume it before recording payments.`);
      const when = paidDate ? new Date(`${paidDate}T00:00:00Z`) : todayLocal();
      const { updates, settledDueDate } = applyPayment(item, when);
      const payment = await store.recordPayment(
        uid,
        { itemId: id, amount: amount ?? item.cost, currency: item.currency, paidDate: formatISODate(when), dueDate: settledDueDate, method, note },
        updates
      );
      const after = (await store.getItem(uid, id))!;
      return json({ payment, item: describeItem(after) });
    }
  );

  // ---------------- cancel ----------------
  tool(
    'set_item_status',
    'cancel',
    {
      title: 'Pause, cancel or resume tracking',
      description: 'Change an item status. This only changes tracking in SubPulse; the user must still cancel with the provider. Confirm first.',
      inputSchema: { id: z.string(), status: z.enum(['active', 'paused', 'cancelled']) },
      destructive: true,
    },
    async ({ id, status }) => {
      const item = await store.updateItem(uid, id, { status: status as any });
      const svc = catalogFor(item);
      return json({ updated: describeItem(item), providerSite: status === 'cancelled' && svc?.domain ? `https://${svc.domain}` : undefined });
    }
  );

  // A prompt that agents can offer as a one-click workflow.
  server.registerPrompt(
    'monthly_review',
    { title: 'Monthly bill review', description: 'Review overdue bills, upcoming charges and savings.' },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Use get_cashflow and get_savings_report to give me a short monthly review: anything overdue, what is due in the next two weeks, and the top 3 ways to save. Ask before changing anything.',
          },
        },
      ],
    })
  );

  return server;
}

export { ALL_ITEM_KINDS };
