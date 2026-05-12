# agentic crawler

An AI-powered browser automation tool where a Claude model autonomously navigates websites, extracts data, and streams its reasoning and actions to you in real time.

> Screenshot will be added after first run.

## Architecture overview

```
User instruction
  → Claude Sonnet (plan next action via tool calls)
    → Playwright executes action in headless Chromium
      → Page state (screenshot + cleaned HTML) returned as tool result
        → Sonnet decides next action or delegates to Haiku
          → ... repeat until task_complete()
```

**Model routing**: Sonnet is the "brain" — it plans, decides, and handles visual analysis. When a task is simple (extract a table, summarize text from already-loaded content), Sonnet calls `delegate_to_haiku()` to reduce costs. The live feed shows `[haiku]` tags when delegation happens.

**HTML cleaning**: Two modes — content extraction (Readability → Turndown → Markdown, strips nav/ads) and structural extraction (preserves DOM with key attributes for selector discovery).

## Tech stack

| Tool | Version | Purpose |
|---|---|---|
| Next.js | ^16.2 | Frontend + API routes (App Router) |
| React | ^19 | UI |
| TypeScript | ^6 | Type safety |
| Playwright | ^1.60 | Headless browser automation |
| @anthropic-ai/sdk | ^0.95 | Claude API |
| @mozilla/readability | ^0.6 | Content extraction |
| turndown | ^7.2 | HTML → Markdown |
| jsdom | ^29 | Server-side DOM |
| Tailwind CSS | ^4 | Styling |
| Turborepo | ^2.9 | Monorepo build system |

## Getting started

```bash
# 1. Clone the repo
git clone <repo-url>
cd awesome-crawler

# 2. Install dependencies
pnpm install

# 3. Install Chromium for Playwright
npx playwright install chromium

# 4. Configure API key
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local and add your ANTHROPIC_API_KEY

# 5. Start the dev server
pnpm dev
```

Open http://localhost:3000.

## How it works

The UI is a terminal-style dark page. Enter an instruction in the bottom bar (e.g. _"Go to https://news.ycombinator.com and summarize the top 5 stories"_) and hit **run**.

The live feed streams color-coded entries as the agent works:

| Tag | Color | Meaning |
|---|---|---|
| `[nav]` | purple | Navigating to URL |
| `[ok]` | green | Page loaded / action succeeded |
| `[think]` | amber | Model is reasoning |
| `[act]` | purple | Model performing browser action |
| `[extract]` | teal | Extracting / reading content |
| `[haiku]` | teal | Delegated to Haiku (cost optimization) |
| `[error]` | red | Something failed |
| `[done]` | green | Crawl completed |

Click the red **stop** button to abort at any time.

## Model routing

- **Sonnet** (`claude-sonnet-4-20250514`) — always the first call; handles planning, visual analysis, complex decisions
- **Haiku** (`claude-haiku-4-5-20251001`) — delegated by Sonnet for cheap extraction tasks

When you see `[haiku]` entries in the feed, Sonnet has identified a simple extraction task and delegated it to save tokens.

## Limitations

This is a prototype:
- Single concurrent crawl (one user at a time)
- No browser auth persistence across sessions
- No proxy support
- No anti-bot bypass measures
- Chromium only
