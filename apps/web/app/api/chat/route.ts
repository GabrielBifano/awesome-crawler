import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { client, SONNET } from '@/lib/model-router';
import { runCrawler } from '@/lib/crawler';
import { createSession, updateSession, loadSession, appendCheckpoint } from '@/lib/session-manager';
import type { FeedEntry } from '@awesome-crawler/shared';
import type { ChatRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CHAT_SYSTEM_PROMPT = `You are a conversational AI assistant with the ability to browse the web.

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
- Use print() sparingly — only for meaningful status updates during crawling`;

const CHAT_TOOLS: Anthropic.Tool[] = [
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
          description: 'The URL to start crawling from. Omit if the user has not specified a URL and you will determine the best starting point from context.',
        },
        instructions: {
          type: 'string',
          description: 'Detailed instructions for the crawler describing exactly what to find, navigate to, or extract.',
        },
        resume_from: {
          type: 'string',
          description: 'If resuming an interrupted crawl, the URL to resume from. Leave empty for a fresh crawl.',
        },
      },
      required: ['instructions'],
    },
  },
  {
    name: 'reply_to_user',
    description: `Send a direct response to the user. Use this when you can answer
from existing context, general knowledge, or crawl results already in the conversation.
Do not use this if you need live web data to answer the question.`,
    input_schema: {
      type: 'object',
      properties: {
        response: { type: 'string', description: 'Your full response to the user.' },
      },
      required: ['response'],
    },
  },
];

