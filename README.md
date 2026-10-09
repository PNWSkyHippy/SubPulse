# SubPulse

A supercharged subscription and recurring-expense tracker (the v2 of
SubscriptionTracker), built with Expo / React Native + TypeScript for Android
and iOS, with Firebase sync and an **MCP gateway** so AI agents can help manage
your bills.

Design: the Stitch "SubPulse" design system (obsidian canvas, electric-mint
accent, Hanken Grotesk + Geist), see `src/theme/theme.ts`.

## Features

| Area | What's in it | Where |
|---|---|---|
| Everything recurring | Subscriptions, leases/rent, utilities, magazines, insurance, loans, memberships, one-time fees. Weekly → yearly + one-time cycles, month-end-safe dates | `src/types`, `src/utils/billing.ts` |
| Known services | 78-entry catalog with typical US list prices + plans, one-tap add | `src/data/catalog.ts`, Add → Known App |
| Due dates, reminders, escalation | Auto-pay items roll forward; manual-pay items stay due until paid, then escalate (default day 1/3/7) with high-priority notifications and **Mark paid / Remind tomorrow** buttons | `src/utils/notifications.ts` |
| Payments | Record payments (settles one cycle), history per item, overdue amounts with missed cycles | Item detail |
| Balances | Stripe Financial Connections (read-only balances) via the gateway, or manual balances; 30-day runway | Settings → Stripe & balances |
| Savings optimizer | Duplicates, bundle double-pays (Apple One + Apple Music…), overlapping services, annual-plan switch (exact from your prices, or list-price), promotions/sales feed, compound projection | `src/utils/insights.ts`, Optimizer tab |
| CSV | Import (file or paste, header-mapped, error report) and export everything | Add → CSV Hub |
| Contacts | Import from the phone (includes Google-synced contacts) or a Google Contacts .vcf; payees and bill splitting | Settings → Contacts |
| Calculator | Samsung One UI–style calculator (smart brackets, %, ±, history, live preview) with "set as amount" and "split" | `src/utils/calculator.ts` |
| Notes | Notes attached to bills, tags, export to Google Keep and send to Gemini (Android share intents) | `src/utils/noteExport.ts` |
| Multi-currency | 15 currencies, live rates (open.er-api.com), base-currency totals and converter | Settings → Currency |
| Themes | 4 presets, accent, depth and corner-radius customizer | Settings → Theme |
| Monetization | Free tier with AdMob (interstitial every 4 saves, banner slot); Pro = ad-free via RevenueCat | `src/utils/ad.ts`, `src/utils/purchases.ts` |
| Agent-friendly | MCP gateway with per-agent scoped tokens, activity log | `server/`, Settings → Agentic MCP gateway |

## Verified here

- `npm test` — **112 tests** (billing/escalation, month-end dates, local-day handling, savings optimizer, calculator, CSV, vCard, forex, icons)
- `npx tsc --noEmit` — clean
- `npx expo export --platform android` — full Android JS bundle builds
- `cd server && npm test` — **12 end-to-end MCP tests** with the official MCP client, in 3 time zones
- AdMob plugin verified with `expo prebuild` (writes the app id into AndroidManifest)

Not verifiable in the cloud workspace: on-device UI, real notifications, real Stripe/RevenueCat/AdMob traffic.

## Run it

```bash
npm install
cp .env.example .env      # fill in Firebase web config
npx expo start            # scan with Expo Go
```

**Expo Go** is fine for clicking through screens, but since SDK 53 it no longer
supports full notifications, and it has no AdMob or store-purchase support. SubPulse
detects Expo Go and skips ads (a "Remove ads" card shows instead); Expo Go will still
log an `expo-notifications` warning. For the real thing, make a **development build** —
built in Expo's cloud, no Android Studio needed:

```bash
npm install -g eas-cli
eas login
eas init                                   # once: links the project, fills extra.eas.projectId
eas build --profile development --platform android
```

Install the APK it links to on your phone, then run `npx expo start` and open
the project from that app instead of Expo Go.

Firestore rules (per-user isolation for every collection): `firebase deploy --only firestore:rules`.

### Gateway (MCP + Stripe)

See [server/README.md](server/README.md). Short version: deploy to Cloud Run in the same Google project as Firebase, paste the URL into **Settings → Agentic MCP gateway**, generate a token, and paste the generated `claude mcp add …` command into Claude Code (or the JSON into Gemini CLI / other clients).

### Monetization setup

1. AdMob: app ids and the interstitial unit are in `src/utils/ad.ts` / `app.json`. Development builds use Google's **test** ads automatically. Optional banner unit ids go in `.env`.
2. RevenueCat: create a `premium` entitlement with a lifetime (and/or monthly) product, then set `EXPO_PUBLIC_REVENUECAT_*_KEY`. Until then everyone is on the free tier.
3. `react-native-google-mobile-ads` is pinned to **16.5.0**: 17.0.0 doesn't compile against React Native 0.81 (Expo SDK 54) and 17.1+ needs RN 0.86.
4. Install packages with `npm ci`, not `npm install`: npm 11 (Node 24) rewrites `package-lock.json` in a way EAS's npm 10 rejects.

## Project structure

```
App.tsx                      providers, fonts, tabs + stack, notification actions
src/types/                   data model (backwards compatible with v1 documents)
src/data/catalog.ts          known services + list prices
src/utils/                   billing, dates, savings, CSV, calculator, forex, vCard,
                             notifications, ads, purchases, gateway client, note export
src/context/                 Auth, Preferences (theme/currency/premium), data (Firestore)
src/ui/kit.tsx               design-system components
src/components/              ItemCard, ItemForm, Calculator, AdBanner, pickers
src/screens/                 Dashboard, Add & CSV, Optimizer, Inspect, Settings, ItemDetail, …
server/                      MCP + Stripe gateway (Node, shares src/ logic)
firestore.rules              security rules
Dockerfile                   gateway container (Cloud Run)
```

## Data migration from SubscriptionTracker

Same Firestore collection (`subscriptions`) and field names; every new field is optional, so existing data loads as auto-pay subscriptions. The app id changed to `com.pnwskyhippy.subpulse`, so it installs alongside the old app.
