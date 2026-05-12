export type { FeedEntry, FeedTag, ModelName } from '@awesome-crawler/shared';

export type AppMode = 'chat' | 'crawling';

export interface SessionMeta {
  sessionId: string;
  title: string;
  status: 'active' | 'crawling' | 'paused' | 'completed' | 'error';
  firstMessage: string;
  createdAt: string;
  messageCount: number;
  lastCrawlUrl?: string;
}

export type SSEEvent =
  | { type: 'session_created'; sessionId: string; title: string }
  | { type: 'thinking'; content: string }
  | { type: 'feed_entry'; data: import('@awesome-crawler/shared').FeedEntry }
  | { type: 'crawl_started' }
  | { type: 'crawl_complete'; crawlContext: string }
  | { type: 'crawl_interrupted'; lastUrl: string }
  | { type: 'chat_token'; token: string }
  | { type: 'chat_done'; fullResponse: string }
  | { type: 'error'; message: string };

export interface ChatRequest {
  message: string;
  userId: string;
  sessionId?: string;
}

export type ToolName =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'screenshot'
  | 'get_html'
  | 'get_raw_html'
  | 'evaluate'
  | 'wait'
  | 'wait_for_selector'
  | 'go_back'
  | 'get_url'
  | 'print'
  | 'delegate_to_haiku'
  | 'task_complete';

export interface ToolInput {
  navigate: { url: string };
  click: { selector: string };
  type: { selector: string; text: string };
  scroll: { direction: 'up' | 'down' | 'left' | 'right'; amount: number };
  screenshot: Record<string, never>;
  get_html: Record<string, never>;
  get_raw_html: { selector?: string };
  evaluate: { js: string };
  wait: { ms: number };
  wait_for_selector: { selector: string; timeout?: number };
  go_back: Record<string, never>;
  get_url: Record<string, never>;
  print: { message: string };
  delegate_to_haiku: { task: string; context: string };
  task_complete: { summary: string };
}
