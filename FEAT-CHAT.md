# Claude Code Prompt — Feature Additions to Agentic Crawler

> This prompt extends the existing project. Read the existing codebase first before making any changes.
> Do NOT re-scaffold. Do NOT overwrite existing files unless explicitly told to modify them here.
> All additions must integrate cleanly with the existing terminal-style UI and SSE architecture.

---

## Overview of changes

Four interconnected features are being added:

1. **Animated side menu** — a history panel that slides in from the left of the input bar
2. **Session persistence** — every conversation is a named session, stored in Supabase
3. **Browser-based user identity** — anonymous but persistent `userId` derived from the browser
4. **Chat-first architecture** — chat is the default and permanent mode; the model autonomously decides when to invoke the crawler as a tool

---

## Fundamental architecture change — read this first

The previous design treated "crawl" and "chat" as two separate user-driven modes. **This is no longer the case.**

The new architecture is:

- **Chat is always the mode.** The user types naturally. The app is always ready to receive a message.
- **The model decides when to crawl.** After receiving the user's message, Sonnet evaluates whether crawling is needed to fulfil the request. If yes, it internally invokes the crawler as a tool. The user does not trigger crawling explicitly — it happens transparently.
- **Crawling is a sub-state within a chat turn.** When Sonnet invokes the crawler, the live feed shows the crawler's activity. When the crawl finishes (or is stopped), the model continues the conversation with the crawl results as context.
- **Stop interrupts the crawler, not the session.** If the user clicks Stop while the crawler is running, the crawler halts and the model receives a `crawl_interrupted` signal. On the next user message, Sonnet evaluates whether to resume the interrupted crawl or take a different approach. The conversation history is fully preserved across interruptions.

### Revised `AppMode` type

```typescript
type AppMode =
  | 'chat'      // default — input ready, no active process
  | 'crawling'; // crawler is running as a sub-process of a chat turn
```

There is no `idle` mode. The app opens in `chat` mode. All sessions start in `chat` mode.

### What this changes about the original prompt

| Area | Old behavior | New behavior |
|---|---|---|
| User submits message | Goes directly to crawler | Goes to Sonnet first — Sonnet decides |
| Mode on page load | `idle` | `chat` |
| Mode after crawl ends | `chat` (transition) | `chat` (already there, no transition) |
| Mode after Stop | `idle` | `chat` (Sonnet gets `crawl_interrupted` signal) |
| Input placeholder | Changes per mode | Always: `"Send a message..."` |
| Session created | When crawl starts | When first message is sent |
| `/api/crawl` route | Receives raw instruction | Replaced by `/api/chat` — see below |

---

## New dependencies — require no approval, add them now

```bash
cd apps/web
pnpm add @supabase/supabase-js nanoid
```

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2` | Supabase client for reading/writing sessions |
| `nanoid` | `^5` | Generating compact URL-safe unique IDs for `userId` and `sessionId` |

Update `.env.example` to add:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both vars are `NEXT_PUBLIC_` because the Supabase client is instantiated on both client and server.

---

## 1. Browser-based user identity (`lib/user-identity.ts` — client-only)

```typescript
// lib/user-identity.ts
// CLIENT ONLY — never import this in server code

const USER_ID_KEY = 'agentic_crawler_user_id';

export function getUserId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getUserId() must only be called on the client');
  }
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${nanoid(12)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}
```

- Generated once per browser via `nanoid(12)`, persisted in `localStorage`
- Survives page refreshes; does not survive clearing browser storage
- Never generated server-side — always received from the client via request body

---

## 2. Supabase schema mapping

### `store` table — session metadata

```
prefix  = userId
key     = sessionId
value   = {
  title: string,           // Haiku-generated from first user message
  status: 'active' | 'crawling' | 'paused' | 'completed' | 'error',
  firstMessage: string,    // the user's very first message in the session
  createdAt: string,       // ISO 8601
  messageCount: number,    // total conversation turns
  lastCrawlUrl?: string,   // last URL the crawler was on before being stopped (if paused)
}
created_at, updated_at    = managed by Supabase
```

Status values explained:
- `active` — session exists, chat is happening, no crawl in progress
- `crawling` — crawler is currently running within this session
- `paused` — crawler was stopped mid-run; crawl may be resumed by the model
- `completed` — all tasks done (model has declared the task finished)
- `error` — an unrecoverable error occurred

### `checkpoints` table — conversation history

Each turn in the conversation is a checkpoint. A "turn" is one user message plus the model's full response (which may include a crawl sub-process).

```
thread_id             = sessionId
checkpoint_ns         = userId
checkpoint_id         = nanoid(16)
parent_checkpoint_id  = previous checkpoint_id (null for first turn)
type                  = 'chat' | 'chat_with_crawl'
                        // 'chat_with_crawl' means this turn triggered a crawl
