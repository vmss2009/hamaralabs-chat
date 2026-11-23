import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { leaveRoom } from '@/lib/chat/rooms';
import { roomErrorResponse } from '@/lib/chat/http';

// Any member can leave. Body: { roomId }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const roomId = body?.roomId;
  if (typeof roomId !== 'string' || !roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  try {
    const outcome = await leaveRoom(roomId, session.user.id);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (e) {
    return roomErrorResponse(e, 'leave room');
  }
}
