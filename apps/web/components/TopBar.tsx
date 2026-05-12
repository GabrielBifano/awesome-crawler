'use client';

import type { ModelName } from '@/lib/types';

interface TopBarProps {
  model: ModelName;
  running: boolean;
}

export default function TopBar({ model, running }: TopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: '40px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,15,0.8)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}
    >
      {/* Left: logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--purple)',
            boxShadow: '0 0 6px var(--purple)',
          }}
        />
        <span
          className="mono"
          style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}
        >
          agentic crawler
        </span>
      </div>

      {/* Right: model badge + live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: model === 'sonnet' ? 'rgba(139,92,246,0.15)' : 'rgba(20,184,166,0.15)',
            color: model === 'sonnet' ? 'var(--purple)' : 'var(--teal)',
            border: `1px solid ${model === 'sonnet' ? 'rgba(139,92,246,0.3)' : 'rgba(20,184,166,0.3)'}`,
          }}
        >
          {model}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            className={running ? 'pulse' : ''}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: running ? 'var(--emerald)' : 'rgba(255,255,255,0.2)',
              boxShadow: running ? '0 0 6px var(--emerald)' : 'none',
            }}
          />
          <span
            className="mono"
            style={{ fontSize: 11, color: running ? 'var(--emerald)' : 'rgba(255,255,255,0.3)' }}
          >
            {running ? 'running' : 'idle'}
          </span>
        </div>
      </div>
    </div>
  );
}
