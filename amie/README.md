# Amie

A mobile-first couple web app for iPhone Safari and the Home Screen. Built with React, Vinext and Cloudflare Workers, with D1 for shared records and R2 for photos.

## Features

- Private two-person spaces with one-use, hashed invitation codes that expire after 24 hours.
- Messages and photo moments shared across devices, refreshed every 10 seconds while visible.
- Mood check-ins, manual bedtime status and last-seen-in-Amie timestamps.
- Opt-in location sharing while the page is open. Stopping sharing removes the stored coordinates. Every location includes its age and accuracy.
- Anniversary date, profile names, iPhone Home Screen installation and an offline reconnect screen.

No invented messages or locations are seeded in production. Location sharing does not start automatically. Photo uploads are resized and re-encoded in the browser, removing original metadata. Messages and photos are access-controlled but are not end-to-end encrypted.

## Access

The hosted site starts owner-only and uses the hosting platform’s ChatGPT sign-in. A partner must first be granted site access, then sign in with their own account and enter the invitation code. A code does not override hosting access. Do not make the site public to solve a pairing issue.

## Local development

Node 22.13 or newer is required. Install dependencies with `npm run install:ci`. The Sites plugin installer is preferred when working through Sites.

1. `npm run build` generates the local Worker configuration.
2. Apply each new SQL migration in `drizzle/` once, in order:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_parched_annihilus.sql`
3. `npm run dev -- --port 5173`
4. Visit the printed loopback URL. “Start our story” uses the starter’s loopback-only development sign-in. Local data is separate from production.

## Verification

- `node --test tests/service.test.mjs`: integration checks against real SQLite for authorization, pairing, invite expiry, cross-space isolation, message retry deduplication, check-ins, location removal, anniversaries and photo access.
- `npx tsc --noEmit`: TypeScript checks.
- `npm run build`: production build.

## iPhone limits

A web app cannot continuously track location while closed, read phone unlock history, or confirm someone is asleep. Bedtime is explicitly chosen by the person. The first version uses polling while open; background push notifications and a full paginated message history are not included. The UI shows the most recent 200 messages. Older records remain in storage. Offline messages are not queued; drafts remain until a send succeeds.

Open the hosted HTTPS URL in Safari, then Share → Add to Home Screen to install. Amie needs an internet connection for shared content.

## Hosting

`.openai/hosting.json` retains the Site identity with logical `DB` and `BUCKET` bindings. Publish using the Sites workflow; it provisions storage and applies schema migrations. Never commit credentials, local database files, environment values, or build output.
