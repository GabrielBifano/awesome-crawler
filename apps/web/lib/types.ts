export type { FeedEntry, FeedTag, ModelName } from '@awesome-crawler/shared';

export interface CrawlRequest {
  instruction: string;
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
