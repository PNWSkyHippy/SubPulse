import { Subscription } from '../types';
import { normalizeToMonthlyCost } from '../utils/dateHelpers';
export { getDueInfo, statusOf } from '../utils/billing';

export const normalizeCycleCost = (s: Subscription) => (s.billingCycle === 'once' ? s.cost : normalizeToMonthlyCost(s.cost, s.billingCycle));
