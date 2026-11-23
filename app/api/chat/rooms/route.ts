import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { listRooms, createRoom, cleanRoomName, MAX_ROOM_NAME_LENGTH } from '@/lib/chat/rooms';
import { roomErrorResponse } from '@/lib/chat/http';

const MAX_MEMBERS = 500;

export async function GET() {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rooms = await listRooms(session.user.id);
  return NextResponse.json({ rooms });
}

// Create a room. The creator becomes its admin; everyone else joins as a member.
export async function POST(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = cleanRoomName(body?.name);
  if (!name) {
    return NextResponse.json({ error: `Room name must be 1-${MAX_ROOM_NAME_LENGTH} characters` }, { status: 400 });
  }
  const memberIds = body?.memberIds ?? [];
  if (!Array.isArray(memberIds) || memberIds.length > MAX_MEMBERS || !memberIds.every((m: unknown) => typeof m === 'string')) {
    return NextResponse.json({ error: 'memberIds must be an array of user ids' }, { status: 400 });
  }
  try {
    const { room, missingMembers } = await createRoom(session.user.id, name, memberIds);
    return NextResponse.json({ room, missingMembers });
  } catch (e) {
    return roomErrorResponse(e, 'create room');
  }
}
