# Amie

A mobile-first couple web app for iPhone Safari and the Home Screen. Built with React, Vinext and Cloudflare Workers, with D1 for shared records and R2 for photos.

## Features

- Private two-person spaces with one-use, hashed invitation codes that expire after 24 hours.
- Messages and photo moments shared across devices, refreshed every 10 seconds while visible.
- Opt-in Web Push for messages, photos, and love taps, with private notification text and per-device controls.
- Mood check-ins, manual bedtime status and last-seen-in-Amie timestamps.
- An interactive Map tab with last-shared pins, a draggable details sheet, local people search, and approximate straight-line distance.
- Light, Dark, and System appearance across the app, under Us → Preferences. Light is the default.
- Opt-in location sharing while the page is open. Stopping sharing removes the stored coordinates. Every location includes its age and accuracy.
- Private profile photos, anniversary date, profile names, iPhone Home Screen installation and an offline reconnect screen.

No invented messages or locations are seeded in production. Location sharing does not start automatically. Photo uploads are resized and re-encoded in the browser, removing original metadata. Messages and photos are access-controlled but are not end-to-end encrypted.

## Independent website and accounts

Open **https://c4rlosst.github.io/couple_app/**. GitHub Pages serves the interface; the independent API runs at `https://amie-api.amie-c4rlosst.workers.dev` in the app owner’s Cloudflare account, with D1 storage. No ChatGPT account is required.

Create an Amie account with a username and a password of at least 12 characters, then create a space or enter your partner’s invitation code. Passwords use PBKDF2-SHA256 with a random salt; bearer sessions expire after 30 days and are revoked on sign-out. Save your password: password recovery is not yet available.

The interface is public, but every data and photo API request requires an Amie session. Earlier records from the ChatGPT-login version remain separate and are not automatically attached to new accounts.

GitHub Actions deploys frontend changes on pushes to `main`. Backend schema and API releases use `wrangler.backend.jsonc`; see `backend/README.md`. The legacy Sites backend remains private and is no longer used by the GitHub Pages app. Photo storage is connected through the private R2 bucket `amie-photos`. Public bucket access is disabled; photos are served only through the authenticated API after checking couple membership.

### Build the GitHub Pages interface

`npx vite build --config vite.pages.config.ts`

Output: `dist-pages/`, with `/couple_app/` asset paths and a scoped Home Screen manifest/service worker. No API secrets are bundled in the frontend.

## Local development

Node 22.13 or newer is required. Install dependencies with `npm run install:ci`. The Sites plugin installer is preferred when working through Sites.

1. `npm run build` generates the local Worker configuration.
2. Apply each new SQL migration in `drizzle/` once, in order:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_parched_annihilus.sql`
3. `npm run dev -- --port 5173`
4. Visit the printed loopback URL. Use your Amie account. Local data is separate from production.

## Verification

- `node --test tests/service.test.mjs tests/auth.test.mjs`: integration checks against real SQLite for authorization, pairing, invite expiry, cross-space isolation, message retry deduplication, check-ins, location removal, anniversaries and photo access.
- `npx tsc --noEmit`: TypeScript checks.
- `npm run build`: production build.

## iPhone limits

A web app cannot continuously track location while closed, read phone unlock history, or confirm someone is asleep. Bedtime is explicitly chosen by the person. The first version uses polling while open; a full paginated message history is not included. The UI shows the most recent 200 messages. Older records remain in storage. Offline messages are not queued; drafts remain until a send succeeds.

Open the hosted HTTPS URL in Safari, then Share → Add to Home Screen to install. Amie needs an internet connection for shared content.

## Maps

The Map tab uses a custom MapLibre style with vector data from OpenFreeMap. Appearance is saved on this device and System follows the device's color scheme. Loading the map connects to OpenFreeMap and requests tiles for the area in view. Amie draws saved pins and accuracy circles on the page. Loading the map is a per-device choice and Hide map clears that choice. The map credits are available through the info button.

The sheet searches only the two members' names. Selecting a result centers its saved pin; Show both locations fits both pins. Timestamps and accuracy stay visible in the expanded card, and fixes older than five minutes are marked as potentially out of date. Distances are between saved positions, not routes or travel times. Maps do not start location sharing automatically, and web apps cannot continuously update GPS while closed.

## Notifications

On each iPhone (iOS 16.4+), add Amie to the Home Screen, open it from that icon, sign in, then go to Us → Preferences → Notifications. Tap Enable notifications and allow the system prompt. Send test checks that device. Each device opts in separately; Turn off and signing out unsubscribe that device. Notifications announce message/photo/love-tap events without displaying private chat text. Delivery requires connectivity and follows system notification/Focus settings.

## Hosting

`.openai/hosting.json` retains the Site identity with logical `DB` and `BUCKET` bindings. Publish using the Sites workflow; it provisions storage and applies schema migrations. Never commit credentials, local database files, environment values, or build output.
