# Standalone Amie API

This Worker runs directly in the app owner's Cloudflare account. It does not use Sites, ChatGPT sign-in, or the private legacy backend. All shared-data routes require an Amie session; photo storage is optional until R2 is enabled.

## Deploy

Live API: **https://amie-api.amie-c4rlosst.workers.dev**. The configured D1 database and account already exist. Do not create replacements when publishing an update.

From the `amie` directory, authenticate only when needed (current Wrangler supports device login without a localhost callback):

```sh
npm exec --yes --package=wrangler@4.157.0 -- wrangler login --device --scopes account:read user:read workers_scripts:write d1:write
```

The resource IDs are in `wrangler.backend.jsonc`; they are configuration identifiers, not credentials. Apply pending migrations and publish with the repository’s tested Wrangler version:

```sh
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config wrangler.backend.jsonc
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.backend.jsonc
```

Set `API_ORIGIN` in `lib/client-api.ts` to the returned HTTPS Worker origin, run checks, and push to GitHub. The Pages workflow rebuilds the frontend automatically.

`GET /health` reports database and photo-storage availability. Registration and login use `/api/auth`; all shared records use `/api/amie`; private photo downloads use `/api/photos/:id`. CORS permits the GitHub Pages origin, while bearer authentication independently protects each operation.

## Photos

When the owner has enabled R2, create a private bucket and add an `r2_buckets` entry with `binding: "BUCKET"` and its `bucket_name`. Redeploy the Worker. Do not enable public bucket access. The Worker checks pair membership before returning any photo.

## Existing data

The new D1 database starts empty. Legacy records are not copied or exposed automatically. The previous Sites backend stays private.
