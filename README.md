# KosherTable

KosherTable is a Next.js 15 MVP for kosher, nightshade-free, tomato-free meal planning. It uses a bundled 1,000-recipe catalog, supports shared household favorites and groceries, can sync them across devices with Supabase, and stays static: no recipe-generation API or paid inference path is exposed.

## Primary Recommendation

Run it with Docker first. The current host has Node available but no npm/pnpm/yarn on PATH, so Docker is the cleanest path.

```bash
cp .env.example .env
docker compose up web-dev
```

Open `http://localhost:3000`.

The app works without cloud services. To sync shared favorites and groceries across devices, create a Supabase project, run `docs/supabase-schema.sql`, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

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

3. LAN preview:

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
  - `koshertable.supabaseSession.v1`
  - `koshertable.finderDraft.v1`
  - `koshertable.recentSearches.v1`
- Optional Supabase tables:
  - `koshertable_recipe_profiles`
  - `koshertable_favorite_recipes`
  - `koshertable_grocery_items`
  - `koshertable_user_preferences`
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
- Supabase public anon keys can go to the browser; row-level security in `docs/supabase-schema.sql` scopes all synced data to the signed-in user.
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

For the current free testing setup, production is the `gh-pages` branch. GitHub Pages should be set to **Settings → Pages → Source → Deploy from a branch**, then **gh-pages / root**. The Pages URL is:

```text
https://biscuitdh.github.io/kosher-diet/
```

### Production Deploy Gate

Do not auto-deploy from `main`. Do not add a GitHub Actions publisher unless the deployment policy changes.

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
