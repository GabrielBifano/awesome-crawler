'use client';

import type { ModelName, AppMode } from '@/lib/types';

interface TopBarProps {
  model: ModelName;
  appMode: AppMode;
  delegating: boolean;
}

export default function TopBar({ model, appMode, delegating }: TopBarProps) {
  const crawling = appMode === 'crawling';
  const activeModel: ModelName = delegating ? 'haiku' : model;

  let badgeLabel: string;
  let badgeColor: string;
  let badgeBg: string;
  let badgeBorder: string;

  if (delegating) {
    badgeLabel = 'delegating · haiku';
    badgeColor = 'var(--teal)';
    badgeBg = 'rgba(20,184,166,0.15)';
    badgeBorder = 'rgba(20,184,166,0.3)';
  } else if (crawling) {
    badgeLabel = 'crawling · sonnet';
    badgeColor = 'var(--purple)';
    badgeBg = 'rgba(139,92,246,0.15)';
    badgeBorder = 'rgba(139,92,246,0.3)';
  } else {
    badgeLabel = 'chat · sonnet';
    badgeColor = 'var(--purple)';
    badgeBg = 'rgba(139,92,246,0.15)';
    badgeBorder = 'rgba(139,92,246,0.3)';
  }

  const isActive = crawling || delegating;

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
          awesome crawler uwu
        </span>
      </div>

      {/* Right: badge + live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          className={`mono${crawling ? ' pulse-color-purple' : ''}`}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: badgeBg,
            color: crawling ? undefined : badgeColor,
            border: `1px solid ${badgeBorder}`,
          }}
        >
          {badgeLabel}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            className={isActive ? 'pulse-subtle' : ''}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isActive ? 'var(--emerald)' : 'rgba(255,255,255,0.2)',
              boxShadow: isActive ? '0 0 6px var(--emerald)' : 'none',
            }}
          />
          <span
            className="mono"
            style={{ fontSize: 11, color: isActive ? 'var(--emerald)' : 'rgba(255,255,255,0.3)' }}
          >
            {isActive ? 'active' : 'ready'}
          </span>
        </div>
      </div>
    </div>
  );
}
