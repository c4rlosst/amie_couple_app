# Amie

A private, mobile-first couple web app with a minimal iPhone-style interface.

**[Open Amie](https://c4rlosst.github.io/couple_app/)**

The website runs independently on GitHub Pages with its own Amie accounts. Pushes to `main` automatically deploy the interface. A separate authenticated API stores shared messages, photos, and locations; no ChatGPT login is needed.

The application lives in [`amie/`](amie/). See its [README](amie/README.md) for setup, verification, hosting, and iPhone limitations.

Features include partner pairing, messages, photo moments, mood check-ins, manual bedtime status, anniversaries, and opt-in location updates while the app is open.

## Develop

```sh
cd amie
npm run install:ci
npm run dev
```

For shared-data features, first follow the local database initialization steps in the application README.
