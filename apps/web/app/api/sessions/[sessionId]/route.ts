import { NextRequest } from 'next/server';
import { loadSession } from '@/lib/session-manager';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = await loadSession(sessionId, userId);
  return Response.json(data);
}
