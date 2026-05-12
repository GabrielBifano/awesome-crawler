import { NextRequest } from 'next/server';
import { listSessions } from '@/lib/session-manager';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const sessions = await listSessions(userId);
  return Response.json(sessions);
}
