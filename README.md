# FlyLast

Airline-controlled marketplace for last-minute empty seats. Airlines release unsold seats at an approved price for a limited booking window. FlyLast distributes each release to **authorized travel agencies** (free) and/or **individual subscribers** (paid plans), as the airline chooses. **Only individual travellers subscribe.**

Full business model, user flows and the 5-minute demo script: [USER_FLOWS.md](USER_FLOWS.md).

Stack: Next.js 15 + Tailwind, Firebase Auth + Firestore (Admin SDK on the server), Gemini via `@google/genai`.

## Run locally (Firebase emulator, no cloud needed)

Requires Node 22 and Java 17+.

```bash
npm install
cp .env.local.example .env.local   # already points at the emulator
npm run emulators                  # terminal 1 (Auth :9099, Firestore :8080, UI :4000)
npm run seed                       # terminal 2: plans, demo accounts, sample offers (re-run to reset)
npm run dev                        # http://localhost:3000
```

Demo logins (password `demo1234`): `traveller@`, `airline@`, `agency@`, `admin@`, `pending-airline@` with the domain `flylast.demo`.

## Checks

```bash
npm test                 # eligibility, revenue protection, traveller-only subscribe rule
bash scripts/smoke.sh    # security checks against the running app (needs seed + dev)
```

## Gemini

Add `GEMINI_API_KEY=...` to `.env.local` and restart `npm run dev`. Without a key, the AI Deal Finder uses a keyword fallback and says so in the UI. Gemini only ever receives the offers the traveller's plan is eligible for.

## Real Firebase project

In `.env.local`:
1. Set `NEXT_PUBLIC_USE_EMULATOR=0`.
2. Delete the two `*_EMULATOR_HOST` lines.
3. Fill the web config from Firebase console.
4. Set `FIREBASE_SERVICE_ACCOUNT` to the service-account JSON on one line.

Then enable Email/Password sign-in, deploy rules (`npx firebase deploy --only firestore:rules --project <id>`), and run `npm run seed`.

## How the rules are enforced

| Rule | Where |
|---|---|
| Only travellers subscribe | `canSubscribe` in [lib/domain.ts](lib/domain.ts) and `requireUser(req, ['traveller'])` in [subscriptions/activate](app/api/subscriptions/activate/route.ts). [firestore.rules](firestore.rules) deny all client writes. Business and admin navigation has no subscription pages, and unlisted URLs redirect away. |
| Offer access by tier, subscription, release, expiry, cutoff, seats | `offerDenial` in [lib/domain.ts](lib/domain.ts), applied server-side in `/api/offers`, `/api/offers/[id]/book`, notifications and the AI finder. Locked offers are sent without price or booking link. |
| Airline picks channels per release | `distributeToAgencies` / `distributeToSubscribers` on each offer. Feeds filter by channel, and booking re-checks with `offerDenial` (subscribers) or `agencyDenial` (agency must also be authorized by that airline). |
| Airline pricing control | `validateOffer` (Revenue Protection Engine). Invalid offers are never stored. Agencies get read-only access. |
| Server-controlled activation and expiry | Server sets dates. A subscription is active only while `status == 'active' && expiryDate > now`. |
| Revenue = traveller subscriptions only | `/api/admin/stats` sums `priceAtPurchase` over subscriptions owned by traveller accounts. |

## Demo

See the 5-minute script in [USER_FLOWS.md](USER_FLOWS.md#5-minute-hackathon-demo-script).
