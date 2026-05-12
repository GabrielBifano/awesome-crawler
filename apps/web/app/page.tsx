'use client';

import { useState, useRef, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import LiveFeed from '@/components/LiveFeed';
import InputBar from '@/components/InputBar';
import type { FeedEntry, ModelName } from '@/lib/types';

export default function HomePage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [model, setModel] = useState<ModelName>('sonnet');
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (instruction: string) => {
    if (running) return;

    setEntries([]);
    setRunning(true);
    setModel('sonnet');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;

          try {
            const entry: FeedEntry = JSON.parse(raw);
            setEntries((prev) => [...prev, entry]);
            if (entry.tag === 'haiku') {
              setModel('haiku');
            } else if (entry.tag === 'done' || entry.tag === 'think' || entry.tag === 'act') {
              setModel('sonnet');
            }
          } catch {
            // malformed event — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user stopped — already emitted by server
        return;
      }
      setEntries((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          tag: 'error',
          message: err instanceof Error ? err.message : 'Connection error',
          model: 'sonnet',
        },
      ]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <TopBar model={model} running={running} />
      <LiveFeed entries={entries} />
      <InputBar running={running} onSubmit={handleSubmit} onStop={handleStop} />
    </div>
  );
}
