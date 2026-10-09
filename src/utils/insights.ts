import { BillingCycle, Subscription } from '../types';
import { normalizeToMonthlyCost, todayLocal } from './dateHelpers';
import { CatalogService, getCatalogService, matchCatalogByName, OverlapGroup } from '../data/catalog';

/**
 * Groups subscriptions that share the same name (trimmed, case-insensitive).
 * Only returns groups with 2+ members — these are possible duplicates
 * (e.g. accidentally added twice, or a forgotten free-trial-turned-real one).
 * Deliberately exact-match only (no fuzzy matching) to avoid false positives
 * like "Disney+" vs "Disney+ Bundle" being incorrectly flagged as the same.
 */
export function findDuplicateSubscriptions(subs: Subscription[]): Subscription[][] {
  const groups: Record<string, Subscription[]> = {};
  for (const sub of subs) {
    const key = sub.name.trim().toLowerCase();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  }
  return Object.values(groups).filter((group) => group.length > 1);
}

export interface RealSavingsOpportunity {
  subscription: Subscription;
  cheaperCycle: BillingCycle;
  annualSavings: number;
}

/**
 * Compares a subscription's current annualized cost against any alternate-
 * cycle prices the user has actually entered (Subscription.alternatePrices),
 * and returns the cheapest real alternative found, if it's genuinely
 * cheaper. Unlike findYearlySavingsCandidates, this uses real user-provided
 * numbers, so — and only so — it's safe to state a specific dollar amount.
 */
export function findRealSavingsOpportunities(subs: Subscription[]): RealSavingsOpportunity[] {
  const results: RealSavingsOpportunity[] = [];

  for (const sub of subs) {
    if (!sub.alternatePrices || sub.billingCycle === 'once') continue;
    const currentAnnual = normalizeToMonthlyCost(sub.cost, sub.billingCycle) * 12;

    let best: { cycle: BillingCycle; annual: number } | null = null;
    for (const cycle of Object.keys(sub.alternatePrices) as BillingCycle[]) {
      if (cycle === sub.billingCycle || cycle === 'once') continue; // a one-time price is not a recurring alternative
      const price = sub.alternatePrices[cycle];
      if (price === undefined) continue;
      const annual = normalizeToMonthlyCost(price, cycle) * 12;
      if (annual < currentAnnual && (!best || annual < best.annual)) {
        best = { cycle, annual };
      }
    }

    if (best) {
      results.push({
        subscription: sub,
        cheaperCycle: best.cycle,
        annualSavings: Math.round((currentAnnual - best.annual) * 100) / 100,
      });
    }
  }

  return results.sort((a, b) => b.annualSavings - a.annualSavings);
}

/**
 * Returns non-yearly subscriptions (weekly/monthly/quarterly), sorted by
 * their annualized cost descending. These are "worth checking for an
 * annual plan" candidates, not a promise of savings — we don't know the
 * actual annual price a provider offers unless the user entered one (see
 * findRealSavingsOpportunities, which is used instead when that data
 * exists). Subscriptions with a real computed opportunity are excluded
 * here to avoid showing the same subscription twice with conflicting
 * levels of confidence.
 */
