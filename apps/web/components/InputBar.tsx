'use client';

import { useState, useRef, type FormEvent } from 'react';

interface InputBarProps {
  running: boolean;
  onSubmit: (instruction: string) => void;
  onStop: () => void;
}

export default function InputBar({ running, onSubmit, onStop }: InputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || running) return;
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
      {/* Atmospheric glow behind input bar */}
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
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={running}
          placeholder="Enter crawl instructions..."
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

        {running && (
          <button
            type="button"
            onClick={onStop}
            title="Stop crawl"
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
            {/* Stop square icon */}
            <div style={{ width: 10, height: 10, background: 'var(--red)', borderRadius: 1 }} />
          </button>
        )}

        <button
          type="submit"
          disabled={running || !value.trim()}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            background: running || !value.trim() ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.3)',
            color: running || !value.trim() ? 'rgba(139,92,246,0.4)' : 'var(--purple)',
            fontSize: 12,
            fontWeight: 500,
            cursor: running || !value.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          className="mono"
        >
          run
        </button>
      </form>
    </div>
  );
}
