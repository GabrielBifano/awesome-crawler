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
- **API**: Single unified `/api/chat` route with SSE streaming — handles both chat and crawler invocation
- **Mode model**: Two modes only — `chat` (default, always active) and `crawling` (sub-state while crawler runs)
- **Crawler invocation**: The model decides when to crawl via tool use (`invoke_crawler`). The user never explicitly triggers the crawler — they just send messages.
- **Stop behavior**: Stop halts the crawler and returns to `chat`. Session status becomes `paused`. On next message, Sonnet evaluates whether to resume.
- **HTML cleaning**: Two modes — content extraction (Readability → Turndown → Markdown) and structural extraction (strip scripts/styles, keep DOM structure)
- **Model routing**: Sonnet is always the conversational brain. It can delegate sub-tasks to Haiku via `delegate_to_haiku()` during crawling only. Chat turns always use Sonnet.

## Session persistence (Supabase)

- Sessions start on the first user message, regardless of whether crawling occurs
- `store` holds session metadata; `checkpoints` holds full conversation history
- `checkpoint_blobs` and `checkpoint_writes` are NOT used — do not touch them
- Session status can be: `active`, `crawling`, `paused`, `completed`, `error`
- `paused` means a crawl was interrupted mid-run and may be resumable

## User identity

- `userId` generated client-side with `nanoid(12)`, prefixed `user_`, stored in `localStorage`
- Always passed from client → API in request body, never generated server-side
- `lib/user-identity.ts` is CLIENT ONLY

## App modes

```
chat      → default, input is always active
crawling  → crawler is running (input disabled, stop button visible)
```

Transitions:
- `chat` → `crawling`: Sonnet calls `invoke_crawler` tool
- `crawling` → `chat`: crawl completes naturally OR user presses Stop
- Loading a past session always lands in `chat`

## Key files

- `app/api/chat/route.ts` — unified SSE endpoint (chat + crawler orchestration)
- `lib/crawler.ts` — crawler as a callable function (not a route handler)
- `lib/html-cleaner.ts` — Readability + Turndown pipeline
- `lib/model-router.ts` — Sonnet/Haiku delegation (used within crawler only)
- `lib/session-manager.ts` — session CRUD + Haiku title generation
- `lib/user-identity.ts` — browser userId (CLIENT ONLY)
- `components/SideMenu.tsx` — animated history panel

## Important constraints

- Never install additional npm packages without asking first
- Playwright only uses Chromium
- The model is NEVER given Opus — only Sonnet (chat + planning) and Haiku (delegation within crawler)
- `print()` tool used sparingly — only meaningful user-facing messages during crawling
- HTML sent to the model must always be cleaned first — max ~8,000 token budget
- All Playwright actions must have timeouts
- The `/api/crawl` route no longer exists — use `/api/chat` for everything

## Code style
- TypeScript strict mode
- Prefer `async/await` over raw promises
- Keep functions small and focused
- All Playwright interactions must have proper error handling and timeouts
- All API calls to Anthropic must handle rate limits and errors gracefully
