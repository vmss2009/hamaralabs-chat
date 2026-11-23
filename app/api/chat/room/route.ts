import { NextResponse } from 'next/server';
import { RoomRole } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { getRoomWithMembers, updateRoom, deleteRoom, cleanRoomName, MAX_ROOM_NAME_LENGTH, type RoomChanges } from '@/lib/chat/rooms';
import { roomErrorResponse } from '@/lib/chat/http';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MAX_MEMBER_CHANGES = 500;
const ROLES = new Set<string>(Object.values(RoomRole));

// Room details + members (with roles). Members only.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url, BASE_URL);
  const roomId = searchParams.get('roomId');
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  const room = await getRoomWithMembers(roomId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const userId = session.user.id;
  const me = room.members.find(m => m.id === userId);
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ room, myRole: me.role });
}

const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= MAX_MEMBER_CHANGES && v.every(x => typeof x === 'string');

/*
  Admin-only room changes. Body: { roomId, name?, addIds?, removeIds?, roles? }
  where roles maps userId -> "ADMIN" | "MEMBER". All changes apply atomically.
*/
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const roomId = body?.roomId;
  if (typeof roomId !== 'string' || !roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

  const changes: RoomChanges = {};
  if (body.name !== undefined) {
    const name = cleanRoomName(body.name);
    if (!name) return NextResponse.json({ error: `Room name must be 1-${MAX_ROOM_NAME_LENGTH} characters` }, { status: 400 });
    changes.name = name;
  }
  for (const key of ['addIds', 'removeIds'] as const) {
    if (body[key] === undefined) continue;
    if (!isIdList(body[key])) return NextResponse.json({ error: `${key} must be an array of user ids` }, { status: 400 });
    changes[key] = body[key];
  }
  if (body.roles !== undefined) {
    const roles = body.roles;
    const valid = roles && typeof roles === 'object' && !Array.isArray(roles)
      && Object.keys(roles).length <= MAX_MEMBER_CHANGES
      && Object.values(roles).every(r => typeof r === 'string' && ROLES.has(r));
    if (!valid) return NextResponse.json({ error: 'roles must map user ids to ADMIN or MEMBER' }, { status: 400 });
    changes.roles = roles as Record<string, RoomRole>;
  }

  try {
    const { room, missingMembers } = await updateRoom(roomId, session.user.id, changes);
    return NextResponse.json({ room, missingMembers });
  } catch (e) {
    return roomErrorResponse(e, 'update room');
  }
}

// Admin-only: delete the room with all its messages and files.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url, BASE_URL);
  const roomId = searchParams.get('roomId');
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  try {
    await deleteRoom(roomId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return roomErrorResponse(e, 'delete room');
  }
}
