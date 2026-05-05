# KosherTable

KosherTable is a Next.js 15 MVP for kosher, nightshade-free, tomato-free meal planning. It uses a bundled 1,000-recipe catalog, supports shared household favorites and groceries, requires Google sign-in before rendering the app, and syncs approved household data with Firebase Auth + Firestore. It stays static: no recipe-generation API or paid inference path is exposed.

## Primary Recommendation

Run it with Docker first. The current host has Node available but no npm/pnpm/yarn on PATH, so Docker is the cleanest path.

```bash
cp .env.example .env
docker compose up web-dev
```

Open `http://localhost:3000`.

The app content is locked until Google auth is configured and a signed-in account passes the Firestore `allowed_users` check. Create a Firebase project, enable Google sign-in, deploy `firestore.rules`, seed `allowed_users`, then set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Full launch steps live in `docs/firebase-gcp-launch.md`.

## Alternatives

1. Production container locally:

```bash
cp .env.example .env
docker compose up --build web
```

Open `http://localhost:3001`.

2. Native Node workflow, when npm is available:

```bash
npm install
npm run dev
```

3. Local UI development without Google auth:

```bash
npm run dev:local -- --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100`. This enables `NEXT_PUBLIC_KOSHERTABLE_LOCAL_AUTH_BYPASS=true`, which only unlocks the app in non-production builds on `localhost`, `127.0.0.1`, or `::1`. Cloud sync stays disabled.

4. LAN preview:

```bash
npm run dev:lan
```

## V2 Local Preview

V2 work happens on `main`, but production stays live from the `gh-pages` branch. A normal source commit does not update the public GitHub Pages site.

Start the local preview:

```bash
docker compose up web-dev
```

The dev server keeps `.next` inside a container tmpfs so checks and production builds cannot poison the live preview cache. Yes, this is exactly the boring fix for the recurring unstyled-page problem.

Open it on this Mac:

```text
http://localhost:3000
```

Open it from a phone or tablet on the same Wi-Fi:

```text
http://<your-mac-lan-ip>:3000
```

If you are running without Docker and npm is available:

```bash
npm run dev:lan
```

To find the Mac's LAN IP:

```bash
ipconfig getifaddr en0
```

If Wi-Fi is not `en0`, check the active interface in macOS network settings. Keep this preview on a trusted local network; it is a development server, not an internet-facing deployment.

## What It Builds

- Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui-style local components.
- Routes:
  - `/` dashboard
  - `/onboarding` redirect to generator for old links
  - `/generate` local catalog recipe finder with recipe-name search, strict Kosher for Passover filtering, and varied top-match rotation
  - `/find` browseable catalog matches
  - `/favorites` shared household favorited recipes
  - `/groceries` editable and store-view grocery lists
  - `/recipes/[id]` recipe view with shopping links
  - `/recipes/local?id=...` static-safe localStorage recipe view
- LocalStorage keys:
  - `koshertable.savedRecipes.v1`
  - `koshertable.generatedRecipes.v1`
  - `koshertable.recipeProfiles.v1`
  - `koshertable.selectedRecipeProfileId.v1`
  - `koshertable.groceryItems.v1`
  - `koshertable.firebaseSession.v1`
  - `koshertable.finderDraft.v1`
  - `koshertable.recentSearches.v1`
- Required Firebase/Firestore auth:
  - Firebase Auth Google sign-in gates all app content.
  - `allowed_users/{email}` whitelist documents approve who can open and sync the household app.
  - shared `households/default` Firestore documents for favorites, groceries, and household preferences.
- Recipe images:
  - 112 local dish-aware recipe image assets in `public/images/recipes/real/` and `public/images/recipes/ai/`
  - optional per-recipe catalog thumbnails in `public/images/recipes/catalog/catalog-0001.webp` through `catalog-1000.webp`
  - `lib/catalog-recipe-images.json` maps completed per-recipe thumbnails and lets the app fall back to archetype images when a recipe thumbnail is missing
  - reviewed Wikimedia photo assets for common fish, salmon, and mushroom/quinoa recipes
  - Apple Creative Studio handoff prompts in `public/images/recipes/ai/apple-creative-studio-worklist.json`
  - imported `.webp` / `.png` files in `public/images/recipes/ai/` are preferred over SVG placeholders after `npm run images:recipes`
  - catalog image routing by main ingredient, kosher type, base, flavor, and Passover compatibility
  - generated SVG assets remain as fallback until higher-quality raster images are imported
  - no remote hotlinks
  - online source references and generated prompts are tracked in `public/images/recipes/real/manifest.json`

Regenerate and verify local recipe images:

```bash
npm run images:recipes
npm run images:worklist
npm run images:check
```

Per-recipe thumbnail batches:

