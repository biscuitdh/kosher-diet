# KosherTable

KosherTable is a Next.js 15 MVP for kosher, allergy-aware recipe generation. It uses one fixed safety profile, stores recipes locally in the browser, calls LLMs only from the server, and validates every generated recipe against deterministic kosher and allergy blocklists.

## Primary Recommendation

Run it with Docker first. The current host has Node available but no npm/pnpm/yarn on PATH, so Docker is the cleanest path.

```bash
cp .env.example .env
docker compose up web-dev
```

Open `http://localhost:3000`.

For local demo mode, keep:

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

## What It Builds

- Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui-style local components.
- Routes:
  - `/` dashboard
  - `/onboarding` redirect to generator for old links
  - `/generate` AI recipe generation
  - `/recipes/[id]` recipe view
  - `/api/recipes/generate` server API route
- LocalStorage keys:
  - `koshertable.savedRecipes.v1`
  - `koshertable.generatedRecipes.v1`
  - `koshertable.aiRateLimit.v1`
- AI providers:
  - OpenAI-compatible OpenAI chat completions
  - Anthropic messages
  - Grok/xAI OpenAI-compatible chat completions
  - Mock local provider

## Security And Operational Notes

- API keys never go to the browser.
- Production defaults fail closed if provider config is missing.
- Every LLM call uses the strict kosher/allergy system prompt verbatim.
- The server forces the fixed safety profile on every generation request, even if a client submits weaker settings.
- Server validates request shape with Zod, validates model output with Zod, then checks forbidden ingredients.
- Client validates generated recipe safety again before saving or rendering.
- Client-side limit: 5 AI calls per 10 minutes.
- Server-side in-memory limit: 20 AI calls per hour per client IP per container.
- No external auth in MVP. This is intentionally easy to wrap with Clerk later.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
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
docker compose build web
```

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
