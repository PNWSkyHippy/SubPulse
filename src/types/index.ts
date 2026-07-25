export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  cost: number; // cost per billing cycle, in the user's currency (stored as a number, e.g. 9.99)
  currency: string; // e.g. 'USD'
  billingCycle: BillingCycle;
  nextRenewalDate: string; // ISO date string (yyyy-mm-dd) of the next upcoming charge
  reminderDaysBefore: number; // how many days before renewal to notify, e.g. 3
  category?: string; // e.g. 'Streaming', 'Software', 'Fitness'
  notes?: string;
  createdAt: string; // ISO timestamp
  ownerId: string; // Firebase Auth uid, for Firestore security rules
}

export interface MonthlySpendSummary {
  totalMonthly: number;
  byCategory: Record<string, number>;
  byCurrency: Record<string, number>;
  subscriptionCount: number;
}