```bash
# Docker-safe: export the next 50 missing catalog image prompts.
docker compose run --rm web-dev npm run images:catalog:worklist

# Host-side after dropping raw images named catalog-0001.png, etc. into:
# public/images/recipes/catalog/incoming/
# Requires local ffmpeg and cwebp.
npm run images:catalog:import
npm run images:catalog:contact

# Review the contact sheet before exposing images in the app.
# Approve a whole reviewed batch, or reject specific bad images.
npm run images:catalog:qa -- --status=approved --ids=1-50 --note="Reviewed contact sheet"
npm run images:catalog:qa -- --status=rejected --ids=catalog-0007 --note="Bad food/category match"

# Only approved images are included in the app manifest.
npm run images:catalog:manifest

# Docker-safe validation after approval/import.
docker compose run --rm web-dev npm run images:check
```

## Security And Operational Notes

- The default catalog flow does not need API keys, a database, or paid inference.
- The fixed food safety profile blocks nightshades and tomatoes.
- Kosher validation still blocks pork, shellfish, non-kosher fish, meat/dairy mixing risks, blood, non-kosher gelatin, and non-kosher wine.
- Firebase public web config can go to the browser; the UI renders only after sign-in, and `firestore.rules` restrict shared household data to signed-in whitelisted emails.
- Every bundled catalog recipe is schema-validated and checked against the fixed safety profile.
- Shopping buttons are static outbound links. Grocery-list Walmart cart prompts are agent handoffs only; the app does not log in, scrape, checkout, or place orders.
- Kosher for Passover mode is strict no-kitniyot: no chametz, rice, corn, beans, lentils, chickpeas, soy, tofu, sesame, tahini, mustard, buckwheat, caraway, cardamom, fennel seeds, peas, or similar kitniyot.
- Generated/local recipe storage remains only for backward compatibility with old browsers; there is no UI or API path to create new recipes.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run images:check
npm run build
```

E2E smoke tests:

```bash
npm run test:e2e
```

With Docker:

```bash
docker compose run --rm web-dev npm run typecheck
docker compose run --rm web-dev npm run lint
docker compose run --rm web-dev npm run test
docker compose run --rm web-dev npm run images:worklist
docker compose run --rm web-dev npm run images:check
docker compose build web
```

GitHub Pages static export:

```bash
npm run build:github
```

This writes the static site to `out/` with `NEXT_PUBLIC_BASE_PATH=/kosher-diet`. If the repository is renamed, update `build:github` before deploying.

Firebase/GCP static export for `https://kosher.netsbyvets.org`:

```bash
npm run build:firebase
firebase deploy --only hosting
```

This writes the static site to `out/` without a base path so Firebase Hosting serves it from `/`. See `docs/firebase-gcp-launch.md` for the GCP project, Firebase Auth/Firestore, whitelist, and Cloudflare DNS steps.

Firebase/GCP infrastructure is managed with Terraform in `infra/terraform`:

```bash
cd infra/terraform/bootstrap
terraform init
terraform plan -out=tfplan

cd ../prod
terraform init
terraform plan -out=tfplan
```

Terraform manages the `$5` monthly budget alert, Firebase/Firestore/Auth setup, Google sign-in provider, Cloudflare DNS records, and GitHub Workload Identity deploy access. GitHub Actions deploys Firebase preview channels for pull requests and live Hosting from `main`.

For the current free testing setup, production is the `gh-pages` branch. GitHub Pages should be set to **Settings → Pages → Source → Deploy from a branch**, then **gh-pages / root**. The Pages URL is:

```text
https://biscuitdh.github.io/kosher-diet/
```

### Production Deploy Gate

Firebase deploys may auto-deploy from `main` after the Terraform/GitHub variables are configured. GitHub Pages remains manually gated unless that deployment policy changes.

Before any production push:

```bash
npm run typecheck
npm run lint
npm run test
npm run images:check
npm run build:github
```

Then verify the exported app from `out/`. Only after explicit approval, publish `out/` to `gh-pages` and push that branch. Until `gh-pages` is updated, the live site remains on the last approved production build.

## OCI / OCIR Deployment

Build for OCI Container Instances, OKE, or any OCI service that runs containers:

```bash
docker build -t koshertable:latest .
```

Tag for OCIR:

```bash
docker tag koshertable:latest <region-key>.ocir.io/<tenancy-namespace>/koshertable:latest
```

Login:

```bash
docker login <region-key>.ocir.io
```

Push:

```bash
docker push <region-key>.ocir.io/<tenancy-namespace>/koshertable:latest
```

Runtime environment variables:

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
AI_GENERATION_API_KEY=...
```

Expose port `3000` from the container. Run behind TLS at the load balancer or ingress layer.

## Tradeoffs

- Recipe LocalStorage is simple and private to the browser, but not multi-device. Export/import JSON is the obvious next feature.
- In-memory rate limiting is fine for MVP, but clustered production should use Redis or OCI Cache.
- Deterministic ingredient blocking is intentionally conservative. That means some safe recipes may be rejected. Good. False negatives are worse here.
- Retailer links search for ingredients; they do not confirm stock, price, hechsher, or delivery availability.
- Calories are planning estimates, not medical nutrition facts.
