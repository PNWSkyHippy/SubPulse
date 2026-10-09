import { BillingCycle, ItemKind } from '../types';

/**
 * Built-in catalog of well-known recurring services, used for one-tap
 * onboarding ("Known App") and by the savings optimizer (overlaps, bundles,
 * and list-price annual plans).
 *
 * PRICES ARE TYPICAL US LIST PRICES AS OF `CATALOG_AS_OF` AND CHANGE OFTEN.
 * They pre-fill the add form and are always editable; the user's own entered
 * price is what the app tracks. Savings that rely on catalog prices are
 * labelled "list price" in the UI so they are never presented as certain.
 *
 * No logos or brand artwork are bundled — icons are generated initials
 * (see utils/subscriptionIcon.ts).
 */
export const CATALOG_AS_OF = '2026-06';

export type OverlapGroup =
  | 'video-streaming'
  | 'music'
  | 'cloud-storage'
  | 'ai-assistant'
  | 'password-manager'
  | 'vpn'
  | 'audiobooks'
  | 'meditation'
  | 'delivery'
  | 'office-suite'
  | 'warehouse-club'
  | 'live-tv';

export interface CatalogPlan {
  label: string;
  /** Price when billed monthly. */
  monthly?: number;
  /** Price when billed yearly (total for the year). */
  yearly?: number;
}

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  kind: ItemKind;
  domain?: string;
  overlap?: OverlapGroup;
  /** Catalog ids whose service this one already includes (bundles). */
  includes?: string[];
  plans: CatalogPlan[];
}

