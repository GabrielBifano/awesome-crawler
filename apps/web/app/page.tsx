'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import LiveFeed from '@/components/LiveFeed';
import InputBar from '@/components/InputBar';
import SideMenu from '@/components/SideMenu';
import { getUserId } from '@/lib/user-identity';
import type { FeedEntry, ModelName, AppMode, SessionMeta, SSEEvent } from '@/lib/types';

export default function HomePage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [model, setModel] = useState<ModelName>('sonnet');
  const [delegating, setDelegating] = useState(false);

  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  // Init userId on mount
  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Load sessions list when menu opens
  useEffect(() => {
    if (!menuOpen || !userId) return;
    setSessionsLoading(true);
    fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data: SessionMeta[]) => setSessions(data))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, [menuOpen, userId]);

  const addEntry = useCallback((entry: FeedEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const makeLocalEntry = useCallback(
    (tag: FeedEntry['tag'], message: string): FeedEntry => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tag,
      message,
      model: 'sonnet',
    }),
    [],
  );

  const handleSubmit = useCallback(
    async (message: string) => {
      if (appMode === 'crawling' || !userId) return;

      setAppMode('chat');
      setModel('sonnet');
      setDelegating(false);

      addEntry(makeLocalEntry('user', message));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            userId,
            sessionId: currentSessionRef.current ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let chatResponseAccum = '';

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

            let event: SSEEvent;
            try {
              event = JSON.parse(raw) as SSEEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case 'session_created':
                currentSessionRef.current = event.sessionId;
                setSessionId(event.sessionId);
                break;

              case 'thinking':
                // thinking event handled via feed_entry below
                break;

              case 'feed_entry':
                addEntry(event.data);
                if (event.data.tag === 'haiku') {
                  setModel('haiku');
                  setDelegating(true);
                } else if (event.data.tag !== 'model_thinking') {
                  setModel('sonnet');
                  setDelegating(false);
                }
                break;

              case 'crawl_started':
                setAppMode('crawling');
                break;

              case 'crawl_complete':
                setAppMode('chat');
                break;

              case 'crawl_interrupted':
                setAppMode('chat');
                break;

              case 'chat_token':
                chatResponseAccum += event.token;
                break;

              case 'chat_done': {
                if (chatResponseAccum) {
                  addEntry(makeLocalEntry('done', chatResponseAccum));
                  chatResponseAccum = '';
                }
                break;
              }

              case 'error':
                addEntry(makeLocalEntry('error', event.message));
                setAppMode('chat');
                break;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        addEntry(makeLocalEntry('error', err instanceof Error ? err.message : 'Connection error'));
        setAppMode('chat');
      } finally {
        setAppMode('chat');
        setDelegating(false);
        abortRef.current = null;
      }
    },
    [appMode, userId, addEntry, makeLocalEntry],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSelectSession = useCallback(
    async (sid: string) => {
      if (!userId) return;

      addEntry(makeLocalEntry('nav', `loading session...`));

      try {
        const res = await fetch(`/api/sessions/${sid}?userId=${encodeURIComponent(userId)}`);
        const data = await res.json() as {
          checkpoints: Array<{
            checkpoint: {
              userMessage: string;
              assistantResponse: string;
              feedEntries?: FeedEntry[];
              crawlInterrupted?: boolean;
              lastCrawlUrl?: string;
            };
          }>;
          lastCrawlUrl?: string;
        };

        const restored: FeedEntry[] = [];
        for (const cp of data.checkpoints) {
          if (cp.checkpoint.feedEntries) {
            restored.push(...cp.checkpoint.feedEntries);
          }
        }
        restored.push(makeLocalEntry('ok', '─── session loaded ───'));

        if (data.lastCrawlUrl) {
          restored.push(
            makeLocalEntry('model_thinking', `previous crawl was paused at ${data.lastCrawlUrl}`),
          );
        }

        setEntries(restored);
        currentSessionRef.current = sid;
        setSessionId(sid);
        setAppMode('chat');
      } catch {
        addEntry(makeLocalEntry('error', 'Failed to load session'));
      }
    },
    [userId, addEntry, makeLocalEntry],
  );

  const handleDeleteSession = useCallback(
    async (sid: string) => {
      if (!userId) return;
      setSessions((prev) => prev.filter((s) => s.sessionId !== sid));
      if (currentSessionRef.current === sid) {
        currentSessionRef.current = null;
        setSessionId(null);
        setEntries([]);
      }
      await fetch(`/api/sessions/${sid}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    },
    [userId],
  );

  const handleNewChat = useCallback(() => {
    currentSessionRef.current = null;
    setSessionId(null);
    setEntries([]);
    setAppMode('chat');
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
      <SideMenu
        open={menuOpen}
        sessions={sessions}
        currentSessionId={sessionId}
        loading={sessionsLoading}
        onClose={() => setMenuOpen(false)}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
      />
      <TopBar model={model} appMode={appMode} delegating={delegating} />
      <LiveFeed entries={entries} />
      <InputBar
        appMode={appMode}
        menuOpen={menuOpen}
        onSubmit={handleSubmit}
        onStop={handleStop}
        onMenuToggle={() => setMenuOpen((v) => !v)}
      />
    </div>
  );
}