function makeFeedEntry(
  entry: Omit<FeedEntry, 'id' | 'timestamp' | 'model'> & { model?: FeedEntry['model'] },
): FeedEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    model: entry.model ?? 'sonnet',
    tag: entry.tag,
    message: entry.message,
    ...(entry.metadata ? { metadata: entry.metadata } : {}),
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequest;
  const { message, userId, sessionId: incomingSessionId } = body;

  if (!message || !userId) {
    return new Response(JSON.stringify({ error: 'message and userId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      (async () => {
        let sessionId = incomingSessionId ?? '';
        let messageHistory: Anthropic.MessageParam[] = [];
        let latestCrawlContext: string | undefined;
        let lastCrawlUrl: string | undefined;
        let turnIndex = 0;
        const collectedFeedEntries: FeedEntry[] = [];

        try {
          // 1. Session init
          if (!sessionId) {
            const { sessionId: newId, title } = await createSession(userId, message);
            sessionId = newId;
            send({ type: 'session_created', sessionId, title });
          } else {
            const loaded = await loadSession(sessionId, userId);
            messageHistory = loaded.messageHistory;
            latestCrawlContext = loaded.latestCrawlContext;
            lastCrawlUrl = loaded.lastCrawlUrl;
            turnIndex = loaded.checkpoints.length;
          }

          // 2. Build system prompt
          let systemPrompt = CHAT_SYSTEM_PROMPT;
          if (latestCrawlContext) {
            systemPrompt += `\n\n--- CRAWL CONTEXT ---\n${latestCrawlContext}\n--- END CRAWL CONTEXT ---`;
          }
          if (lastCrawlUrl) {
            systemPrompt += `\n\n--- INTERRUPTION CONTEXT ---
The previous crawl was stopped by the user before completing.
Last URL visited: ${lastCrawlUrl}
The user's new message may ask you to continue, try a different approach, or do something unrelated.
Evaluate their intent and decide whether to resume crawling (use invoke_crawler with resume_from set),
start a fresh crawl, or respond from existing context.
--- END INTERRUPTION CONTEXT ---`;
          }

          // 3. Build messages
          const messages: Anthropic.MessageParam[] = [
            ...messageHistory,
            { role: 'user', content: message },
          ];

          // User message entry — saved for checkpoint restore; not emitted (client already added it)
          collectedFeedEntries.push(makeFeedEntry({ tag: 'user', message }));

          // 4. Model thinking indicator
          send({ type: 'thinking', content: 'reading your message...' });
          const thinkingEntry = makeFeedEntry({ tag: 'model_thinking', message: 'reading your message...' });
          collectedFeedEntries.push(thinkingEntry);
          send({ type: 'feed_entry', data: thinkingEntry });

          // 5. Call Sonnet
          const response = await client.messages.create({
            model: SONNET,
            max_tokens: 4096,
            system: systemPrompt,
            tools: CHAT_TOOLS,
            messages,
          });

          let assistantResponse = '';
          let crawlContext: string | undefined;
          let crawlInterrupted = false;
          let finalLastCrawlUrl: string | undefined;
          let checkpointType: 'chat' | 'chat_with_crawl' = 'chat';

          // 6. Dispatch
          const toolBlock = response.content.find((b) => b.type === 'tool_use');

          if (toolBlock && toolBlock.type === 'tool_use') {
            const toolName = toolBlock.name;
            const toolInput = toolBlock.input as Record<string, unknown>;

            if (toolName === 'invoke_crawler') {
              checkpointType = 'chat_with_crawl';
              const startUrl = toolInput.start_url as string | undefined;
              const instructions = toolInput.instructions as string;
              const resumeFrom = toolInput.resume_from as string | undefined;

              const crawlStartEntry = makeFeedEntry({ tag: 'nav', message: '─── crawling the web ───' });
              collectedFeedEntries.push(crawlStartEntry);
              send({ type: 'crawl_started' });
              send({ type: 'feed_entry', data: crawlStartEntry });

              await updateSession(userId, sessionId, { status: 'crawling' });

              const crawlResult = await runCrawler(
                instructions,
                startUrl,
                resumeFrom,
                abortController.signal,
                (entry) => {
                  const full = makeFeedEntry(entry);
                  collectedFeedEntries.push(full);
                  send({ type: 'feed_entry', data: full });
                },
              );

              crawlContext = crawlResult.crawlContext;
              crawlInterrupted = crawlResult.interrupted;
              finalLastCrawlUrl = crawlResult.lastUrl || undefined;

              if (crawlInterrupted) {
                send({ type: 'crawl_interrupted', lastUrl: finalLastCrawlUrl ?? '' });
                const pausedEntry = makeFeedEntry({
                  tag: 'model_thinking',
                  message: '─── crawl paused · type to continue ───',
                });
                collectedFeedEntries.push(pausedEntry);
                send({ type: 'feed_entry', data: pausedEntry });
                await updateSession(userId, sessionId, { status: 'paused', lastCrawlUrl: finalLastCrawlUrl });
                assistantResponse = `Crawl was interrupted at ${finalLastCrawlUrl ?? 'unknown URL'}.`;
              } else {
                send({ type: 'crawl_complete', crawlContext: crawlResult.crawlContext });
                const completeEntry = makeFeedEntry({ tag: 'ok', message: '─── crawl complete ───' });
                collectedFeedEntries.push(completeEntry);
                send({ type: 'feed_entry', data: completeEntry });

                // Sonnet summarizes crawl results
                const summaryMessages: Anthropic.MessageParam[] = [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: toolBlock.id,
                        content: crawlResult.crawlContext
                          ? `Crawl complete. Extracted content:\n\n${crawlResult.crawlContext}`
                          : 'Crawl complete. No content was extracted.',
                      } as Anthropic.ToolResultBlockParam,
                    ],
                  },
                ];

                const summaryResponse = await client.messages.create({
                  model: SONNET,
                  max_tokens: 4096,
                  system: systemPrompt,
                  tools: CHAT_TOOLS,
                  messages: summaryMessages,
                });

                // Extract reply_to_user or text
                for (const block of summaryResponse.content) {
                  if (block.type === 'text') {
                    assistantResponse += block.text;
                    send({ type: 'chat_token', token: block.text });
                  } else if (block.type === 'tool_use' && block.name === 'reply_to_user') {
                    const replyText = (block.input as { response: string }).response;
                    assistantResponse += replyText;
                    send({ type: 'chat_token', token: replyText });
                  }
                }

                await updateSession(userId, sessionId, { status: 'completed' });
              }
            } else if (toolName === 'reply_to_user') {
              const replyText = (toolInput as { response: string }).response;
              assistantResponse = replyText;
              send({ type: 'chat_token', token: replyText });
            }
          } else {
            // Direct text response
            for (const block of response.content) {
              if (block.type === 'text') {
                assistantResponse += block.text;
                send({ type: 'chat_token', token: block.text });
              }
            }
          }

          send({ type: 'chat_done', fullResponse: assistantResponse });

          // Done entry — saved for checkpoint restore; not emitted (client builds it from chat_token accumulation)
          if (assistantResponse) {
            collectedFeedEntries.push(makeFeedEntry({ tag: 'done', message: assistantResponse }));
          }

          // 7. Save checkpoint
          await appendCheckpoint(
            sessionId,
            userId,
            checkpointType,
            {
              userMessage: message,
              assistantResponse,
              feedEntries: collectedFeedEntries,
              crawlContext,
              crawlInterrupted,
              lastCrawlUrl: finalLastCrawlUrl,
            },
            turnIndex,
          );

          await updateSession(userId, sessionId, {
            messageCount: turnIndex + 1,
            ...(crawlInterrupted ? {} : { status: 'active' }),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          send({ type: 'error', message: msg });
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      })();
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
