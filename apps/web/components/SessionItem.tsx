'use client';

import type { SessionMeta } from '@/lib/types';

interface Props {
  session: SessionMeta;
  active: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<SessionMeta['status'], string> = {
  active: '#10b981',
  crawling: '#8b5cf6',
  paused: '#f59e0b',
  completed: '#10b981',
  error: '#ef4444',
};

export default function SessionItem({ session, active, onClick }: Props) {
  const color = STATUS_COLORS[session.status];
  const date = new Date(session.createdAt);
  const label = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        borderRadius: '6px',
        background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
        border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {session.title}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', paddingLeft: '14px' }}>
        {label} · {session.messageCount} {session.messageCount === 1 ? 'turn' : 'turns'}
        {session.status === 'paused' && ' · paused'}
      </div>
    </button>
  );
}
