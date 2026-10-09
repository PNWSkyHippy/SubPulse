# SubPulse Gateway

A small Node service that gives AI agents an **MCP endpoint** into a user's SubPulse data and powers **Stripe balance linking**. It reads and writes the same Firestore collections as the app, so anything an agent does shows up in the app instantly.

```
Agent (Claude / Gemini / Cursor) --Bearer sp_live_…-->  /mcp  ──┐
SubPulse app --Firebase ID token-->  /stripe/*                    ├──> Firestore (same project as the app)
Admin --ADMIN_TOKEN-->  /admin/promotions                        ──┘
```

## MCP tools

| Tool | Scope | What it does |
|---|---|---|
| `list_items` | read | Bills with computed due state (overdue, escalation level…) |
| `get_item` | read | One bill + payment history + attached notes |
| `get_cashflow` | read | Monthly burn, upcoming charges for N days, overdue, balances |
| `list_due` | read | Overdue + due within N days |
| `get_savings_report` | read | Duplicates, bundle overlaps, overlapping services, annual-plan savings, promos |
| `list_notes`, `list_contacts`, `search_catalog`, `export_csv` | read | |
| `add_item`, `update_item`, `add_note` | write | |
| `record_payment` | payments | Settles one cycle, advances the due date |
| `set_item_status` | cancel | Pause / cancel / resume tracking |

Tokens are created in the app (**Settings → Agentic MCP gateway**). Only a SHA-256 hash is stored; a token only sees its owner's data and only the tools its scopes allow. Every call is logged to `mcpActivity` and shown in the app.

## Run locally

```bash
cd server
npm install
DEMO_MODE=1 npm run dev        # in-memory sample data, token: sp_live_demo
npm test                       # 12 end-to-end tests using the real MCP client
```

Connect Claude Code to the demo:

```bash
claude mcp add subpulse-demo --transport http --header "Authorization: Bearer sp_live_demo" http://localhost:8080/mcp
```

## Deploy (Google Cloud Run — same Google project as Firebase)

```bash
# from the repo root
gcloud run deploy subpulse-gateway --source . --region us-west1 --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=<your-firebase-project>,TZ=America/Los_Angeles,PUBLIC_URL=https://<service-url> \
  --set-secrets STRIPE_SECRET_KEY=stripe-secret:latest,ADMIN_TOKEN=subpulse-admin:latest \
  --set-env-vars STRIPE_PUBLISHABLE_KEY=pk_test_...
```

`--source .` builds the repo-root `Dockerfile` (the gateway container). The Cloud Run service account needs the **Cloud Datastore User** role (Firestore) and **Firebase Authentication Admin** (to verify app sign-ins). `TZ` sets which calendar day counts as "today" for due dates.

Then paste the service URL into the app (Settings → Agentic MCP gateway → Gateway URL), and deploy the Firestore rules from the repo root: `firebase deploy --only firestore:rules`.

## Stripe balances

Uses Stripe **Financial Connections** with the `balances` permission only (no payments). Test mode works with Stripe's test institutions. Flow: app → `POST /stripe/link-session` → browser page at `/stripe/link/:nonce` (Stripe.js) → back to `subpulse://stripe-linked` → `POST /stripe/refresh` writes `balances` docs.

## Promotions feed (sale / promo alerts)

```bash
curl -X POST https://<gateway>/admin/promotions -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '[{"id":"nord-fall","catalogId":"nordvpn","title":"NordVPN renewal 45% off","discountPct":45,"code":"SECURE45","expires":"2026-12-01","url":"https://nordvpn.com"}]'
```

Promotions match tracked items by catalog id and appear in the app's Optimizer and in `get_savings_report`.