checkpoint            = {
  userMessage: string,
  assistantResponse: string,
  feedEntries?: FeedEntry[],      // only when type = 'chat_with_crawl'
  crawlContext?: string,          // extracted markdown, only when type = 'chat_with_crawl'
  crawlInterrupted?: boolean,     // true if the crawl was stopped before finishing
  lastCrawlUrl?: string,          // the URL the crawler was on when stopped
}
metadata              = {
  model: 'sonnet',
  timestamp: string,
  turnIndex: number,
}
```

### `checkpoint_blobs` and `checkpoint_writes` — not used

Leave these untouched. They are part of the LangGraph schema but are not needed here.

---

## 3. Supabase client (`lib/supabase.ts`)

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 4. Session manager (`lib/session-manager.ts`)

### `createSession(userId, firstMessage)`
- Generates `sessionId = 'sess_' + nanoid(16)`
- Calls Haiku to generate a 4–6 word title (spec below)
- Inserts into `store` with `status: 'active'`, `messageCount: 0`
- Returns `{ sessionId, title }`

### `updateSession(userId, sessionId, patch)`
- Partial update of `store.value` — accepts any subset of the value fields
- Always bumps `updated_at`
- Use this for status changes, `lastCrawlUrl` updates, `messageCount` increments

### `listSessions(userId)`
- Queries `store` where `prefix = userId`, ordered by `created_at DESC`
- Returns `SessionMeta[]`

### `appendCheckpoint(sessionId, userId, data)`
- Inserts into `checkpoints`
- Sets `parent_checkpoint_id` by querying the latest existing checkpoint for this session

### `loadSession(sessionId, userId)`
- Loads all checkpoints ordered by `turnIndex ASC`
- Returns `{ checkpoints, latestCrawlContext, lastCrawlUrl, messageHistory }`
  - `messageHistory`: reconstructed as Anthropic `MessageParam[]` from all checkpoints
  - `latestCrawlContext`: the most recent `crawlContext` from any `chat_with_crawl` checkpoint
  - `lastCrawlUrl`: from the most recent paused checkpoint (if any)

#### Haiku title generation

```typescript
// Called once when the session is created (first user message)
const prompt = `Generate a concise title (4-6 words, no punctuation, no quotes) for this conversation:

"${firstMessage}"

Reply with ONLY the title. No explanation. No punctuation at the end. Example: find trending repos on github`;

// model: 'claude-haiku-4-5-20251001', max_tokens: 30
// Trim, lowercase, truncate to 60 chars
// On any failure: use firstMessage.slice(0, 40).trim()
```

---

## 5. New unified API route (`/api/chat/route.ts`)

**The old `/api/crawl/route.ts` is replaced by `/api/chat/route.ts`.** Delete the old route after migration.

This is the single endpoint for all user interactions. It handles a full conversation turn: receive message → Sonnet thinks → optionally crawl → respond.

### Request body

```typescript
type ChatRequest = {
  message: string;       // the user's input
  userId: string;
  sessionId?: string;    // null/undefined on the very first message of a new session
};
```

### Response

SSE stream. All events use `data: <JSON>\n\n` format.

```typescript
type SSEEvent =
  | { type: 'session_created'; sessionId: string; title: string }
  | { type: 'thinking'; content: string }          // Sonnet is deciding what to do
  | { type: 'feed_entry'; data: FeedEntry }        // crawler is running
  | { type: 'crawl_started' }                      // model decided to crawl
  | { type: 'crawl_complete'; crawlContext: string }
  | { type: 'crawl_interrupted'; lastUrl: string } // stop was pressed
  | { type: 'chat_token'; token: string }          // Sonnet's text response streaming
  | { type: 'chat_done'; fullResponse: string }    // turn complete
  | { type: 'error'; message: string };
```

### Route handler logic

```
1. If no sessionId → createSession(userId, message) → emit session_created
2. Else → loadSession(sessionId, userId) → restore history + crawlContext + lastCrawlUrl

