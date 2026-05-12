import Anthropic from '@anthropic-ai/sdk';

export const SONNET = 'claude-sonnet-4-20250514';
export const HAIKU = 'claude-haiku-4-5-20251001';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callHaiku(task: string, context: string): Promise<string> {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${task}\n\nContext:\n${context}`,
      },
    ],
    system:
      'You are a precise data extraction assistant. Extract or summarize exactly what is asked. Be concise and structured.',
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

export { client };
