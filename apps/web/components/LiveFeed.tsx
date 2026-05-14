'use client';

import { useEffect, useRef } from 'react';
import type { FeedEntry } from '@/lib/types';
import FeedEntryRow from './FeedEntry';
import AgentGroup from './AgentGroup';

const CORE_AGENT = new Set<FeedEntry['tag']>(['nav', 'think', 'act', 'extract', 'haiku', 'crawl_resumed']);
const MAYBE_AGENT = new Set<FeedEntry['tag']>(['ok', 'error']);

type FeedGroup =
  | { kind: 'single'; entry: FeedEntry }
  | { kind: 'agent'; id: string; entries: FeedEntry[] };

function groupEntries(entries: FeedEntry[]): FeedGroup[] {
  const groups: FeedGroup[] = [];
  let current: FeedEntry[] | null = null;

  for (const entry of entries) {
    if (CORE_AGENT.has(entry.tag)) {
      if (!current) current = [];
      current.push(entry);
    } else if (MAYBE_AGENT.has(entry.tag)) {
      if (current) {
        current.push(entry);
      } else {
        groups.push({ kind: 'single', entry });
      }
    } else {
      if (current) {
        groups.push({ kind: 'agent', id: current[0].id, entries: current });
        current = null;
      }
      groups.push({ kind: 'single', entry });
    }
  }

  if (current) {
    groups.push({ kind: 'agent', id: current[0].id, entries: current });
  }

  return groups;
}

interface LiveFeedProps {
  entries: FeedEntry[];
}

export default function LiveFeed({ entries }: LiveFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const groups = groupEntries(entries);

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
          Send a message to start.
        </div>
      ) : (
        groups.map((group) =>
          group.kind === 'agent' ? (
            <AgentGroup key={group.id} entries={group.entries} />
          ) : (
            <FeedEntryRow key={group.entry.id} entry={group.entry} />
          )
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
