'use client';

import { useEffect, useRef } from 'react';
import type { FeedEntry } from '@/lib/types';
import FeedEntryRow from './FeedEntry';

interface LiveFeedProps {
  entries: FeedEntry[];
}

export default function LiveFeed({ entries }: LiveFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {entries.length === 0 ? (
        <div
          className="mono"
          style={{
            color: 'rgba(255,255,255,0.15)',
            fontSize: 12,
            marginTop: 'auto',
            marginBottom: 'auto',
            textAlign: 'center',
          }}
        >
          Enter an instruction below to start crawling.
        </div>
      ) : (
        entries.map((entry) => <FeedEntryRow key={entry.id} entry={entry} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
