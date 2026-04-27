# KosherTable

KosherTable is a Next.js 15 MVP for kosher, nightshade-free, tomato-free meal planning. The default experience uses a bundled 1,000-recipe catalog for free mobile testing, includes 50+ walleye recipes, stores saved recipes locally in the browser, links ingredients to shopping searches, and keeps optional AI generation behind server-only code for later.

## Primary Recommendation

Run it with Docker first. The current host has Node available but no npm/pnpm/yarn on PATH, so Docker is the cleanest path.

```bash
cp .env.example .env
docker compose up web-dev
```

Open `http://localhost:3000`.

The app works without AI keys because `/generate` searches the local catalog. For optional local AI demo mode later, keep:

```bash
LLM_PROVIDER=mock
```

For real AI generation, set one provider:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o
```

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

3. Provider swap:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

```bash
LLM_PROVIDER=grok
GROK_API_KEY=...
GROK_MODEL=grok-2-latest
GROK_BASE_URL=https://api.x.ai/v1
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
  - `/recipes/[id]` recipe view with shopping links
  - `/recipes/local?id=...` static-safe localStorage recipe view
  - `/api/recipes/generate` server API route
- LocalStorage keys:
  - `koshertable.savedRecipes.v1`
  - `koshertable.generatedRecipes.v1`
  - `koshertable.aiRateLimit.v1`
  - `koshertable.finderDraft.v1`
  - `koshertable.recentSearches.v1`
- AI providers:
  - OpenAI-compatible OpenAI chat completions
  - Anthropic messages
  - Grok/xAI OpenAI-compatible chat completions
  - Mock local provider
  - Optional only; not required for the default catalog flow
- Recipe images:
  - 112 local dish-aware recipe image assets in `public/images/recipes/real/`
  - safe Wikimedia photo assets for common fish, salmon, and mushroom/quinoa recipes
  - catalog image routing by main ingredient, kosher type, base, flavor, and Passover compatibility
  - generated SVG assets remain as fallback where no safe photo source is good enough
  - no remote hotlinks
  - online source references and generated prompts are tracked in `public/images/recipes/real/manifest.json`

Regenerate and verify local recipe images:

```bash
npm run images:recipes
npm run images:check
```

## Security And Operational Notes

- The default catalog flow does not need API keys, a database, or paid inference.
- The fixed food safety profile blocks nightshades and tomatoes.
- Kosher validation still blocks pork, shellfish, non-kosher fish, meat/dairy mixing risks, blood, non-kosher gelatin, and non-kosher wine.
- API keys never go to the browser when optional AI is enabled.
- Production defaults fail closed if provider config is missing.
- Every bundled catalog recipe is schema-validated and checked against the fixed safety profile.
- Shopping buttons are static outbound search/category links for Walmart, Wegmans, KŌSH, Grow & Behold, and KOL Foods. There is no scraping, login automation, or cart insertion.
- Kosher for Passover mode is strict no-kitniyot: no chametz, rice, corn, beans, lentils, chickpeas, soy, tofu, sesame, tahini, mustard, buckwheat, caraway, cardamom, fennel seeds, peas, or similar kitniyot.
- Every optional LLM call uses the strict kosher/allergy system prompt verbatim.
- The server forces the fixed safety profile on every generation request, even if a client submits weaker settings.
- Server validates request shape with Zod, validates model output with Zod, then checks forbidden ingredients.
- Client validates generated recipe safety again before saving or rendering.
- Client-side AI limit remains available for the optional AI path: 5 AI calls per 10 minutes.
- Server-side in-memory limit: 20 AI calls per hour per client IP per container.
- No external auth in MVP. This is intentionally easy to wrap with Clerk later.

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
```

Expose port `3000` from the container. Run behind TLS at the load balancer or ingress layer.

## Tradeoffs

- Recipe LocalStorage is simple and private to the browser, but not multi-device. Export/import JSON is the obvious next feature.
- In-memory rate limiting is fine for MVP, but clustered production should use Redis or OCI Cache.
- Deterministic ingredient blocking is intentionally conservative. That means some safe recipes may be rejected. Good. False negatives are worse here.
- Retailer links search for ingredients; they do not confirm stock, price, hechsher, or delivery availability.
- Calories are planning estimates, not medical nutrition facts.
