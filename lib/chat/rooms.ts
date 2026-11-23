import { Prisma, RoomRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { chatBus } from "./realtime";
import { deleteChatRoomObjects } from "../storage/storage";

/*
  Room permissions
  - Any member: read/send messages, leave the room.
  - Admins: rename, delete, add/remove members, make/unmake admins.
  - A room always keeps at least one admin. When the last admin leaves, the
    longest-standing remaining member is promoted. When the last member
    leaves, the room and its messages/files are deleted.
*/

export const MAX_ROOM_NAME_LENGTH = 100;

export class RoomError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function cleanRoomName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name && name.length <= MAX_ROOM_NAME_LENGTH ? name : null;
}

const memberInclude = { user: { select: { id: true, email: true } } } satisfies Prisma.ChatRoomMemberInclude;
const roomInclude = {
  members: { include: memberInclude, orderBy: [{ joinedAt: "asc" }, { userId: "asc" }] },
} satisfies Prisma.ChatRoomInclude;
type RoomRow = Prisma.ChatRoomGetPayload<{ include: typeof roomInclude }>;

function toRoomDto({ members, ...room }: RoomRow) {
  return {
    ...room,
    members: members.map((m) => ({ id: m.user.id, email: m.user.email, role: m.role, joinedAt: m.joinedAt })),
  };
}
export type RoomDto = ReturnType<typeof toRoomDto>;

type Tx = Prisma.TransactionClient;

// Serializable so concurrent admin changes can't leave a room without an admin.
async function serializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      const retryable = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      if (retryable && attempt < 3) continue;
      throw e;
    }
  }
}

async function requireMember(tx: Tx, roomId: string, userId: string) {
  const room = await tx.chatRoom.findUnique({ where: { id: roomId }, select: { id: true } });
  if (!room) throw new RoomError("Room not found", 404);
  const membership = await tx.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  if (!membership) throw new RoomError("Forbidden", 403);
  return membership;
}

async function requireAdmin(tx: Tx, roomId: string, userId: string) {
  const membership = await requireMember(tx, roomId, userId);
  if (membership.role !== RoomRole.ADMIN) throw new RoomError("Only room admins can do that", 403);
  return membership;
}

async function deleteRoomRows(tx: Tx, roomId: string) {
  await tx.attachment.deleteMany({ where: { message: { chatRoomId: roomId } } });
  await tx.message.deleteMany({ where: { chatRoomId: roomId } });
  await tx.chatRoom.delete({ where: { id: roomId } }); // memberships cascade
}

async function deleteRoomFiles(roomId: string) {
  try {
    await deleteChatRoomObjects(roomId);
  } catch (e) {
    // The room is already gone from the DB; don't fail the request over storage cleanup.
    console.error(`[rooms] failed to delete stored files for room ${roomId}`, e);
  }
}

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export async function listRooms(userId: string) {
  const rows = await prisma.chatRoom.findMany({
    where: { members: { some: { userId } } },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { messages: true, members: true } },
      members: { where: { userId }, select: { role: true } },
    },
  });
  return rows.map(({ members, ...room }) => ({ ...room, myRole: members[0]?.role ?? null }));
}

export async function createRoom(userId: string, name: string, memberIds: string[]) {
  const others = unique(memberIds).filter((id) => id !== userId);
  const found = others.length ? await prisma.user.findMany({ where: { id: { in: others } }, select: { id: true } }) : [];
  const foundIds = new Set(found.map((u) => u.id));
  const room = await prisma.chatRoom.create({
    data: {
      name,
      members: {
        create: [
          { userId, role: RoomRole.ADMIN },
          ...[...foundIds].map((id) => ({ userId: id, role: RoomRole.MEMBER })),
        ],
      },
    },
    include: roomInclude,
  });
  return { room: toRoomDto(room), missingMembers: others.filter((id) => !foundIds.has(id)) };
}

export async function isRoomMember(roomId: string, userId: string) {
  if (!roomId || !userId) return false;
  const count = await prisma.chatRoomMember.count({ where: { roomId, userId } });
  return count > 0;
}

export async function getRoomWithMembers(roomId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: roomInclude });
  return room ? toRoomDto(room) : null;
}

export type RoomChanges = {
  name?: string;
  addIds?: string[];
  removeIds?: string[];
  roles?: Record<string, RoomRole>;
};

export async function updateRoom(roomId: string, actorId: string, changes: RoomChanges) {
  const result = await serializable(async (tx) => {
    await requireAdmin(tx, roomId, actorId);

    const removeIds = unique(changes.removeIds ?? []);
    if (removeIds.includes(actorId)) throw new RoomError('Use "Leave room" to remove yourself', 400);

    if (changes.name !== undefined) {
      await tx.chatRoom.update({ where: { id: roomId }, data: { name: changes.name } });
    }

    let missingMembers: string[] = [];
    const addIds = unique(changes.addIds ?? []).filter((id) => id !== actorId);
    if (addIds.length) {
      const users = await tx.user.findMany({ where: { id: { in: addIds } }, select: { id: true } });
      const found = new Set(users.map((u) => u.id));
      missingMembers = addIds.filter((id) => !found.has(id));
      if (users.length) {
        await tx.chatRoomMember.createMany({ data: users.map((u) => ({ roomId, userId: u.id })), skipDuplicates: true });
      }
    }

    if (removeIds.length) {
      await tx.chatRoomMember.deleteMany({ where: { roomId, userId: { in: removeIds } } });
    }

    for (const [userId, role] of Object.entries(changes.roles ?? {})) {
      const { count } = await tx.chatRoomMember.updateMany({ where: { roomId, userId }, data: { role } });
      if (!count) throw new RoomError("Can only change the role of current members", 400);
    }

    const admins = await tx.chatRoomMember.count({ where: { roomId, role: RoomRole.ADMIN } });
    if (!admins) throw new RoomError("A room needs at least one admin", 400);

    const room = await tx.chatRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude });
    return { room: toRoomDto(room), missingMembers };
  });
  chatBus.emit("room", { roomId, kind: "updated" });
  return result;
}

export async function leaveRoom(roomId: string, userId: string) {
  const outcome = await serializable(async (tx) => {
    await requireMember(tx, roomId, userId);
    await tx.chatRoomMember.delete({ where: { roomId_userId: { roomId, userId } } });

    const remaining = await tx.chatRoomMember.findMany({
      where: { roomId },
      orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
    });
    if (!remaining.length) {
      await deleteRoomRows(tx, roomId);
      return { roomDeleted: true, promotedUserId: null as string | null };
    }
    if (!remaining.some((m) => m.role === RoomRole.ADMIN)) {
      const successor = remaining[0].userId;
      await tx.chatRoomMember.update({
        where: { roomId_userId: { roomId, userId: successor } },
        data: { role: RoomRole.ADMIN },
      });
      return { roomDeleted: false, promotedUserId: successor as string | null };
    }
    return { roomDeleted: false, promotedUserId: null as string | null };
  });

  if (outcome.roomDeleted) {
    chatBus.emit("room", { roomId, kind: "deleted" });
    await deleteRoomFiles(roomId);
  } else {
    chatBus.emit("room", { roomId, kind: "updated" });
  }
  return outcome;
}

export async function deleteRoom(roomId: string, actorId: string) {
  await serializable(async (tx) => {
    await requireAdmin(tx, roomId, actorId);
    await deleteRoomRows(tx, roomId);
  });
  chatBus.emit("room", { roomId, kind: "deleted" });
  await deleteRoomFiles(roomId);
}
