export type FeedTag =
  | 'nav'
  | 'ok'
  | 'think'
  | 'act'
  | 'extract'
  | 'error'
  | 'haiku'
  | 'done';

export type ModelName = 'sonnet' | 'haiku';

export interface FeedEntry {
  id: string;
  timestamp: string;
  tag: FeedTag;
  message: string;
  model: ModelName;
  metadata?: Record<string, unknown>;
}
