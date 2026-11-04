# Amie

A private, mobile-first couple web app with a minimal iPhone-style interface.

**[Open Amie](https://amie-our-little-space-nov26.mixedglint.chatgpt.site/)**

The live app requires an authorized ChatGPT account. This GitHub repository is the main source for future changes; the running app is hosted on Sites with shared database and photo storage.

The application lives in [`amie/`](amie/). See its [README](amie/README.md) for setup, verification, hosting, and iPhone limitations.

Features include partner pairing, messages, photo moments, mood check-ins, manual bedtime status, anniversaries, and opt-in location updates while the app is open.

## Develop

```sh
cd amie
npm run install:ci
npm run dev
```

For shared-data features, first follow the local database initialization steps in the application README.
