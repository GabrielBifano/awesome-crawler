import { NextRequest } from 'next/server';
import { loadSession, deleteSession } from '@/lib/session-manager';

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

export async function DELETE(
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
  await deleteSession(userId, sessionId);
  return new Response(null, { status: 204 });
}
