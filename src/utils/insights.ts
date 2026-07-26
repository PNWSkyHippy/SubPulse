import { Subscription } from '../types';
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

/**
 * Returns non-yearly subscriptions (weekly/monthly), sorted by their
 * annualized cost descending. These are "worth checking for an annual
 * plan" candidates, not a promise of savings — we don't know the actual
 * annual price a provider offers, so we never claim a specific dollar
 * amount saved, only surface which subscriptions cost the most per year
 * at their current (non-annual) rate.
 */
export function findYearlySavingsCandidates(subs: Subscription[], limit = 5): Subscription[] {
  return subs
    .filter((sub) => sub.billingCycle !== 'yearly')
    .sort((a, b) => normalizeToMonthlyCost(b.cost, b.billingCycle) - normalizeToMonthlyCost(a.cost, a.billingCycle))
    .slice(0, limit);
}
