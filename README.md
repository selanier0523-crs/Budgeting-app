# Personal Budget Tracker

Local-first budgeting app for tracking income, spending, savings, reimbursements, category budgets, and monthly savings goals.

## Accounts

The app supports Supabase email/password accounts. Unsigned users keep using browser local storage. Signed-in users sync their full budget document to `public.budget_profiles`, keyed by their Supabase user ID and protected by RLS.

The Supabase table migration is in `supabase/migrations/`.

## Household Accounts

Signed-in users can connect budgets into a household. Each person still owns and edits only their own budget, while the Household tab shows shared income, spending, savings, category totals, and a transaction feed labeled by person.

To connect accounts:

1. One person signs in, opens Account, and creates a household.
2. They copy the household code.
3. Another signed-in person opens Account, pastes that code under Join Household, and chooses a display name.
4. The Household tab shows the group summary once each member has synced budget data.

## Run Locally

```powershell
npm install
npm run dev -- --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

## Build

```powershell
npm run build
```

The production files are created in `dist/`.

## Phone Install Readiness

The app is now a Progressive Web App:

- `public/manifest.webmanifest`
- `public/service-worker.js`
- install icons at `public/icons/`
- mobile layout support
- offline app shell caching

To install it on a phone, it needs to be served from a secure HTTPS URL. The easiest path is deploying the built app to a static host such as Vercel, Netlify, Cloudflare Pages, or GitHub Pages. After that:

- iPhone: open the HTTPS URL in Safari, tap Share, then Add to Home Screen.
- Android: open the HTTPS URL in Chrome, then use Install app or Add to Home screen.

## PNC Bank Connection Feasibility

Connecting directly to PNC from this local-only browser app is not safe or realistic because bank access requires server-side secrets and secure token storage.

The feasible path is:

1. Create a Plaid developer account.
2. Request/enable Production access if real PNC accounts are needed.
3. Build a backend API with secure environment variables.
4. Use Plaid Link in the frontend to let the user permission PNC access.
5. Exchange the temporary Plaid `public_token` on the backend for an `access_token`.
6. Store Plaid tokens encrypted on the backend, never in browser localStorage.
7. Use Plaid Transactions Sync to fetch new purchases, transfers, deposits, and paychecks.
8. Use Plaid transaction webhooks to know when new transactions are available.
9. Add an in-app review queue that suggests budget entries instead of auto-committing them.

Recommended import behavior:

- card purchase -> suggested spending transaction
- paycheck/deposit -> suggested income
- transfer to savings -> suggested savings entry
- transfer between checking/card/savings -> review first, do not auto-count as income or spending
- PNC payment/credit card payment -> ignore or mark as transfer, depending on account setup

This should be a separate phase after the app is deployed and has a backend.
