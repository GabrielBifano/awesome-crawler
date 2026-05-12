import { chromium, Browser, Page } from 'playwright';
import type Anthropic from '@anthropic-ai/sdk';
import { client, SONNET, callHaiku } from './model-router';
import { extractContent, extractStructure } from './html-cleaner';
import type { FeedEntry } from './types';

export type Emit = (entry: Omit<FeedEntry, 'id' | 'timestamp' | 'model'> & { model?: FeedEntry['model'] }) => void;

export interface CrawlResult {
  crawlContext: string;
  lastUrl: string;
  interrupted: boolean;
}

const SYSTEM_PROMPT = `You are an autonomous web crawling agent with access to a real Chromium browser via Playwright.

## Available tools
- navigate(url) — navigate to a URL and wait for page to load
- click(selector) — click an element by CSS selector
- type(selector, text) — type text into an input field
- scroll(direction, amount) — scroll the page (direction: up/down/left/right, amount in pixels)
- screenshot() — take a full-page screenshot (returns base64 image)
- get_html() — get the page's cleaned content as Markdown (Readability + Turndown)
- get_raw_html(selector?) — get structural HTML of the page or a specific element
- evaluate(js) — execute JavaScript in the page context
- wait(ms) — pause for a given duration in milliseconds
- wait_for_selector(selector, timeout?) — wait for an element to appear
- go_back() — go to the previous page
- get_url() — get the current page URL
- print(message) — send a message to the user's live feed (use sparingly — only for meaningful status updates)
- delegate_to_haiku(task, context) — delegate simple extraction or summarization to a cheaper model
- task_complete(summary) — declare the task finished and provide a final summary

## Behavior rules
1. Reason step-by-step before taking actions. Think through what you see and what you need to do.
2. For visual decisions (which button to click, what the page looks like), call screenshot() AND get_raw_html() together.
3. Use print() sparingly — only when you have something meaningful to tell the user, not for internal reasoning.
4. Delegate simple tasks to Haiku: extracting data from already-loaded content, parsing tables, summarizing text when the structure is known.
5. Handle errors gracefully — if an action fails, try an alternative approach (different selector, scrolling to find the element, etc.).
6. After every navigation or form submission, wait for the page to stabilize before taking the next action.
7. Track your progress. Do not loop indefinitely. If you are stuck, try a different approach or report the issue.
8. Respect robots.txt. Do not submit forms containing personal or sensitive data unless explicitly instructed.
9. When the task is complete, call task_complete() with a summary of what was accomplished.
10. Always call get_url() when you need to know your current location.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a URL and wait for the page to load',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to navigate to' } },
      required: ['url'],
    },
  },
  {
    name: 'click',
    description: 'Click an element by CSS selector',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector of the element to click' } },
      required: ['selector'],
    },
  },
  {
    name: 'type',
    description: 'Type text into an input field',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input field' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        amount: { type: 'number', description: 'Pixels to scroll' },
      },
      required: ['direction', 'amount'],
    },
  },
  {
    name: 'screenshot',
    description: 'Take a full-page screenshot',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_html',
    description: 'Get the current page content as cleaned Markdown (best for reading/understanding content)',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_raw_html',
    description: 'Get the structural HTML of the page or a specific element (best for finding selectors)',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to scope to (optional, defaults to full page)' },
      },
    },
  },
  {
    name: 'evaluate',
    description: 'Execute JavaScript in the page context',
    input_schema: {
      type: 'object',
      properties: { js: { type: 'string', description: 'JavaScript code to execute' } },
      required: ['js'],
    },
  },
  {
    name: 'wait',
    description: 'Wait for a given duration',
    input_schema: {
      type: 'object',
      properties: { ms: { type: 'number', description: 'Milliseconds to wait' } },
      required: ['ms'],
    },
  },
  {
    name: 'wait_for_selector',
    description: 'Wait for an element to appear in the DOM',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default 10000)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'go_back',
    description: 'Navigate to the previous page',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_url',
    description: 'Get the current page URL',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'print',
    description: 'Send a message to the user\'s live feed. Use sparingly — only for meaningful status updates.',
    input_schema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Message to display to the user' } },
      required: ['message'],
    },
  },
  {
    name: 'delegate_to_haiku',
    description: 'Delegate a simple extraction or summarization task to a cheaper model (Haiku)',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What to extract or summarize' },
        context: { type: 'string', description: 'The content/data to process' },
      },
      required: ['task', 'context'],
    },
  },
  {
    name: 'task_complete',
    description: 'Declare the task finished',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'Summary of what was accomplished' } },
      required: ['summary'],
    },
  },
];

export async function runCrawler(
  instructions: string,
  startUrl: string | undefined,
  resumeFrom: string | undefined,
  signal: AbortSignal,
  onEvent: Emit,
): Promise<CrawlResult> {
  let browser: Browser | null = null;
  let lastUrl = '';
  const contentParts: string[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const initialUrl = resumeFrom ?? startUrl;
    if (initialUrl) {
      onEvent({ tag: 'crawl_resumed' as const, message: `resuming from ${initialUrl}` });
      await page.goto(initialUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await stabilize(page);
      lastUrl = page.url();
    }

    const fullInstruction = resumeFrom
      ? `Resume crawling from ${resumeFrom}. Original instructions: ${instructions}`
      : startUrl
        ? `Start at ${startUrl}. Instructions: ${instructions}`
        : instructions;

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: fullInstruction },
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 50;

    while (iterations < MAX_ITERATIONS && !signal.aborted) {
      iterations++;

      onEvent({ tag: 'think', message: 'Planning next action...' });

      const response = await client.messages.create({
        model: SONNET,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          onEvent({ tag: 'done', message: textBlock.text });
          contentParts.push(textBlock.text);
        } else {
          onEvent({ tag: 'done', message: 'Task finished.' });
        }
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        onEvent({ tag: 'error', message: `Unexpected stop reason: ${response.stop_reason}` });
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        if (signal.aborted) break;

        const toolName = block.name;
        const toolInput = block.input as Record<string, unknown>;
        let toolResult: string | Anthropic.ImageBlockParam[] = '';
        let isDone = false;

        try {
          switch (toolName) {
            case 'navigate': {
              const url = toolInput.url as string;
              onEvent({ tag: 'nav', message: `Navigating to ${url}` });
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
              await stabilize(page);
              lastUrl = page.url();
              if (lastUrl !== url) {
                onEvent({ tag: 'ok', message: `Redirected to ${lastUrl}` });
              } else {
                onEvent({ tag: 'ok', message: `Loaded ${lastUrl}` });
              }
              toolResult = `Navigated to ${lastUrl}`;
              break;
            }

            case 'click': {
              const selector = toolInput.selector as string;
              onEvent({ tag: 'act', message: `Clicking ${selector}` });
              await page.click(selector, { timeout: 10_000 });
              await stabilize(page);
              lastUrl = page.url();
              toolResult = `Clicked ${selector}`;
              break;
            }

            case 'type': {
              const selector = toolInput.selector as string;
              const text = toolInput.text as string;
              onEvent({ tag: 'act', message: `Typing into ${selector}` });
              await page.fill(selector, text, { timeout: 10_000 });
              toolResult = `Typed into ${selector}`;
              break;
            }

            case 'scroll': {
              const direction = toolInput.direction as string;
              const amount = toolInput.amount as number;
              onEvent({ tag: 'act', message: `Scrolling ${direction} ${amount}px` });
              const x = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
              const y = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
              await page.evaluate(`window.scrollBy(${x}, ${y})`);
              toolResult = `Scrolled ${direction} ${amount}px`;
              break;
            }

            case 'screenshot': {
              onEvent({ tag: 'act', message: 'Taking screenshot' });
              const buf = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
              const b64 = buf.toString('base64');
              toolResult = [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
                },
              ];
              break;
            }

            case 'get_html': {
              onEvent({ tag: 'extract', message: 'Extracting page content' });
              const html = await page.content();
              const url = page.url();
              const md = extractContent(html, url);
              contentParts.push(md);
              toolResult = md;
              break;
            }

            case 'get_raw_html': {
              const selector = toolInput.selector as string | undefined;
              onEvent({ tag: 'extract', message: selector ? `Getting HTML for ${selector}` : 'Getting structural HTML' });
              let html: string;
              if (selector) {
                const el = await page.$(selector);
                html = el ? await el.innerHTML() : '<not found>';
              } else {
                html = await page.content();
              }
              toolResult = extractStructure(html);
              break;
            }

            case 'evaluate': {
              const js = toolInput.js as string;
              onEvent({ tag: 'act', message: `Evaluating JS: ${js.slice(0, 60)}` });
              const result = await page.evaluate(js);
              toolResult = JSON.stringify(result);
              break;
            }

            case 'wait': {
              const ms = toolInput.ms as number;
              onEvent({ tag: 'act', message: `Waiting ${ms}ms` });
              await page.waitForTimeout(ms);
              toolResult = `Waited ${ms}ms`;
              break;
            }

            case 'wait_for_selector': {
              const selector = toolInput.selector as string;
              const timeout = (toolInput.timeout as number) ?? 10_000;
              onEvent({ tag: 'act', message: `Waiting for ${selector}` });
              await page.waitForSelector(selector, { timeout });
              toolResult = `Selector found: ${selector}`;
              break;
            }

            case 'go_back': {
              onEvent({ tag: 'nav', message: 'Going back' });
              await page.goBack({ timeout: 10_000 });
              await stabilize(page);
              lastUrl = page.url();
              toolResult = `Now at ${lastUrl}`;
              break;
            }

            case 'get_url': {
              lastUrl = page.url();
              toolResult = lastUrl;
              break;
            }

            case 'print': {
              const message = toolInput.message as string;
              onEvent({ tag: 'act', message });
              toolResult = 'Message displayed to user';
              break;
            }

            case 'delegate_to_haiku': {
              const task = toolInput.task as string;
              const context = toolInput.context as string;
              onEvent({ tag: 'haiku', message: `Delegating to Haiku: ${task.slice(0, 80)}` });
              const result = await callHaiku(task, context);
              contentParts.push(result);
              toolResult = result;
              break;
            }

            case 'task_complete': {
              const summary = toolInput.summary as string;
              onEvent({ tag: 'done', message: summary });
              contentParts.push(summary);
              isDone = true;
              toolResult = 'Task marked complete';
              break;
            }

            default:
              toolResult = `Unknown tool: ${toolName}`;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          onEvent({ tag: 'error', message: `${toolName} failed: ${msg}` });
          toolResult = `Error: ${msg}`;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: Array.isArray(toolResult)
            ? toolResult
            : [{ type: 'text', text: toolResult }],
        });

        if (isDone) {
          messages.push({ role: 'user', content: toolResults });
          return { crawlContext: contentParts.join('\n\n'), lastUrl, interrupted: false };
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (signal.aborted) {
      onEvent({ tag: 'error', message: 'Crawl stopped by user' });
      return { crawlContext: contentParts.join('\n\n'), lastUrl, interrupted: true };
    }

    if (iterations >= MAX_ITERATIONS) {
      onEvent({ tag: 'error', message: `Reached max iterations (${MAX_ITERATIONS})` });
    }

    return { crawlContext: contentParts.join('\n\n'), lastUrl, interrupted: false };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function stabilize(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 });
  } catch {
    // page may already be loaded
  }
  await page.waitForTimeout(300);
}
