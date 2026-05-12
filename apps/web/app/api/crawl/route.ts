import { NextRequest } from 'next/server';
import { runCrawler, type Emit } from '@/lib/crawler';
import type { FeedEntry } from '@/lib/types';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { instruction } = await req.json();

  if (!instruction || typeof instruction !== 'string') {
    return new Response(JSON.stringify({ error: 'instruction required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const emit: Emit = (entry) => {
        const full: FeedEntry = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          model: entry.model ?? 'sonnet',
          tag: entry.tag,
          message: entry.message,
          ...(entry.metadata ? { metadata: entry.metadata } : {}),
        };
        const data = `data: ${JSON.stringify(full)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      runCrawler(instruction, emit, abortController.signal)
        .catch((err) => {
          emit({
            tag: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        })
        .finally(() => {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        });
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