3. Build Sonnet system prompt:
   - Base system prompt (agent identity, tool descriptions)
   - If latestCrawlContext exists: inject it as context
   - If lastCrawlUrl exists AND last checkpoint has crawlInterrupted: inject interruption context

4. Build messages array:
   - messageHistory (all prior turns)
   - { role: 'user', content: message }

5. Call Sonnet with tools: [invoke_crawler, reply_to_user]
   - Sonnet either calls invoke_crawler OR streams a direct text reply

6. If Sonnet calls invoke_crawler(startUrl?, instructions):
   - emit crawl_started
   - update session status to 'crawling'
   - run the crawler loop (existing Playwright + Claude loop from crawler.ts)
   - stream feed_entry events as the crawler works
   - on natural completion: emit crawl_complete, save crawlContext
   - on AbortController signal (stop button): emit crawl_interrupted, save lastCrawlUrl
   - update session status to 'paused' or 'completed'
   - return crawl result to Sonnet as tool result
   - Sonnet then streams a summary/response → emit chat_token events → emit chat_done

7. If Sonnet streams text directly (no crawl needed):
   - emit chat_token for each token
   - emit chat_done when done

8. Save the full turn to checkpoints via appendCheckpoint
9. incrementMessageCount via updateSession
```

### Sonnet's tools in this route

Define exactly two tools for Sonnet to call:

**`invoke_crawler`**
```typescript
{
  name: 'invoke_crawler',
  description: `Launch the web crawler to browse websites and extract information.
Use this tool when the user's request requires retrieving live data from the web,
navigating to specific URLs, interacting with web pages, or gathering information
that you don't already have in the current conversation context.
Do NOT use this tool for questions you can answer from existing context or general knowledge.`,
  input_schema: {
    type: 'object',
    properties: {
      start_url: {
        type: 'string',
        description: 'The URL to start crawling from. Omit if the user has not specified a URL and you will determine the best starting point from context.'
      },
      instructions: {
        type: 'string',
        description: 'Detailed instructions for the crawler describing exactly what to find, navigate to, or extract.'
      },
      resume_from: {
        type: 'string',
        description: 'If resuming an interrupted crawl, the URL to resume from. Leave empty for a fresh crawl.'
      }
    },
    required: ['instructions']
  }
}
```

**`reply_to_user`** — used when Sonnet wants to respond directly without crawling.
```typescript
{
  name: 'reply_to_user',
  description: `Send a direct response to the user. Use this when you can answer
from existing context, general knowledge, or crawl results already in the conversation.
Do not use this if you need live web data to answer the question.`,
  input_schema: {
    type: 'object',
    properties: {
      response: { type: 'string', description: 'Your full response to the user.' }
    },
    required: ['response']
  }
}
```

> Note: In practice, `reply_to_user` can also be implemented as a regular streaming text response from Sonnet instead of a forced tool call — use whichever approach is cleaner with the Anthropic SDK's streaming API. The key requirement is that the same endpoint handles both branching paths.

### Interruption context injection

When the last checkpoint has `crawlInterrupted: true`, inject this into Sonnet's system prompt before the user message:

```
--- INTERRUPTION CONTEXT ---
The previous crawl was stopped by the user before completing.
Last URL visited: ${lastCrawlUrl}
The user's new message may ask you to continue, try a different approach, or do something unrelated.
Evaluate their intent and decide whether to resume crawling (use invoke_crawler with resume_from set),
start a fresh crawl, or respond from existing context.
--- END INTERRUPTION CONTEXT ---
```

---

## 6. Updated `FeedEntry` tags

Add these two tags to the existing union in `lib/types.ts`:

```typescript
| 'model_thinking'    // amber — Sonnet is deciding whether to crawl
| 'crawl_resumed'     // teal — crawler is resuming from interruption point
```

The `[model_thinking]` tag appears in the feed when Sonnet is evaluating the user's request before deciding to crawl. This makes the model's decision-making transparent to the user. Example feed entry:

```
[model_thinking] evaluating whether to crawl...
[model_thinking] user asked for live pricing — invoking crawler
[crawl_resumed]  resuming from https://example.com/pricing
[nav]            navigating to https://example.com/pricing
```

---

## 7. Stop button behavior (revised)

The stop button was previously described as cancelling the crawl session. It now works as follows:

- The stop button is **only visible while `appMode === 'crawling'`** (crawler is actively running)
- Pressing Stop fires the `AbortController` signal to the SSE handler
- The crawler halts at the next safe checkpoint in the Playwright loop
- The API emits `crawl_interrupted` with the last visited URL
- The session status updates to `'paused'` in `store`
- `appMode` returns to `'chat'`
- The feed shows a separator:
  ```
  ─────── crawl paused · type a message to continue ───────
  ```
  Styled in amber, monospace, centered
- The input field becomes active again immediately
- The model has already received the partial crawl results — it can use them in the next turn

The user can then:
- Ask the model to continue crawling → Sonnet calls `invoke_crawler` with `resume_from`
- Ask about what was found so far → Sonnet answers from partial `crawlContext`
- Start something entirely different → Sonnet ignores the interrupted state

---

## 8. Sonnet's system prompt (full revised spec)

Replace the existing system prompt spec in `crawler.ts` with this unified one for the new `/api/chat` route:

```
You are a conversational AI assistant with the ability to browse the web.

