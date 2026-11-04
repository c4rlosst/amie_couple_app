# Amie

A mobile-first couple web app for iPhone Safari and the Home Screen. Built with React, Vinext and Cloudflare Workers, with D1 for shared records and R2 for photos.

## Features

- Private two-person spaces with one-use, hashed invitation codes that expire after 24 hours.
- Messages and photo moments shared across devices, refreshed every 10 seconds while visible.
- Mood check-ins, manual bedtime status and last-seen-in-Amie timestamps.
- Opt-in location sharing while the page is open. Stopping sharing removes the stored coordinates. Every location includes its age and accuracy.
- Anniversary date, profile names, iPhone Home Screen installation and an offline reconnect screen.

No invented messages or locations are seeded in production. Location sharing does not start automatically. Photo uploads are resized and re-encoded in the browser, removing original metadata. Messages and photos are access-controlled but are not end-to-end encrypted.

## Independent website and accounts

Open **https://c4rlosst.github.io/couple_app/**. GitHub Pages serves the interface; the API uses Cloudflare Workers with D1 and R2. No ChatGPT account is required.

Create an Amie account with a username and a password of at least 12 characters, then create a space or enter your partner’s invitation code. Passwords use PBKDF2-SHA256 with a random salt; bearer sessions expire after 30 days and are revoked on sign-out. Save your password: password recovery is not yet available.

The interface is public, but every data and photo API request requires an Amie session. Earlier records from the ChatGPT-login version remain separate and are not automatically attached to new accounts.

GitHub Actions deploys frontend changes on pushes to `main`. Backend schema and API releases use the Sites deployment workflow. `.openai/hosting.json` identifies the backend and contains no credentials.

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

A web app cannot continuously track location while closed, read phone unlock history, or confirm someone is asleep. Bedtime is explicitly chosen by the person. The first version uses polling while open; background push notifications and a full paginated message history are not included. The UI shows the most recent 200 messages. Older records remain in storage. Offline messages are not queued; drafts remain until a send succeeds.

Open the hosted HTTPS URL in Safari, then Share → Add to Home Screen to install. Amie needs an internet connection for shared content.

## Hosting

`.openai/hosting.json` retains the Site identity with logical `DB` and `BUCKET` bindings. Publish using the Sites workflow; it provisions storage and applies schema migrations. Never commit credentials, local database files, environment values, or build output.
