import { BillingCycle, Subscription } from '../types';
import { normalizeToMonthlyCost } from './dateHelpers';

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
    if (!sub.alternatePrices) continue;
    const currentAnnual = normalizeToMonthlyCost(sub.cost, sub.billingCycle) * 12;

    let best: { cycle: BillingCycle; annual: number } | null = null;
    for (const cycle of Object.keys(sub.alternatePrices) as BillingCycle[]) {
      if (cycle === sub.billingCycle) continue;
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
    .filter((sub) => sub.billingCycle !== 'yearly' && !hasRealOpportunity.has(sub.id))
    .sort((a, b) => normalizeToMonthlyCost(b.cost, b.billingCycle) - normalizeToMonthlyCost(a.cost, a.billingCycle))
    .slice(0, limit);
}
