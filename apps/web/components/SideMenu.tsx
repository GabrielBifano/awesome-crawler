'use client';

import { useEffect, useRef } from 'react';
import type { SessionMeta } from '@/lib/types';
import SessionItem from './SessionItem';

interface Props {
  open: boolean;
  sessions: SessionMeta[];
  currentSessionId: string | null;
  loading: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function SideMenu({
  open,
  sessions,
  currentSessionId,
  loading,
  onClose,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const id = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handleClick);
    };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: '72px',
        left: '16px',
        width: '260px',
        maxHeight: '420px',
        background: 'rgba(12, 12, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transformOrigin: 'bottom left',
        transform: open ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span className="mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          History
        </span>
        {/* New chat button */}
        <button
          onClick={() => { onNewChat(); onClose(); }}
          title="New chat"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '5px',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            color: 'var(--purple)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.22)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.12)'; }}
          className="mono"
        >
          + new
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {loading && (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: '48px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="mono" style={{
            padding: '28px 12px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: '12px',
            lineHeight: 1.7,
          }}>
            No sessions yet.<br />Start a conversation.
          </div>
        )}

        {!loading && sessions.map((session) => (
          <SessionItem
            key={session.sessionId}
            session={session}
            active={session.sessionId === currentSessionId}
            onClick={() => {
              onSelectSession(session.sessionId);
              onClose();
            }}
            onDelete={(e) => {
              e.stopPropagation();
              onDeleteSession(session.sessionId);
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mono" style={{
        padding: '8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.15)',
        flexShrink: 0,
      }}>
        sessions · supabase
      </div>
    </div>
  );
}
