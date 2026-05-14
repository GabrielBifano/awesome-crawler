'use client';

import type { SessionMeta } from '@/lib/types';

interface Props {
  session: SessionMeta;
  active: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const STATUS_COLORS: Record<SessionMeta['status'], string> = {
  active: '#10b981',
  crawling: '#8b5cf6',
  paused: '#f59e0b',
  completed: '#10b981',
  error: '#ef4444',
};

export default function SessionItem({ session, active, onClick, onDelete }: Props) {
  const color = STATUS_COLORS[session.status];
  const date = new Date(session.createdAt);
  const label = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: '6px',
        background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
        border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
        transition: 'background 0.15s, border 0.15s',
        padding: '0 4px 0 0',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Main clickable area */}
      <button
        onClick={onClick}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '10px 10px 10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {session.title}
          </span>
        </div>
        <div className="mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', paddingLeft: '14px' }}>
          {label} · {session.messageCount} {session.messageCount === 1 ? 'turn' : 'turns'}
          {session.status === 'paused' && ' · paused'}
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        title="Delete session"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: '4px',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.2)',
          cursor: 'pointer',
          fontSize: '14px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)';
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        ×
      </button>
    </div>
  );
}
