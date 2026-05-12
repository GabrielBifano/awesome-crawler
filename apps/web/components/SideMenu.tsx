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
}

export default function SideMenu({
  open,
  sessions,
  currentSessionId,
  loading,
  onClose,
  onSelectSession,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          background: '#0f0f1a',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            History
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: '52px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.25)',
              fontSize: '13px',
              lineHeight: 1.6,
            }}>
              No sessions yet.
              <br />
              Start a conversation.
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
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.2)',
        }}>
          agentic crawler · sessions stored in supabase
        </div>
      </div>
    </>
  );
}
