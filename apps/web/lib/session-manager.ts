import { nanoid } from 'nanoid';
import { getSupabase } from './supabase';
import { client, HAIKU } from './model-router';
import type { SessionMeta } from './types';
import type Anthropic from '@anthropic-ai/sdk';
import type { FeedEntry } from '@awesome-crawler/shared';

interface StoreValue {
  title: string;
  status: SessionMeta['status'];
  firstMessage: string;
  createdAt: string;
  messageCount: number;
  lastCrawlUrl?: string;
}

interface CheckpointData {
  userMessage: string;
  assistantResponse: string;
  feedEntries?: FeedEntry[];
  crawlContext?: string;
  crawlInterrupted?: boolean;
  lastCrawlUrl?: string;
}

interface CheckpointRow {
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  type: 'chat' | 'chat_with_crawl';
  checkpoint: CheckpointData;
  metadata: { model: string; timestamp: string; turnIndex: number };
}

export async function createSession(
  userId: string,
  firstMessage: string,
): Promise<{ sessionId: string; title: string }> {
  const sessionId = `sess_${nanoid(16)}`;
  const title = await generateTitle(firstMessage);
  const createdAt = new Date().toISOString();

  const value: StoreValue = {
    title,
    status: 'active',
    firstMessage,
    createdAt,
    messageCount: 0,
  };

  await getSupabase().from('store').insert({
    prefix: userId,
    key: sessionId,
    value,
  });

  return { sessionId, title };
}

export async function updateSession(
  userId: string,
  sessionId: string,
  patch: Partial<StoreValue>,
): Promise<void> {
  const { data } = await getSupabase()
    .from('store')
    .select('value')
    .eq('prefix', userId)
    .eq('key', sessionId)
    .single();

  if (!data) return;

  const updated = { ...(data.value as StoreValue), ...patch };
  await getSupabase()
    .from('store')
    .update({ value: updated })
    .eq('prefix', userId)
    .eq('key', sessionId);
}

export async function listSessions(userId: string): Promise<SessionMeta[]> {
  const { data } = await getSupabase()
    .from('store')
    .select('key, value, created_at')
    .eq('prefix', userId)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => {
    const v = row.value as StoreValue;
    return {
      sessionId: row.key as string,
      title: v.title,
      status: v.status,
      firstMessage: v.firstMessage,
      createdAt: v.createdAt,
      messageCount: v.messageCount,
      lastCrawlUrl: v.lastCrawlUrl,
    };
  });
}

export async function appendCheckpoint(
  sessionId: string,
  userId: string,
  type: 'chat' | 'chat_with_crawl',
  data: CheckpointData,
  turnIndex: number,
): Promise<void> {
  const { data: existing } = await getSupabase()
    .from('checkpoints')
    .select('checkpoint_id')
    .eq('thread_id', sessionId)
    .eq('checkpoint_ns', userId)
    .order('metadata->turnIndex', { ascending: false })
    .limit(1);

  const parentId = existing && existing.length > 0 ? existing[0].checkpoint_id : null;

  await getSupabase().from('checkpoints').insert({
    thread_id: sessionId,
    checkpoint_ns: userId,
    checkpoint_id: nanoid(16),
    parent_checkpoint_id: parentId,
    type,
    checkpoint: data,
    metadata: { model: 'sonnet', timestamp: new Date().toISOString(), turnIndex },
  });
}

export async function loadSession(
  sessionId: string,
  userId: string,
): Promise<{
  checkpoints: CheckpointRow[];
  latestCrawlContext: string | undefined;
  lastCrawlUrl: string | undefined;
  messageHistory: Anthropic.MessageParam[];
}> {
  const { data } = await getSupabase()
    .from('checkpoints')
    .select('*')
    .eq('thread_id', sessionId)
    .eq('checkpoint_ns', userId)
    .order('metadata->turnIndex', { ascending: true });

  const checkpoints: CheckpointRow[] = (data ?? []) as CheckpointRow[];

  let latestCrawlContext: string | undefined;
  let lastCrawlUrl: string | undefined;
  const messageHistory: Anthropic.MessageParam[] = [];

  for (const cp of checkpoints) {
    const d = cp.checkpoint;
    messageHistory.push({ role: 'user', content: d.userMessage });
    messageHistory.push({ role: 'assistant', content: d.assistantResponse });
    if (d.crawlContext) latestCrawlContext = d.crawlContext;
    if (d.crawlInterrupted && d.lastCrawlUrl) lastCrawlUrl = d.lastCrawlUrl;
  }

  // If last checkpoint was not interrupted, clear lastCrawlUrl
  const last = checkpoints[checkpoints.length - 1];
  if (last && !last.checkpoint.crawlInterrupted) {
    lastCrawlUrl = undefined;
  }

  return { checkpoints, latestCrawlContext, lastCrawlUrl, messageHistory };
}

async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 30,
      messages: [
        {
          role: 'user',
          content: `Generate a concise title (4-6 words, no punctuation, no quotes) for this conversation:\n\n"${firstMessage}"\n\nReply with ONLY the title. No explanation. No punctuation at the end. Example: compare pricing across saas tools`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('no text');
    return text.text.trim().toLowerCase().slice(0, 60);
  } catch {
    return firstMessage.slice(0, 40).trim();
  }
}
