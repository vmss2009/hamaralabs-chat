import { NextResponse } from 'next/server';
import { MessageType } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { listMessages, sendMessage, MAX_MESSAGE_CONTENT_LENGTH } from '@/lib/chat/messages';
import { isRoomMember } from '@/lib/chat/rooms';
import { isOwnChatUploadUrl } from '@/lib/storage/storage';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MAX_ATTACHMENTS = 10;
const MAX_INT32 = 2_147_483_647;
const MESSAGE_TYPES = new Set<string>(Object.values(MessageType));

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // In some runtimes req.url can be relative; provide a base to avoid DOMException
  const { searchParams } = new URL(req.url, BASE_URL);
  const roomId = searchParams.get('roomId');
  const cursor = searchParams.get('cursor') || undefined;
  const takeRaw = searchParams.get('take');
  const take = takeRaw ? parseInt(takeRaw, 10) : undefined;
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!(await isRoomMember(roomId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const data = await listMessages(roomId, cursor, take);
  return NextResponse.json(data);
}

type AttachmentInput = { url: string; type: string; filename?: string; size?: number };

function parseAttachments(raw: unknown, roomId: string, userId: string): AttachmentInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null;
  const out: AttachmentInput[] = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') return null;
    const { url, type, filename, size } = a as Record<string, unknown>;
    if (!isOwnChatUploadUrl(url, roomId, userId)) return null;
    if (typeof type !== 'string' || type.length > 255) return null;
    if (filename !== undefined && (typeof filename !== 'string' || filename.length > 255)) return null;
    if (size !== undefined && (typeof size !== 'number' || !Number.isInteger(size) || size < 0 || size > MAX_INT32)) return null;
    out.push({ url: url as string, type, filename: filename as string | undefined, size: size as number | undefined });
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { roomId, content, type } = body as Record<string, unknown>;
  if (typeof roomId !== 'string' || !roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (content !== undefined && typeof content !== 'string') return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
  if (typeof content === 'string' && content.length > MAX_MESSAGE_CONTENT_LENGTH) return NextResponse.json({ error: 'Message is too long' }, { status: 413 });
  if (type !== undefined && (typeof type !== 'string' || !MESSAGE_TYPES.has(type))) return NextResponse.json({ error: 'Invalid message type' }, { status: 400 });

  if (!(await isRoomMember(roomId, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const attachments = parseAttachments((body as Record<string, unknown>).attachments, roomId, userId);
  if (!attachments) return NextResponse.json({ error: 'Invalid attachments' }, { status: 400 });
  if (!content && attachments.length === 0) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });

  const message = await sendMessage(roomId, userId, { content: content as string | undefined, attachments, type: type as MessageType | undefined });
  return NextResponse.json({ message });
}
