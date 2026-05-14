'use client';

import type { FeedEntry } from '@/lib/types';

const TAG_LABELS: Record<FeedEntry['tag'], string> = {
  nav: 'nav',
  ok: 'ok',
  think: 'think',
  act: 'act',
  extract: 'extract',
  error: 'error',
  haiku: 'haiku',
  done: 'done',
  user: 'you',
  model_thinking: 'model',
  crawl_resumed: 'resume',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

export default function FeedEntryRow({ entry }: { entry: FeedEntry }) {
  return (
    <div className="feed-entry mono flex gap-3 text-xs leading-relaxed py-0.5 group">
      <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: '6ch', userSelect: 'none' }}>
        {formatTime(entry.timestamp)}
      </span>
      <span className={`tag-${entry.tag} font-medium`} style={{ minWidth: '8ch' }}>
        [{TAG_LABELS[entry.tag] ?? entry.tag}]
      </span>
      <span
        style={{
          color: entry.tag === 'error'
            ? 'var(--red)'
            : entry.tag === 'done'
            ? 'var(--emerald)'
            : entry.tag === 'user'
            ? 'var(--purple)'
            : entry.tag === 'model_thinking'
            ? 'var(--amber)'
            : entry.tag === 'crawl_resumed'
            ? 'var(--teal)'
            : 'rgba(255,255,255,0.75)',
          wordBreak: 'break-word',
          flex: 1,
        }}
      >
        {entry.message}
      </span>
    </div>
  );
}
