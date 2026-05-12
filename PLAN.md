# Claude Code Prompt — AI Agentic Crawler

> Copy everything below this line into Claude Code as your initial prompt.

---

## Project overview

Build a **one-page web application prototype** called "Awesome Crawler" further referenced as "Agentic Crawler" — an AI-powered browser automation tool where a Claude model autonomously navigates websites, extracts data, and streams its reasoning and actions to the user in real time.

The app follows a **terminal-style layout** (Layout C): a dark-themed single page with a styled dot-grid background, a compact top bar showing the project name and live status, a full-height monospaced live feed showing color-coded agent actions, and a floating input bar pinned to the bottom with a stop button.

## Tech stack and versions

| Tool | Version | Purpose |
|---|---|---|
| **Turborepo** | `^2.9` | Monorepo build system |
| **Next.js** | `^16.2` (App Router) | Frontend + API routes |
| **React** | `^19` | UI |
| **TypeScript** | `^5.7` | Type safety everywhere |
| **Playwright** | `^1.59` | Headless browser automation |
| **@anthropic-ai/sdk** | `^0.95` | Claude API (Sonnet + Haiku) |
| **@mozilla/readability** | `^0.6` | HTML content extraction |
| **turndown** | `^7.2` | HTML → Markdown conversion |
| **jsdom** | `^26` | Server-side DOM for Readability |
| **pnpm** | `^9` | Package manager |
| **Tailwind CSS** | `^4` | Styling |

### Libraries — purpose and justification

Before installing any library not on this list, **stop and ask for approval**. Here is the rationale for each approved dependency:

- **`playwright`** — Core browser automation. The agent uses it to navigate, click, type, screenshot, evaluate JS, and read the DOM. We only install Chromium (`npx playwright install chromium`).
- **`@anthropic-ai/sdk`** — Official Anthropic TypeScript SDK for calling Claude Sonnet and Haiku via the Messages API with streaming support.
- **`@mozilla/readability`** — Mozilla's Reader View extraction algorithm. Strips navigation, ads, footers, and noise from raw HTML, leaving only the main content. Used before sending page content to the model to reduce token usage.
- **`turndown`** — Converts cleaned HTML from Readability into Markdown, which is the most token-efficient format for LLM consumption.
- **`jsdom`** — Provides a server-side DOM implementation so Readability can parse HTML strings in Node.js.
- **`tailwindcss`** — Utility-first CSS. Used for the dark-themed terminal UI with custom CSS for the dot-grid background and gradient accents.

## Monorepo structure (Turborepo)

```
agentic-crawler/
├── apps/
│   └── web/                      # Next.js 16 app (App Router)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx          # Single-page terminal UI
│       │   ├── globals.css       # Tailwind + dot-grid + gradients
│       │   └── api/
│       │       └── crawl/
│       │           └── route.ts  # POST endpoint — SSE stream
│       ├── components/
│       │   ├── LiveFeed.tsx      # Scrolling monospaced feed
│       │   ├── InputBar.tsx      # Bottom-pinned instruction input
│       │   ├── TopBar.tsx        # Status bar + live indicator
│       │   └── FeedEntry.tsx     # Single feed line with tag + color
│       ├── lib/
│       │   ├── crawler.ts        # Orchestrator: Playwright + Claude loop
│       │   ├── html-cleaner.ts   # Readability + Turndown pipeline
│       │   ├── model-router.ts   # Sonnet/Haiku delegation logic
│       │   └── types.ts          # Shared TypeScript types
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                   # Shared types and utilities
│       ├── src/
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── README.md
├── CLAUDE.md
└── .env.example
```

## Scaffold commands

```bash
pnpm dlx create-turbo@latest agentic-crawler --package-manager pnpm
cd agentic-crawler
# Clean the default apps/ and packages/ — we'll create our own structure
# Install core dependencies in apps/web:
cd apps/web
pnpm add @anthropic-ai/sdk playwright @mozilla/readability turndown jsdom
pnpm add -D @types/turndown @types/jsdom
npx playwright install chromium
```

---

## Feature specifications

### 1. Frontend — terminal-style single page (Layout C)

The entire UI is a single dark page with a **dot-grid background** pattern. The design should feel like a stylish developer terminal with personality — not a generic dashboard.

**Background**: Dark base (`#0a0a0f` or similar), with a subtle dot-grid using CSS `radial-gradient`:
```css
background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
background-size: 20px 20px;
```

**Color palette** (accent colors for the feed tags):
- Purple/violet (`#8b5cf6` family) — navigation actions, primary accent
- Emerald (`#10b981` family) — success states, page loaded
- Amber (`#f59e0b` family) — thinking/reasoning steps
- Red (`#ef4444` family) — errors, stop button
- Muted white/gray — timestamps, secondary text

**Lighting gradients**: Add subtle radial gradient glows behind key UI areas (the input bar, the status indicator) using CSS radial gradients with very low opacity accent colors. These should feel atmospheric, not distracting. Example: a faint purple glow emanating from the bottom-center behind the input bar.