export const CATALOG: CatalogService[] = [
  // ---- Video streaming ----
  { id: 'netflix', name: 'Netflix', category: 'Streaming', kind: 'subscription', domain: 'netflix.com', overlap: 'video-streaming', plans: [{ label: 'Standard with ads', monthly: 7.99 }, { label: 'Standard', monthly: 17.99 }, { label: 'Premium 4K', monthly: 24.99 }] },
  { id: 'disney-plus', name: 'Disney+', category: 'Streaming', kind: 'subscription', domain: 'disneyplus.com', overlap: 'video-streaming', plans: [{ label: 'Basic with ads', monthly: 9.99 }, { label: 'Premium', monthly: 15.99, yearly: 159.99 }] },
  { id: 'hulu', name: 'Hulu', category: 'Streaming', kind: 'subscription', domain: 'hulu.com', overlap: 'video-streaming', plans: [{ label: 'With ads', monthly: 9.99, yearly: 99.99 }, { label: 'No ads', monthly: 18.99 }] },
  { id: 'max', name: 'HBO Max', category: 'Streaming', kind: 'subscription', domain: 'max.com', overlap: 'video-streaming', plans: [{ label: 'Basic with ads', monthly: 9.99, yearly: 99.99 }, { label: 'Standard', monthly: 16.99, yearly: 169.99 }, { label: 'Premium', monthly: 20.99, yearly: 209.99 }] },
  { id: 'paramount-plus', name: 'Paramount+', category: 'Streaming', kind: 'subscription', domain: 'paramountplus.com', overlap: 'video-streaming', plans: [{ label: 'Essential', monthly: 7.99, yearly: 59.99 }, { label: 'Premium', monthly: 12.99, yearly: 119.99 }] },
  { id: 'peacock', name: 'Peacock', category: 'Streaming', kind: 'subscription', domain: 'peacocktv.com', overlap: 'video-streaming', plans: [{ label: 'Premium', monthly: 10.99, yearly: 109.99 }, { label: 'Premium Plus', monthly: 16.99, yearly: 169.99 }] },
  { id: 'apple-tv', name: 'Apple TV+', category: 'Streaming', kind: 'subscription', domain: 'tv.apple.com', overlap: 'video-streaming', plans: [{ label: 'Monthly', monthly: 12.99 }] },
  { id: 'prime-video', name: 'Prime Video', category: 'Streaming', kind: 'subscription', domain: 'primevideo.com', overlap: 'video-streaming', plans: [{ label: 'Standalone', monthly: 8.99 }] },
  { id: 'crunchyroll', name: 'Crunchyroll', category: 'Streaming', kind: 'subscription', domain: 'crunchyroll.com', plans: [{ label: 'Fan', monthly: 7.99, yearly: 79.99 }, { label: 'Mega Fan', monthly: 11.99, yearly: 119.99 }] },
  { id: 'espn-plus', name: 'ESPN+', category: 'Streaming', kind: 'subscription', domain: 'espn.com', plans: [{ label: 'Monthly', monthly: 11.99, yearly: 119.99 }] },
  { id: 'youtube-tv', name: 'YouTube TV', category: 'Live TV', kind: 'subscription', domain: 'tv.youtube.com', overlap: 'live-tv', plans: [{ label: 'Base plan', monthly: 82.99 }] },
  { id: 'sling', name: 'Sling TV', category: 'Live TV', kind: 'subscription', domain: 'sling.com', overlap: 'live-tv', plans: [{ label: 'Orange or Blue', monthly: 45.99 }] },

  // ---- Music & audio ----
  { id: 'spotify', name: 'Spotify Premium', category: 'Music', kind: 'subscription', domain: 'spotify.com', overlap: 'music', plans: [{ label: 'Individual', monthly: 11.99 }, { label: 'Duo', monthly: 16.99 }, { label: 'Family', monthly: 19.99 }, { label: 'Student', monthly: 5.99 }] },
  { id: 'apple-music', name: 'Apple Music', category: 'Music', kind: 'subscription', domain: 'music.apple.com', overlap: 'music', plans: [{ label: 'Individual', monthly: 10.99, yearly: 109 }, { label: 'Family', monthly: 16.99 }] },
  { id: 'youtube-music', name: 'YouTube Music', category: 'Music', kind: 'subscription', domain: 'music.youtube.com', overlap: 'music', plans: [{ label: 'Individual', monthly: 10.99 }] },
  { id: 'amazon-music', name: 'Amazon Music Unlimited', category: 'Music', kind: 'subscription', domain: 'music.amazon.com', overlap: 'music', plans: [{ label: 'Individual (Prime)', monthly: 10.99 }] },
  { id: 'tidal', name: 'TIDAL', category: 'Music', kind: 'subscription', domain: 'tidal.com', overlap: 'music', plans: [{ label: 'Individual', monthly: 10.99 }] },
  { id: 'pandora', name: 'Pandora Plus', category: 'Music', kind: 'subscription', domain: 'pandora.com', overlap: 'music', plans: [{ label: 'Plus', monthly: 4.99, yearly: 54.89 }, { label: 'Premium', monthly: 10.99 }] },
  { id: 'siriusxm', name: 'SiriusXM', category: 'Music', kind: 'subscription', domain: 'siriusxm.com', plans: [{ label: 'Music & Entertainment', monthly: 9.99 }] },
  { id: 'audible', name: 'Audible', category: 'Books', kind: 'subscription', domain: 'audible.com', overlap: 'audiobooks', plans: [{ label: 'Standard', monthly: 7.95 }, { label: 'Premium Plus', monthly: 14.95, yearly: 149.5 }] },
  { id: 'kindle-unlimited', name: 'Kindle Unlimited', category: 'Books', kind: 'subscription', domain: 'amazon.com', overlap: 'audiobooks', plans: [{ label: 'Monthly', monthly: 11.99 }] },

  // ---- Bundles ----
  { id: 'youtube-premium', name: 'YouTube Premium', category: 'Streaming', kind: 'subscription', domain: 'youtube.com', includes: ['youtube-music'], plans: [{ label: 'Individual', monthly: 13.99, yearly: 139.99 }, { label: 'Family', monthly: 22.99 }] },
  { id: 'amazon-prime', name: 'Amazon Prime', category: 'Shopping', kind: 'membership', domain: 'amazon.com', includes: ['prime-video'], plans: [{ label: 'Prime', monthly: 14.99, yearly: 139 }] },
  { id: 'apple-one', name: 'Apple One', category: 'Bundle', kind: 'subscription', domain: 'apple.com', includes: ['apple-music', 'apple-tv', 'icloud', 'apple-arcade'], plans: [{ label: 'Individual', monthly: 19.95 }, { label: 'Family', monthly: 25.95 }, { label: 'Premier', monthly: 37.95 }] },
  { id: 'disney-bundle', name: 'Disney+, Hulu, Max Bundle', category: 'Streaming', kind: 'subscription', domain: 'disneyplus.com', includes: ['disney-plus', 'hulu', 'max'], plans: [{ label: 'With ads', monthly: 16.99 }, { label: 'No ads', monthly: 29.99 }] },
  { id: 'microsoft-365', name: 'Microsoft 365', category: 'Software', kind: 'subscription', domain: 'microsoft.com', overlap: 'office-suite', includes: ['onedrive'], plans: [{ label: 'Personal', monthly: 9.99, yearly: 99.99 }, { label: 'Family', monthly: 12.99, yearly: 129.99 }] },

  // ---- Cloud storage ----
  { id: 'icloud', name: 'iCloud+', category: 'Cloud Storage', kind: 'subscription', domain: 'icloud.com', overlap: 'cloud-storage', plans: [{ label: '50 GB', monthly: 0.99 }, { label: '200 GB', monthly: 2.99 }, { label: '2 TB', monthly: 9.99 }] },
  { id: 'google-one', name: 'Google One', category: 'Cloud Storage', kind: 'subscription', domain: 'one.google.com', overlap: 'cloud-storage', plans: [{ label: '100 GB', monthly: 1.99, yearly: 19.99 }, { label: '2 TB', monthly: 9.99, yearly: 99.99 }] },
  { id: 'dropbox', name: 'Dropbox', category: 'Cloud Storage', kind: 'subscription', domain: 'dropbox.com', overlap: 'cloud-storage', plans: [{ label: 'Plus', monthly: 11.99, yearly: 119.88 }] },
  { id: 'onedrive', name: 'OneDrive Standalone', category: 'Cloud Storage', kind: 'subscription', domain: 'onedrive.com', overlap: 'cloud-storage', plans: [{ label: '100 GB', monthly: 1.99, yearly: 19.99 }] },

  // ---- AI & developer ----
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', category: 'AI', kind: 'subscription', domain: 'openai.com', overlap: 'ai-assistant', plans: [{ label: 'Plus', monthly: 20 }, { label: 'Pro', monthly: 200 }] },
  { id: 'claude', name: 'Claude', category: 'AI', kind: 'subscription', domain: 'claude.ai', overlap: 'ai-assistant', plans: [{ label: 'Pro', monthly: 20, yearly: 200 }, { label: 'Max', monthly: 100 }] },
  { id: 'google-ai-pro', name: 'Google AI Pro (Gemini)', category: 'AI', kind: 'subscription', domain: 'one.google.com', overlap: 'ai-assistant', includes: ['google-one'], plans: [{ label: 'AI Pro', monthly: 19.99 }] },
  { id: 'perplexity', name: 'Perplexity Pro', category: 'AI', kind: 'subscription', domain: 'perplexity.ai', overlap: 'ai-assistant', plans: [{ label: 'Pro', monthly: 20, yearly: 200 }] },
  { id: 'github-copilot', name: 'GitHub Copilot', category: 'Developer', kind: 'subscription', domain: 'github.com', plans: [{ label: 'Pro', monthly: 10, yearly: 100 }] },
  { id: 'cursor', name: 'Cursor', category: 'Developer', kind: 'subscription', domain: 'cursor.com', plans: [{ label: 'Pro', monthly: 20, yearly: 192 }] },

  // ---- Productivity ----
  { id: 'adobe-cc', name: 'Adobe Creative Cloud', category: 'Software', kind: 'subscription', domain: 'adobe.com', plans: [{ label: 'All Apps (monthly)', monthly: 89.99 }, { label: 'All Apps (annual, billed monthly)', monthly: 69.99 }] },
  { id: 'adobe-photo', name: 'Adobe Photography', category: 'Software', kind: 'subscription', domain: 'adobe.com', plans: [{ label: '20 GB', monthly: 19.99, yearly: 239.88 }] },
  { id: 'notion', name: 'Notion', category: 'Software', kind: 'subscription', domain: 'notion.so', plans: [{ label: 'Plus', monthly: 12, yearly: 120 }] },
  { id: 'canva', name: 'Canva Pro', category: 'Software', kind: 'subscription', domain: 'canva.com', plans: [{ label: 'Pro', monthly: 15, yearly: 120 }] },
  { id: 'grammarly', name: 'Grammarly', category: 'Software', kind: 'subscription', domain: 'grammarly.com', plans: [{ label: 'Pro', monthly: 30, yearly: 144 }] },
  { id: 'zoom', name: 'Zoom Pro', category: 'Software', kind: 'subscription', domain: 'zoom.us', plans: [{ label: 'Pro', monthly: 15.99, yearly: 159.9 }] },
  { id: 'slack', name: 'Slack Pro', category: 'Software', kind: 'subscription', domain: 'slack.com', plans: [{ label: 'Pro (per user)', monthly: 8.75, yearly: 87.5 }] },
  { id: 'figma', name: 'Figma Professional', category: 'Software', kind: 'subscription', domain: 'figma.com', plans: [{ label: 'Full seat', monthly: 20, yearly: 192 }] },
  { id: 'todoist', name: 'Todoist Pro', category: 'Software', kind: 'subscription', domain: 'todoist.com', plans: [{ label: 'Pro', monthly: 5, yearly: 48 }] },
  { id: 'linkedin-premium', name: 'LinkedIn Premium', category: 'Professional', kind: 'subscription', domain: 'linkedin.com', plans: [{ label: 'Career', monthly: 29.99, yearly: 239.88 }] },

  // ---- Security ----
  { id: '1password', name: '1Password', category: 'Security', kind: 'subscription', domain: '1password.com', overlap: 'password-manager', plans: [{ label: 'Individual', yearly: 35.88 }, { label: 'Families', yearly: 59.88 }] },
  { id: 'bitwarden', name: 'Bitwarden Premium', category: 'Security', kind: 'subscription', domain: 'bitwarden.com', overlap: 'password-manager', plans: [{ label: 'Premium', yearly: 10 }] },
  { id: 'lastpass', name: 'LastPass', category: 'Security', kind: 'subscription', domain: 'lastpass.com', overlap: 'password-manager', plans: [{ label: 'Premium', yearly: 36 }] },
  { id: 'nordvpn', name: 'NordVPN', category: 'Security', kind: 'subscription', domain: 'nordvpn.com', overlap: 'vpn', plans: [{ label: 'Basic (monthly)', monthly: 12.99 }] },
  { id: 'expressvpn', name: 'ExpressVPN', category: 'Security', kind: 'subscription', domain: 'expressvpn.com', overlap: 'vpn', plans: [{ label: 'Monthly', monthly: 12.95 }] },

  // ---- Gaming ----
  { id: 'xbox-game-pass', name: 'Xbox Game Pass Ultimate', category: 'Gaming', kind: 'subscription', domain: 'xbox.com', plans: [{ label: 'Ultimate', monthly: 29.99 }] },
  { id: 'ps-plus', name: 'PlayStation Plus', category: 'Gaming', kind: 'subscription', domain: 'playstation.com', plans: [{ label: 'Essential', monthly: 9.99, yearly: 79.99 }] },
  { id: 'nintendo-online', name: 'Nintendo Switch Online', category: 'Gaming', kind: 'subscription', domain: 'nintendo.com', plans: [{ label: 'Individual', monthly: 3.99, yearly: 19.99 }] },
  { id: 'apple-arcade', name: 'Apple Arcade', category: 'Gaming', kind: 'subscription', domain: 'apple.com', plans: [{ label: 'Monthly', monthly: 6.99 }] },

  // ---- Health & fitness ----
  { id: 'headspace', name: 'Headspace', category: 'Health', kind: 'subscription', domain: 'headspace.com', overlap: 'meditation', plans: [{ label: 'Monthly', monthly: 12.99, yearly: 69.99 }] },
  { id: 'calm', name: 'Calm', category: 'Health', kind: 'subscription', domain: 'calm.com', overlap: 'meditation', plans: [{ label: 'Premium', monthly: 16.99, yearly: 79.99 }] },
  { id: 'strava', name: 'Strava', category: 'Fitness', kind: 'subscription', domain: 'strava.com', plans: [{ label: 'Subscription', monthly: 11.99, yearly: 79.99 }] },
  { id: 'peloton-app', name: 'Peloton App', category: 'Fitness', kind: 'subscription', domain: 'onepeloton.com', plans: [{ label: 'App One', monthly: 15.99 }] },
  { id: 'planet-fitness', name: 'Planet Fitness', category: 'Fitness', kind: 'membership', domain: 'planetfitness.com', plans: [{ label: 'Classic', monthly: 15 }] },
  { id: 'duolingo', name: 'Duolingo Super', category: 'Education', kind: 'subscription', domain: 'duolingo.com', plans: [{ label: 'Super', monthly: 12.99, yearly: 83.99 }] },

  // ---- Delivery & shopping ----
  { id: 'doordash-dashpass', name: 'DashPass', category: 'Delivery', kind: 'membership', domain: 'doordash.com', overlap: 'delivery', plans: [{ label: 'DashPass', monthly: 9.99, yearly: 96 }] },
  { id: 'uber-one', name: 'Uber One', category: 'Delivery', kind: 'membership', domain: 'uber.com', overlap: 'delivery', plans: [{ label: 'Uber One', monthly: 9.99, yearly: 96 }] },
  { id: 'instacart-plus', name: 'Instacart+', category: 'Delivery', kind: 'membership', domain: 'instacart.com', overlap: 'delivery', plans: [{ label: 'Instacart+', monthly: 9.99, yearly: 99 }] },
  { id: 'walmart-plus', name: 'Walmart+', category: 'Shopping', kind: 'membership', domain: 'walmart.com', overlap: 'delivery', plans: [{ label: 'Walmart+', monthly: 12.95, yearly: 98 }] },
  { id: 'costco', name: 'Costco Membership', category: 'Shopping', kind: 'membership', domain: 'costco.com', overlap: 'warehouse-club', plans: [{ label: 'Gold Star', yearly: 65 }, { label: 'Executive', yearly: 130 }] },
  { id: 'sams-club', name: "Sam's Club", category: 'Shopping', kind: 'membership', domain: 'samsclub.com', overlap: 'warehouse-club', plans: [{ label: 'Club', yearly: 50 }, { label: 'Plus', yearly: 110 }] },

  // ---- Non-subscription templates (custom amounts) ----
  { id: 'rent', name: 'Rent / Lease', category: 'Housing', kind: 'lease', plans: [{ label: 'Monthly rent' }] },
  { id: 'electric', name: 'Electricity', category: 'Utilities', kind: 'utility', plans: [{ label: 'Monthly bill' }] },
  { id: 'gas-utility', name: 'Natural Gas', category: 'Utilities', kind: 'utility', plans: [{ label: 'Monthly bill' }] },
  { id: 'water-trash', name: 'Water & Trash', category: 'Utilities', kind: 'utility', plans: [{ label: 'Bi-monthly bill' }] },
  { id: 'internet', name: 'Internet', category: 'Utilities', kind: 'utility', plans: [{ label: 'Monthly bill' }] },
  { id: 'mobile-phone', name: 'Mobile Phone', category: 'Utilities', kind: 'utility', plans: [{ label: 'Monthly bill' }] },
  { id: 'car-insurance', name: 'Car Insurance', category: 'Insurance', kind: 'insurance', plans: [{ label: 'Premium' }] },
  { id: 'renters-insurance', name: "Renter's Insurance", category: 'Insurance', kind: 'insurance', plans: [{ label: 'Premium' }] },
  { id: 'car-loan', name: 'Car Loan', category: 'Loans', kind: 'loan', plans: [{ label: 'Monthly payment' }] },
  { id: 'magazine', name: 'Magazine Subscription', category: 'News & Magazines', kind: 'magazine', plans: [{ label: 'Print / digital' }] },
  { id: 'domain-renewal', name: 'Domain Renewal', category: 'Web', kind: 'subscription', plans: [{ label: 'Yearly', yearly: 15 }] },
];

