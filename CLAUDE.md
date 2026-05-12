# CLAUDE.md — Agentic Crawler

## Project context
Next.js 16 + Turborepo monorepo for an AI-powered web crawler prototype.
Uses Playwright for browser automation and Anthropic Claude (Sonnet + Haiku) for decision-making.

## Commands
- `pnpm dev` — start development server
- `pnpm build` — build all packages
- `pnpm lint` — lint all packages
- `pnpm type-check` — TypeScript type checking

## Architecture decisions
- **Monorepo**: Turborepo with pnpm workspaces
- **Frontend**: Single-page terminal-style UI, dark theme, dot-grid background
- **API**: Next.js Route Handlers with SSE streaming
- **Crawler**: Agentic loop — Sonnet plans, Playwright executes, results fed back
- **Model routing**: Sonnet is always the first call. It can delegate to Haiku for cheap extraction tasks.
- **HTML cleaning**: Two modes — content extraction (Readability → Turndown → Markdown) and structural extraction (strip scripts/styles, keep DOM structure)

## Code style
- TypeScript strict mode
- Prefer `async/await` over raw promises
- Keep functions small and focused
- All Playwright interactions must have proper error handling and timeouts
- All API calls to Anthropic must handle rate limits and errors gracefully

## Key files
- `apps/web/app/api/crawl/route.ts` — SSE endpoint
- `apps/web/lib/crawler.ts` — main agentic loop
- `apps/web/lib/html-cleaner.ts` — Readability + Turndown pipeline
- `apps/web/lib/model-router.ts` — Sonnet/Haiku delegation
- `apps/web/app/page.tsx` — terminal UI

## Important constraints
- Never install additional npm packages without asking first
- Playwright only uses Chromium (not Firefox or WebKit)
- The model must NEVER be given Opus as an option — only Sonnet and Haiku
- The `print()` tool should be used sparingly by the agent — only for meaningful user-facing messages
- HTML sent to the model must always be cleaned first to reduce token usage
- Maximum HTML token budget per message: ~8,000 tokens (~32,000 chars)
- All crawler actions must have timeouts to prevent hanging