#### Top bar
- Left: small purple dot + "agentic crawler" label (font-weight 500, ~13px)
- Right: live model indicator showing which model is currently active (e.g., a small pill badge: `sonnet` in purple or `haiku` in teal), and a green dot pulsing when the crawler is running, gray when idle

#### Live feed (main area)
- Takes up all available vertical space between the top bar and input bar
- Monospaced font (`font-family: 'JetBrains Mono', 'Fira Code', monospace`)
- Auto-scrolls to bottom as new entries stream in
- Each entry is one line with the format: `[tag] message text`
- Tags are color-coded by action type:
  - `[nav]` purple — navigating to URL
  - `[ok]` green — page loaded, action succeeded
  - `[think]` amber — model is reasoning
  - `[act]` purple — model performing browser action
  - `[extract]` teal — extracting/reading content
  - `[error]` red — something failed
  - `[haiku]` teal — delegated to Haiku model
  - `[done]` green — crawl completed
- Each entry also shows a subtle timestamp on the left (HH:MM:SS, very low opacity)
- When the model switches from Sonnet to Haiku, show a subtle separator or different tag color so the user can observe cost optimization happening

#### Input bar (bottom-pinned)
- Full-width input field with placeholder: "Enter crawl instructions..."
- Send button (purple accent, right side)
- Stop button (red square icon, only visible/enabled while crawl is running)
- The input bar should have a slight glass-morphism feel — semi-transparent background with subtle backdrop blur
- On submit: disable input, show stop button, begin streaming feed entries via SSE

#### Responsive behavior
- The page should work on desktop (primary target) but gracefully adapt to tablet/mobile by stacking elements vertically and reducing font sizes

### 2. Backend — API route (`/api/crawl`)

A Next.js Route Handler that:
1. Receives the user's instruction as a POST body
2. Opens a Server-Sent Events (SSE) stream back to the client
3. Launches the crawler orchestrator
4. Streams feed entries (JSON events) back as the agent works
5. Supports cancellation via `AbortController` when the user clicks Stop

SSE event format:
```typescript
type FeedEntry = {
  id: string;
  timestamp: string; // ISO 8601
  tag: 'nav' | 'ok' | 'think' | 'act' | 'extract' | 'error' | 'haiku' | 'done';
  message: string;
  model: 'sonnet' | 'haiku';
  metadata?: Record<string, unknown>; // optional extra data (URL, element count, etc.)
};
```

### 3. Crawler orchestrator (`lib/crawler.ts`)

This is the core agentic loop. It:

1. **Launches Playwright** (headless Chromium) with a persistent browser context
2. **Calls Claude Sonnet** with the user's instruction + current page state
3. **Executes the model's chosen action** via Playwright
4. **Observes the result** and feeds it back to Sonnet for the next step
5. **Repeats** until the task is complete or the user stops it

#### Agent loop structure

```
User instruction
  → Sonnet (plan next action)
    → Execute action via Playwright
      → Observe result (screenshot + cleaned HTML)
        → Sonnet (decide next action or finish)
          → ... repeat
```

#### Playwright capabilities the model can use

Define these as tools/functions the model can call:

- `navigate(url)` — go to a URL, wait for `networkidle`
- `click(selector)` — click an element
- `type(selector, text)` — type into an input field
- `scroll(direction, amount)` — scroll the page
- `screenshot()` — take a full-page screenshot (returns base64)
- `get_html()` — get the current page's cleaned HTML/Markdown (via Readability + Turndown)
- `get_raw_html(selector?)` — get raw HTML of a specific element or the full page
- `evaluate(js)` — run arbitrary JavaScript in the page context
- `wait(ms)` — wait for a specific duration
- `wait_for_selector(selector, timeout?)` — wait for an element to appear
- `go_back()` — browser back button
- `get_url()` — return current URL
- `print(message)` — emit a message to the user's feed (use only when the model has something meaningful to communicate, not for internal reasoning)

#### Multi-page flow handling

- The agent must be capable of multi-step flows: filling forms → submitting → following redirects → extracting from result pages
- After every navigation or action that could cause a page load, **wait for the page to stabilize** (`networkidle` or `domcontentloaded` + a short delay)
- Handle redirects gracefully — if a navigation results in redirects, log the redirect chain in the feed
- Track visited URLs to avoid loops

#### Visual input + HTML structure

When the model needs to make visual decisions (e.g., "which button to click", "what does the page look like"):
- Take a **screenshot** and pass it as an image to the model
- **Also pass the cleaned HTML structure** alongside the screenshot so the model has both visual and structural context
- The HTML should be cleaned but preserve semantic structure (headings, links, buttons, forms, lists) — not just article text
- For structural HTML (used for finding selectors), use a lightweight cleaning approach: strip `<script>`, `<style>`, `<svg>`, comments, and inline styles, but keep the DOM structure with key attributes (`id`, `class`, `href`, `type`, `name`, `placeholder`, `aria-label`)