You have access to two tools:
1. invoke_crawler — use this to browse websites, extract data, navigate pages
2. reply_to_user — use this to respond directly from existing knowledge or context

Decision rules:
- If the user asks a question you can answer from general knowledge or the current conversation: use reply_to_user directly.
- If the user asks for live data, specific website content, or information from the web: use invoke_crawler.
- If a previous crawl was interrupted and the user's message implies they want to continue: use invoke_crawler with resume_from set to the last URL.
- If a previous crawl was interrupted and the user asks an unrelated question: use reply_to_user.
- Never ask the user "should I crawl?" — evaluate their intent and act.

When crawling:
- Pass clear, specific instructions to invoke_crawler
- The crawler will emit its progress as a live feed to the user — you do not need to narrate its actions
- After the crawl completes, you will receive the extracted content as a tool result
- Summarize or answer based on that content using reply_to_user

When responding:
- Be concise and direct
- If crawl results are in context, reference them specifically
- If asked about a past crawl, answer from the crawlContext already in the conversation
- Use print() sparingly — only for meaningful status updates during crawling

[CRAWL CONTEXT INJECTED HERE IF AVAILABLE]
[INTERRUPTION CONTEXT INJECTED HERE IF APPLICABLE]
```

---

## 9. UI changes (minimal — most stays the same)

### Input bar

The input bar is visually unchanged except:
- Placeholder is always: `"Send a message..."` — never changes
- The menu button on the left stays as specified previously
- Stop button: visible only during `appMode === 'crawling'`
- Send button: always visible; disabled during `appMode === 'crawling'`

### Feed separators

Replace the previous separator spec with these:

| Event | Separator text | Color |
|---|---|---|
| Crawl starts within a turn | `─── crawling the web ───` | Purple |
| Crawl completes | `─── crawl complete ───` | Green |
| Crawl interrupted (stop pressed) | `─── crawl paused · type to continue ───` | Amber |
| Session loaded from history | `─── session loaded ───` | Teal |

These replace the "chat mode active" separators. Since chat is always the mode, there is no need to announce it.

### `[model_thinking]` feed entries

When Sonnet receives the user's message and is deciding what to do (before any crawl starts or before replying), emit a brief `[model_thinking]` feed entry. This appears for approximately the duration of Sonnet's tool-use decision. Example:

```
12:01:04  [model_thinking] reading your message...
```

Once Sonnet either calls `invoke_crawler` or starts streaming a reply, this entry can be replaced or a new entry appended. The goal is to prevent the UI from appearing frozen during the model's decision phase.

### Top bar model indicator

The top bar already shows which model is active. Update it to show:
- `chat · sonnet` (purple pill) — during a normal chat turn
- `crawling · sonnet` (purple pill, pulsing) — during `appMode === 'crawling'`
- `delegating · haiku` (teal pill) — when the crawler has delegated a sub-task to Haiku

---

## 10. Loading a past session (revised)

When the user clicks a session in the side menu:

1. Close the side menu
2. Clear the live feed
3. Show: `[nav] loading session: "${sessionTitle}"`
4. Call `GET /api/sessions/${sessionId}?userId=${userId}`
5. Render all historical `feedEntries` from checkpoints into the live feed
6. Show separator: `─── session loaded ───` (teal)
7. Set `currentSessionId`, `appMode = 'chat'`
8. Store `latestCrawlContext` and `lastCrawlUrl` in state
9. If the session's status is `'paused'`, add an additional note in amber:
   ```
   [model_thinking] previous crawl was paused at ${lastCrawlUrl}
   ```
   This primes the user's expectation that the model can resume if asked
10. Focus the input field

---

## 11. Session title generation — revised trigger

The title is generated when the **first message** is sent, regardless of whether a crawl happens. This is because sessions now start as chat sessions and may or may not trigger a crawl.

The Haiku title prompt should reflect this:

```typescript
const prompt = `Generate a concise title (4-6 words, no punctuation, no quotes) for this conversation:

"${firstMessage}"

Reply with ONLY the title. No explanation. No punctuation at the end. Example: compare pricing across saas tools`;
```

The title describes the user's intent, not specifically a crawl task.

---

## 12. Updated file structure

New files to create:

```
apps/web/
├── app/
│   └── api/
│       ├── chat/
│       │   └── route.ts                   # Unified chat+crawl SSE endpoint (replaces /api/crawl)
│       └── sessions/
│           ├── route.ts                   # GET /api/sessions?userId=...
│           └── [sessionId]/
│               └── route.ts               # GET /api/sessions/:sessionId?userId=...
├── components/
│   ├── SideMenu.tsx                       # Animated history panel (unchanged spec)
│   └── SessionItem.tsx                    # Individual session row
└── lib/
    ├── supabase.ts                        # Supabase client singleton
    ├── session-manager.ts                 # Session CRUD + Haiku title generation
    └── user-identity.ts                   # Browser userId (CLIENT ONLY)