const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));

export function getCatalogService(id: string | undefined): CatalogService | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Case-insensitive search over names, categories and domains. */
export function searchCatalog(query: string, limit = 50): CatalogService[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.slice(0, limit);
  return CATALOG.filter(
    (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || (s.domain ?? '').includes(q)
  ).slice(0, limit);
}

/** Best guess at which catalog entry an arbitrary name refers to (used to link imported/legacy items). */
export function matchCatalogByName(name: string): CatalogService | undefined {
  const n = name.trim().toLowerCase().replace(/[^a-z0-9+]/g, '');
  if (!n) return undefined;
  for (const s of CATALOG) {
    const sn = s.name.toLowerCase().replace(/[^a-z0-9+]/g, '');
    if (sn === n) return s;
  }
  for (const s of CATALOG) {
    const sn = s.name.toLowerCase().replace(/[^a-z0-9+]/g, '');
    // "Netflix 4K Tier" -> netflix ; require the catalog name to be a prefix of a meaningful length
    if (sn.length >= 4 && n.startsWith(sn)) return s;
  }
  return undefined;
}

/** Cheapest yearly price among plans whose label matches (or any plan when no label given). */
export function listPricesFor(service: CatalogService, planLabel?: string): CatalogPlan | undefined {
  if (planLabel) {
    const exact = service.plans.find((p) => p.label.toLowerCase() === planLabel.toLowerCase());
    if (exact) return exact;
  }
  return service.plans[0];
}

export const CATALOG_DEFAULT_CYCLE = (plan: CatalogPlan): BillingCycle => (plan.monthly !== undefined ? 'monthly' : plan.yearly !== undefined ? 'yearly' : 'monthly');