### 4. Model router — automatic Sonnet/Haiku delegation (`lib/model-router.ts`)

**This is NOT a user preference.** The first call is always Sonnet. Sonnet acts as the "brain" and can decide to delegate certain tasks to Haiku to cut costs.

Delegation rules (encoded in Sonnet's system prompt):

- **Sonnet handles**: Planning, complex decisions, visual analysis, multi-step reasoning, deciding what to do next, error recovery
- **Haiku handles**: Simple data extraction from already-loaded content, summarizing text, parsing structured data, reading simple page content when the structure is already known

Implementation:
- Sonnet's tool list includes a `delegate_to_haiku(task, context)` tool
- When Sonnet calls this tool, the orchestrator makes a separate Haiku API call with the specified task and context
- Haiku's response is returned to Sonnet as the tool result
- The live feed shows `[haiku]` tags for delegated work so the user can see cost optimization

Model strings:
- Sonnet: `claude-sonnet-4-20250514`
- Haiku: `claude-haiku-4-5-20251001`

### 5. HTML cleaning pipeline (`lib/html-cleaner.ts`)

Two modes of cleaning:

**Content extraction mode** (for reading/understanding page content):
```
Raw HTML → JSDOM → Readability.parse() → Turndown → clean Markdown
```
This strips all navigation, ads, and junk. Good for when the model wants to understand what a page says.

**Structural extraction mode** (for finding interactive elements):
```
Raw HTML → strip <script>, <style>, <svg>, comments, data-* attributes
         → preserve id, class, href, type, name, placeholder, role, aria-*
         → truncate very long class names
         → collapse whitespace
         → return cleaned HTML string
```
This preserves the DOM structure so the model can find selectors to click/type.

Both modes should enforce a **token budget** — if the cleaned output exceeds ~8,000 tokens (roughly 32,000 characters), truncate intelligently:
- For content mode: keep first N paragraphs
- For structural mode: keep the `<head>` summary + visible viewport portion of `<body>`

### 6. System prompt for the agent

Craft a detailed system prompt for Sonnet that:

1. Explains it is a web crawling agent with access to a real browser via Playwright
2. Lists all available tools with clear descriptions
3. Instructs it to reason step-by-step before acting
4. Tells it to use `screenshot()` + `get_html()` together for visual decisions
5. Tells it to use `print()` sparingly — only for meaningful status updates to the user, not internal monologue
6. Explains it can delegate simple extraction/summarization tasks to Haiku via `delegate_to_haiku()` to save costs
7. Instructs it to handle errors gracefully — if an action fails, try an alternative approach
8. Tells it to respect robots.txt and not submit forms with sensitive data unless explicitly instructed
9. Tells it to track its progress and declare when the task is complete

---

## Configuration files

### `turbo.json`
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `.env.example`
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## README.md contents

Write a `README.md` that includes:

1. **Project title and one-line description**
2. **Screenshot placeholder** (mention it will be added after first run)
3. **Architecture overview** — brief explanation of the agentic loop, model routing, and HTML cleaning pipeline
4. **Tech stack** — table format with versions
5. **Getting started** — step-by-step setup:
   - Clone repo
   - `pnpm install`
   - `npx playwright install chromium`
   - Copy `.env.example` → `.env` and add API key
   - `pnpm dev`
6. **How it works** — explain the terminal UI and what the feed tags mean
7. **Model routing** — explain Sonnet as brain, Haiku as delegate, and cost optimization
8. **Limitations** — this is a prototype: single concurrent crawl, no auth persistence, no proxy support, no anti-bot measures
9. **License** — MIT

## CLAUDE.md contents

Write a `CLAUDE.md` that serves as **instructions for Claude Code** when working on this project:

```markdown
# CLAUDE.md — Agentic Crawler

## Project context
This is a Next.js 16 + Turborepo monorepo for an AI-powered web crawler prototype.
The crawler uses Playwright for browser automation and Anthropic Claude (Sonnet + Haiku) for decision-making.

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
- Use descriptive variable names
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
- Maximum HTML token budget per message: ~8,000 tokens
- All crawler actions must have timeouts to prevent hanging
```

---

## Implementation order

Build in this sequence:

1. **Scaffold** — Turborepo + Next.js app structure, install dependencies
2. **Types** — Define `FeedEntry`, tool types, and model router types in `lib/types.ts`
3. **HTML cleaner** — Implement both content and structural extraction modes
4. **Model router** — Implement Sonnet/Haiku delegation logic
5. **Crawler orchestrator** — Implement the agentic loop with Playwright + Claude
6. **API route** — Wire up SSE streaming endpoint
7. **Frontend** — Build the terminal UI (TopBar, LiveFeed, InputBar, FeedEntry)
8. **Styling** — Dark theme, dot-grid, gradients, monospace feed, glass input bar
9. **Polish** — Stop button, error states, auto-scroll, responsive tweaks
10. **README + CLAUDE.md** — Documentation

When implementing each step, test it before moving on. For the crawler, start with a simple test case: "Go to https://example.com and tell me what you see."