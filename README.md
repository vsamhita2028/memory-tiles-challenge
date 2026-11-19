# Memory Tiles

A browser-only matching game for the Zoho Catalyst booth at React Hyderabad Utsavam 2026. Match each Zoho product with its use case before the two-minute timer ends.

## Run locally

Requires Node.js 18 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` to create the production site in `dist`, and `npm run preview` to preview that build locally.

## Deploy to GitHub Pages

1. Push this repository to GitHub with the default branch named `main`.
2. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` or run **Deploy to GitHub Pages** manually from the Actions tab. The workflow builds the app and publishes `dist`.

The build uses relative asset paths, so it works at both a domain root and a repository path. If your default branch has a different name, update the branch in `.github/workflows/deploy.yml`. No backend or environment variables are required.

## Leaderboard

Completed wins are stored in the browser using IndexedDB. The top 10 are ranked by elapsed time, then attempts. A player name is required before starting and must not already exist in the local leaderboard (case insensitive). Scores persist across refreshes in the same browser and device; they are not shared between devices and may be removed if browser site data is cleared.