export function findYearlySavingsCandidates(subs: Subscription[], limit = 5): Subscription[] {
  const hasRealOpportunity = new Set(findRealSavingsOpportunities(subs).map((r) => r.subscription.id));
  return subs
    .filter((sub) => sub.billingCycle !== 'yearly' && sub.billingCycle !== 'once' && !hasRealOpportunity.has(sub.id))
    .sort((a, b) => normalizeToMonthlyCost(b.cost, b.billingCycle) - normalizeToMonthlyCost(a.cost, a.billingCycle))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// SubPulse savings optimizer
// ---------------------------------------------------------------------------


export type SavingsType = 'duplicate' | 'overlap' | 'bundle' | 'annual-switch' | 'promotion';
/**
 * exact      = computed only from numbers the user entered
 * list-price = relies on the catalog's typical list price (verify before acting)
 * estimate   = a percentage/heuristic (promotions)
 */
export type SavingsConfidence = 'exact' | 'list-price' | 'estimate';

export interface SavingsOpportunity {
  id: string;
  type: SavingsType;
  title: string;
  detail: string;
  annualSavings: number;
  confidence: SavingsConfidence;
  /** Items this opportunity is about; the first is the one to act on. */
  itemIds: string[];
  /** Suggested action for the UI / agents. */
  action: 'cancel' | 'switch-yearly' | 'apply-promo' | 'review';
  promoCode?: string;
  url?: string;
}

export interface Promotion {
  id: string;
  catalogId: string;
  title: string;
  /** 0..100 */
  discountPct?: number;
  code?: string;
  /** ISO date */
  expires?: string;
  url?: string;
}

function isActive(s: Subscription): boolean {
  return !s.status || s.status === 'active';
}

const annual = (s: Subscription) => Math.round(normalizeToMonthlyCost(s.cost, s.billingCycle) * 12 * 100) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The catalog entry an item is linked to, or the best name match for legacy/imported items. */
export function catalogFor(sub: Subscription): CatalogService | undefined {
  return getCatalogService(sub.catalogId) ?? matchCatalogByName(sub.name);
}

const OVERLAP_LABEL: Record<OverlapGroup, string> = {
  'video-streaming': 'video streaming services',
  music: 'music services',
  'cloud-storage': 'cloud storage plans',
  'ai-assistant': 'AI assistants',
  'password-manager': 'password managers',
  vpn: 'VPNs',
  audiobooks: 'book / audiobook services',
  meditation: 'meditation apps',
  delivery: 'delivery memberships',
  'office-suite': 'office suites',
  'warehouse-club': 'warehouse clubs',
  'live-tv': 'live TV services',
};

/**
 * Builds the full savings report. Each item is counted at most once in
 * `totalAnnual` (at its single largest opportunity) so overlapping
 * suggestions never inflate the headline number.
 */
export function buildSavingsReport(
  subs: Subscription[],
  promotions: Promotion[] = [],
  today: Date = todayLocal()
): { opportunities: SavingsOpportunity[]; totalAnnual: number } {
  const active = subs.filter(isActive);
  const opps: SavingsOpportunity[] = [];

  // 1. Exact duplicates (same name) and same-catalog duplicates.
  const dupKey = (s: Subscription) => catalogFor(s)?.id ?? `name:${s.name.trim().toLowerCase()}`;
  const groups = new Map<string, Subscription[]>();
  for (const s of active) {
    const k = dupKey(s);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    // Templates like "Electricity" or "Rent" legitimately repeat (two properties); skip non-subscription kinds.
    if (group.some((g) => g.kind && !['subscription', 'membership', 'magazine'].includes(g.kind))) continue;
    const sorted = [...group].sort((a, b) => annual(a) - annual(b));
    const extras = sorted.slice(0, -1); // keep the most expensive (usually the "real" plan)
    opps.push({
      id: `dup:${key}`,
      type: 'duplicate',
      title: `Duplicate: ${group[0].name}`,
      detail: `You track ${group.length} entries for ${group[0].name}. If one is a leftover trial or a second account, cancelling it saves the amount shown.`,
      annualSavings: round2(extras.reduce((sum, s) => sum + annual(s), 0)),
      confidence: 'exact',
      itemIds: extras.map((s) => s.id),
      action: 'cancel',
    });
  }

  // 2. Bundles that already include a separately paid service.
  for (const bundleItem of active) {
    const bundle = catalogFor(bundleItem);
    if (!bundle?.includes?.length) continue;
    for (const other of active) {
      if (other.id === bundleItem.id) continue;
      const svc = catalogFor(other);
      if (svc && bundle.includes.includes(svc.id)) {
        opps.push({
          id: `bundle:${bundleItem.id}:${other.id}`,
          type: 'bundle',
          title: `${other.name} is already in ${bundleItem.name}`,
          detail: `${bundle.name} includes ${svc.name}. You're paying for it twice.`,
          annualSavings: annual(other),
          confidence: 'exact',
          itemIds: [other.id, bundleItem.id],
          action: 'cancel',
        });
      }
    }
  }

  // 3. Overlapping services in the same group (e.g. Spotify + Apple Music).
  const byOverlap = new Map<OverlapGroup, Subscription[]>();
  for (const s of active) {
    const g = catalogFor(s)?.overlap;
    if (g) byOverlap.set(g, [...(byOverlap.get(g) ?? []), s]);
  }
  for (const [group, items] of byOverlap) {
    const distinct = new Set(items.map((i) => catalogFor(i)?.id));
    if (distinct.size < 2) continue; // same service twice is a duplicate, handled above
    const threshold = group === 'video-streaming' ? 3 : 2; // two streaming services is normal; three is worth a look
    if (distinct.size < threshold) continue;
    const sorted = [...items].sort((a, b) => annual(b) - annual(a));
    const keep = sorted[0];
    const drop = sorted.slice(1);
    opps.push({
      id: `overlap:${group}`,
      type: 'overlap',
      title: `${distinct.size} ${OVERLAP_LABEL[group]}`,
      detail: `${items.map((i) => i.name).join(', ')} do largely the same job. Keeping only ${keep.name} would save the amount shown; rotating them month to month works too.`,
      annualSavings: round2(drop.reduce((sum, s) => sum + annual(s), 0)),
      confidence: 'exact',
      itemIds: drop.map((d) => d.id).concat(keep.id),
      action: 'review',
    });
  }

  // 4. Annual switch using real user-entered alternate prices.
  const realSwitch = new Set<string>();
  for (const r of findRealSavingsOpportunities(active)) {
    realSwitch.add(r.subscription.id);
    opps.push({
      id: `switch:${r.subscription.id}`,
      type: 'annual-switch',
      title: `Switch ${r.subscription.name} to ${r.cheaperCycle}`,
      detail: `Based on the ${r.cheaperCycle} price you entered.`,
      annualSavings: r.annualSavings,
      confidence: 'exact',
      itemIds: [r.subscription.id],
      action: 'switch-yearly',
    });
  }

  // 5. Annual switch using catalog list prices (when the user's price matches a known monthly plan).
  for (const s of active) {
    if (realSwitch.has(s.id) || s.billingCycle !== 'monthly') continue;
    const svc = catalogFor(s);
    const plan = svc?.plans.find((p) => p.monthly !== undefined && p.yearly !== undefined && Math.abs(p.monthly - s.cost) < 0.02);
    if (!svc || !plan || plan.yearly === undefined) continue;
    const saving = round2(s.cost * 12 - plan.yearly);
    if (saving <= 0) continue;
    opps.push({
      id: `switch-list:${s.id}`,
      type: 'annual-switch',
      title: `${s.name}: annual plan`,
      detail: `${svc.name} ${plan.label} lists at ${plan.yearly.toFixed(2)}/yr vs ${(s.cost * 12).toFixed(2)} paying monthly (${Math.round((saving / (s.cost * 12)) * 100)}% less). List price — confirm on the provider's site.`,
      annualSavings: saving,
      confidence: 'list-price',
      itemIds: [s.id],
      action: 'switch-yearly',
    });
  }

  // 6. Promotions / sales for services the user has.
  const todayISO = today.toISOString().slice(0, 10);
  for (const promo of promotions) {
    if (promo.expires && promo.expires < todayISO) continue;
    for (const s of active) {
      if (catalogFor(s)?.id !== promo.catalogId) continue;
      const pct = promo.discountPct ?? 0;
      opps.push({
        id: `promo:${promo.id}:${s.id}`,
        type: 'promotion',
        title: promo.title,
        detail: `${s.name}${pct ? `: ${pct}% off` : ''}${promo.expires ? `, ends ${promo.expires}` : ''}${promo.code ? `. Code ${promo.code}` : ''}.`,
        annualSavings: round2((annual(s) * pct) / 100),
        confidence: 'estimate',
        itemIds: [s.id],
        action: 'apply-promo',
        promoCode: promo.code,
        url: promo.url,
      });
    }
  }

  opps.sort((a, b) => b.annualSavings - a.annualSavings);

  // Headline total: each item counted once at its best opportunity.
  const bestPerItem = new Map<string, number>();
  for (const o of opps) {
    if (o.type === 'overlap') {
      // overlap lists drop-items first and the kept item last; attribute savings per dropped item
      for (const id of o.itemIds.slice(0, -1)) {
        const item = active.find((s) => s.id === id);
        if (item) bestPerItem.set(id, Math.max(bestPerItem.get(id) ?? 0, annual(item)));
      }
    } else if (o.type === 'duplicate') {
      for (const id of o.itemIds) {
        const item = active.find((s) => s.id === id);
        if (item) bestPerItem.set(id, Math.max(bestPerItem.get(id) ?? 0, annual(item)));
      }
    } else {
      const id = o.itemIds[0];
      bestPerItem.set(id, Math.max(bestPerItem.get(id) ?? 0, o.annualSavings));
    }
  }
  const totalAnnual = round2([...bestPerItem.values()].reduce((a, b) => a + b, 0));
  return { opportunities: opps, totalAnnual };
}
