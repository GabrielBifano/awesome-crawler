'use client';

import { useState, useRef, useEffect } from 'react';
import type { FeedEntry } from '@/lib/types';
import FeedEntryRow from './FeedEntry';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

export default function AgentGroup({ entries }: { entries: FeedEntry[] }) {
  const [expanded, setExpanded] = useState(true);
  const groupRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEntry = entries[entries.length - 1];

  useEffect(() => {
    if (!expanded) return;
    // Scroll inner container to latest entry
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Scroll outer LiveFeed minimally to keep group bottom in view
    groupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries.length, expanded]);

  return (
    <div
      ref={groupRef}
      className="mono"
      style={{
        border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: '6px',
        margin: '2px 0',
        background: 'rgba(245,158,11,0.02)',
        overflow: 'hidden',
        flexShrink: 0,
        minHeight: '28px',
      }}
    >
      {/* Header — always visible */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '3px 8px',
        fontSize: '12px',
        lineHeight: 1.6,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: '6ch', userSelect: 'none' }}>
          {formatTime(entries[0].timestamp)}
        </span>
        <span style={{ minWidth: '8ch', color: 'var(--amber)', fontWeight: 500 }}>
          [agent]
        </span>
        <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          {entries.length} {entries.length === 1 ? 'step' : 'steps'}
        </span>
        {!expanded && lastEntry && (
          <span style={{
            flex: 1,
            color: 'rgba(255,255,255,0.35)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            · {lastEntry.message}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            width: 20,
            height: 20,
            borderRadius: '4px',
            background: 'transparent',
            border: '1px solid rgba(245,158,11,0.2)',
            color: 'var(--amber)',
            fontSize: '9px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
            padding: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {/*
        Bounded max-height animation: inner container caps at 280px, so outer animates
        0 → 290px over a known range — no "stuck at unknown height" issue.
        grid-template-rows: 1fr was unreliable inside a flex column with constrained height
        (1fr distributes available free space which can be 0, collapsing the row).
      */}
      <div style={{
        maxHeight: expanded ? '290px' : '0px',
        minHeight: expanded ? '28px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.18s ease, opacity 0.15s ease',
      }}>
        <div
          ref={scrollRef}
          style={{
            overflowY: 'scroll',
            maxHeight: '280px',
            borderTop: '1px solid rgba(245,158,11,0.08)',
            padding: '4px 0',
          }}
        >
          {entries.map(entry => <FeedEntryRow key={entry.id} entry={entry} />)}
        </div>
      </div>
    </div>
  );
}
