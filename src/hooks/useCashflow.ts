import { useMemo } from 'react';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences } from '../context/PreferencesContext';
import { summarizeMonthlySpend, todayLocal } from '../utils/dateHelpers';
import { chargesInWindow, getDueInfo, statusOf } from '../utils/billing';
import { convert, totalInBase } from '../utils/forex';
import { buildSavingsReport } from '../utils/insights';
import { Subscription } from '../types';

/** Everything the dashboard/optimizer need, converted into the user's base currency. */
export function useCashflow() {
  const { subscriptions, balances, promotions } = useSubscriptions();
  const { baseCurrency, rates } = usePreferences();

  return useMemo(() => {
    const today = todayLocal();
    const summary = summarizeMonthlySpend(subscriptions);
    const burn = totalInBase(summary.byCurrency, baseCurrency, rates);
    const toBase = (amount: number, currency: string) => convert(amount, currency, baseCurrency, rates) ?? amount;

    const active = subscriptions.filter((s) => statusOf(s) === 'active');
    const next30 = chargesInWindow(active, 30, today);
    const oneOff30 = next30.filter((c) => c.item.billingCycle === 'once').reduce((sum, c) => sum + toBase(c.amount, c.currency), 0);
    const outflow30 = next30.reduce((sum, c) => sum + toBase(c.amount, c.currency), 0);

    // 4 weekly buckets for the forecast bar chart.
    const weeks = [0, 0, 0, 0, 0];
    for (const c of next30) {
      const d = Math.max(0, Math.round((Date.parse(c.dateISO) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000));
      weeks[Math.min(4, Math.floor(d / 7))] += toBase(c.amount, c.currency);
    }

    const withDue = active.map((s) => ({ item: s, due: getDueInfo(s, today) }));
    const overdue = withDue
      .filter((x) => x.due.state === 'overdue')
      .sort((a, b) => b.due.escalationLevel - a.due.escalationLevel || b.due.daysOverdue - a.due.daysOverdue);
    const dueSoon = withDue.filter((x) => x.due.state === 'due-today' || x.due.state === 'upcoming').sort((a, b) => a.due.days - b.due.days);

    const balanceTotal = balances.reduce((sum, b) => sum + toBase(b.available, b.currency), 0);
    const stripeLinked = balances.some((b) => b.source === 'stripe');
    const lastBalanceSync = balances.reduce((m, b) => (b.updatedAt > m ? b.updatedAt : m), '');

    const savings = buildSavingsReport(subscriptions, promotions, today);
    const contracts = active.filter((s: Subscription) => s.kind && !['subscription', 'magazine', 'membership'].includes(s.kind)).length;

    return {
      baseCurrency,
      burnMonthly: burn.total,
      burnAnnual: Math.round(burn.total * 12 * 100) / 100,
      unconverted: burn.unconverted,
      activeCount: summary.subscriptionCount,
      contracts,
      oneOff30,
      outflow30,
      weeks,
      overdue,
      dueSoon,
      balanceTotal,
      stripeLinked,
      lastBalanceSync,
      runwayAfter30: balanceTotal - outflow30,
      savings,
      byCategory: summary.byCategory,
      toBase,
    };
  }, [subscriptions, balances, promotions, baseCurrency, rates]);
}
