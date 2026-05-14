'use client';

import { useState, useRef, type FormEvent } from 'react';
import type { AppMode } from '@/lib/types';

interface InputBarProps {
  appMode: AppMode;
  menuOpen: boolean;
  onSubmit: (message: string) => void;
  onStop: () => void;
  onMenuToggle: () => void;
}

export default function InputBar({ appMode, menuOpen, onSubmit, onStop, onMenuToggle }: InputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const crawling = appMode === 'crawling';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || crawling) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Atmospheric glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '80px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 12px',
          position: 'relative',
        }}
      >
        {/* Menu button */}
        <button
          type="button"
          onClick={onMenuToggle}
          title={menuOpen ? 'Close history' : 'History'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: menuOpen ? 'rgba(139,92,246,0.15)' : 'transparent',
            border: menuOpen ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            transition: 'background 0.15s, border 0.15s',
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 1.5, background: menuOpen ? 'var(--purple)' : 'rgba(255,255,255,0.4)', borderRadius: 1, transition: 'background 0.15s' }} />
          ))}
        </button>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={crawling}
          placeholder="Send a message..."
          className="mono"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            caretColor: 'var(--purple)',
          }}
          autoComplete="off"
          spellCheck={false}
        />

        {crawling && (
          <button
            type="button"
            onClick={onStop}
            title="Stop crawler"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div style={{ width: 10, height: 10, background: 'var(--red)', borderRadius: 1 }} />
          </button>
        )}

        <button
          type="submit"
          disabled={crawling || !value.trim()}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            background: crawling || !value.trim() ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.3)',
            color: crawling || !value.trim() ? 'rgba(139,92,246,0.4)' : 'var(--purple)',
            fontSize: 12,
            fontWeight: 500,
            cursor: crawling || !value.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          className="mono"
        >
          send
        </button>
      </form>
    </div>
  );
}