```

Files to delete:
- `app/api/crawl/route.ts` — replaced by `/api/chat/route.ts`

Existing files to modify:

| File | What changes |
|---|---|
| `app/page.tsx` | Replace `idle/crawling/chat` state with `chat/crawling`; add `userId`, `sessionId`, `crawlContext`, `lastCrawlUrl`; point fetch to `/api/chat`; handle all new SSE events |
| `components/InputBar.tsx` | Add menu button left of input; stop button only during `crawling`; placeholder always `"Send a message..."` |
| `lib/types.ts` | Replace `AppMode`, add `SessionMeta`, full `SSEEvent` union, new feed tags |
| `lib/crawler.ts` | Expose crawler as a callable function (not a route handler); accept `AbortController`; return `{ crawlContext, lastUrl, interrupted }` |
| `CLAUDE.md` | Replace old architecture section with new one (below) |
| `.env.example` | Add Supabase vars |

---

## 13. CLAUDE.md — replacement architecture section

Replace the existing architecture decisions block in `CLAUDE.md` with:

```markdown
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
```

---

## 14. Implementation order

Build in this exact sequence. Test each step before proceeding:

1. **Dependencies** — add `@supabase/supabase-js` and `nanoid`; update `.env.example`
2. **Types** — rewrite `lib/types.ts` with new `AppMode`, `SessionMeta`, `SSEEvent` union, updated feed tags
3. **Supabase client** — create `lib/supabase.ts`; verify connection
4. **User identity** — create `lib/user-identity.ts`; initialize in `page.tsx` via `useEffect`
5. **Refactor crawler** — convert `crawler.ts` from a route handler into a plain async function: `runCrawler(instructions, startUrl, resumeFrom, signal, onEvent) => Promise<{ crawlContext, lastUrl, interrupted }>`. This is the foundation for the new route.
6. **Session manager** — create `lib/session-manager.ts`; test `createSession` + Haiku title in isolation
7. **New `/api/chat` route** — implement the unified SSE handler: session creation, Sonnet tool dispatch, crawler invocation, chat streaming, checkpoint saving
8. **Sessions API routes** — `GET /api/sessions` and `GET /api/sessions/[sessionId]`
9. **Delete `/api/crawl`** — remove the old route after verifying `/api/chat` works end-to-end
10. **SideMenu component** — build animated panel with session list, skeleton, empty state
11. **InputBar update** — add menu button; wire stop button to `crawling` mode only; fix placeholder
12. **Wire `page.tsx`** — new state shape, new SSE event handling, new fetch target
13. **End-to-end test** — flow 1: message that needs crawl → model invokes crawler → completes → follow-up question answered from context. Flow 2: stop mid-crawl → paused → next message resumes. Flow 3: load past session → ask about it.