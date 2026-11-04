# Standalone Amie API

This Worker runs directly in the app owner's Cloudflare account. It does not use Sites, ChatGPT sign-in, or the private legacy backend. All shared-data routes require an Amie session; photos are stored in the private R2 bucket `amie-photos`.

## Deploy

Live API: **https://amie-api.amie-c4rlosst.workers.dev**. The configured D1 database and account already exist. Do not create replacements when publishing an update.

From the `amie` directory, authenticate only when needed (current Wrangler supports device login without a localhost callback):

```sh
npm exec --yes --package=wrangler@4.157.0 -- wrangler login --device --scopes account:read user:read workers:write workers_scripts:write d1:write
```

The resource IDs are in `wrangler.backend.jsonc`; they are configuration identifiers, not credentials. Apply pending migrations and publish with the repository’s tested Wrangler version:

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config wrangler.backend.jsonc
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.backend.jsonc
```

Set `API_ORIGIN` in `lib/client-api.ts` to the returned HTTPS Worker origin, run checks, and push to GitHub. The Pages workflow rebuilds the frontend automatically.

`GET /health` reports database and photo-storage availability. Registration and login use `/api/auth`; all shared records use `/api/amie`; private moment downloads use `/api/photos/:id`; profile photos use `/api/avatars/:memberId`. CORS permits the GitHub Pages origin, while bearer authentication independently protects each operation.

## Photos

The existing Standard-class R2 bucket `amie-photos` is bound as `BUCKET` in `wrangler.backend.jsonc`. Its location hint is Asia-Pacific. Reuse this bucket when deploying; do not replace it or enable its public r2.dev URL/custom domains. The Worker checks pair membership before returning any photo.

Storage is connected in production. Local integration tests cover uploads, file-type validation, partner retrieval, and rejection of anonymous/unrelated users. Read-only production checks confirm the binding is present and anonymous data/photo requests return 401; bucket checks confirm public access is disabled. Live uploads with disposable accounts were not performed.

## Profile photos

Migration `0002_profile_photos.sql` adds a nullable avatar version to each member. Signed-in people can upload their own profile photo before pairing. Multipart uploads with `purpose=avatar` always update the signed-in member; the server ignores client owner IDs. Profile-photo reads require the owner or their partner. Replacements/removals clean up the old private R2 object. Profile photos never appear as chat messages.

## Web Push

Migration `0003_push_subscriptions.sql` stores per-account device endpoints and encryption keys. Only the owning account can manage or test a subscription. `/api/push` is authenticated; it never returns signing secrets or other devices' endpoints. Push delivery goes only to the other member of the sender's space, after a new message/photo/tap is persisted. Retried message IDs do not send duplicate notifications. Delivery runs through the Worker's `waitUntil`; failures do not undo messages.

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are deployed as Cloudflare secrets. Do not print, commit, or replace the private key during normal deployments. Key rotation requires devices to enable notifications again. Use `wrangler secret list --config wrangler.backend.jsonc` to inspect names only. Approved push services are Apple, FCM, Mozilla, and Windows; HTTPS, key validation, and redirect rejection prevent arbitrary subscription URLs from reaching other services. Expired subscriptions are deleted after provider 404/410 responses. The test endpoint is limited to once every 30 seconds per device.

Run `node --test tests/service.test.mjs tests/auth.test.mjs tests/backend.test.mjs tests/push.test.mjs`. The tests independently decrypt the encrypted push payload, verify its VAPID signature, and cover subscription ownership, partner-only delivery, expiration, duplicate events, and service-worker click handling. No production test accounts/subscriptions are created by these checks.

## Existing data

The new D1 database starts empty. Legacy records are not copied or exposed automatically. The previous Sites backend stays private.
