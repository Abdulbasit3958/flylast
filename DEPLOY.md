# Deploying FlyLast to Firebase App Hosting

FlyLast is a Next.js app with server API routes, so it deploys to **Firebase App Hosting**. That's Firebase's hosting for full-stack Next.js; plain Firebase Hosting only serves static files.

## One-time setup (Firebase console)

1. **Blaze plan.** App Hosting requires it: Console → ⚙ → Usage and billing → Modify plan. Hackathon traffic normally stays inside the free allowance, but set a budget alert anyway.
2. **Authentication.** Build → Authentication → Get started → enable **Email/Password**.
3. **Firestore.** Build → Firestore Database → Create database, in production mode. Pick a region near your users, e.g. `asia-south1`.
4. **Web app config.** Project settings → Your apps → add a Web app. Copy `apiKey`, `authDomain` and `projectId` into [apphosting.yaml](apphosting.yaml), replacing the `YOUR_…` placeholders. These values are public identifiers, not secrets.

## Deploy (from this folder)

```bash
npx firebase-tools@latest login                 # opens a browser once
npx firebase-tools@latest use --add             # pick your project, alias "default"
npx firebase-tools@latest init apphosting       # choose/create backend "flylast", root dir "/"
npm run deploy                                  # App Hosting backend + Firestore security rules
```

The CLI prints your live URL, something like `https://flylast--<project>.<region>.hosted.app`.

`firebase.json` already excludes `.env*`, service-account keys, `node_modules` and `.next` from the upload. This matters because `.env.local` points at the local emulator.

## Demo data in production

```bash
cp .env.prod.example .env.prod      # fill project id + DEMO_PASSWORD (8+ chars)
# Console → Project settings → Service accounts → Generate new private key → save as ./service-account.json
npm run seed:prod
```

This creates the 5 demo accounts (with **your** `DEMO_PASSWORD`, not `demo1234`), the 3 plans and 5 sample releases. It resets offers, bookings, subscriptions and watches, but never deletes real user accounts. Share the demo password with judges privately; the deployed login page does not show demo buttons.

## Optional

- **Gemini AI Deal Finder:** `npx firebase-tools@latest apphosting:secrets:set GEMINI_API_KEY`, then uncomment the `GEMINI_API_KEY` block in `apphosting.yaml` and redeploy.
- **Short seat hold for a live demo:** set `NEXT_PUBLIC_SEAT_HOLD_SECONDS` to `45` in `apphosting.yaml` and redeploy.

## If something goes wrong

| Symptom | Fix |
|---|---|
| API calls return 500, logs show `PERMISSION_DENIED` | In Google Cloud IAM, give the App Hosting compute service account (`firebase-app-hosting-compute@<project>.iam.gserviceaccount.com`) the **Cloud Datastore User** and **Firebase Authentication Admin** roles. |
| Sign-in fails on the live URL | Authentication → Settings → Authorized domains → add your `*.hosted.app` domain. |
| Build fails on App Hosting | Console → App Hosting → your backend → Rollouts → open the build log. |
