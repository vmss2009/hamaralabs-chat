import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { updateMessage, deleteMessage, MAX_MESSAGE_CONTENT_LENGTH } from '@/lib/chat/messages';

// Only these errors (thrown by lib/chat/messages) are safe to show to the client.
const CLIENT_ERRORS: Record<string, number> = {
  'Message not found': 404,
  'Not authorized': 403,
  'Edit window expired': 403,
  'Delete window expired': 403,
};

function errorResponse(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : '';
  if (msg in CLIENT_ERRORS) return NextResponse.json({ error: msg }, { status: CLIENT_ERRORS[msg] });
  console.error(`[api/chat/message] ${fallback}`, e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const content = body?.content;
  if (typeof id !== 'string' || !id || typeof content !== 'string') return NextResponse.json({ error: 'id and content required' }, { status: 400 });
  if (content.length > MAX_MESSAGE_CONTENT_LENGTH) return NextResponse.json({ error: 'Message is too long' }, { status: 413 });
  try {
    const updated = await updateMessage(id, session.user.id, content);
    return NextResponse.json({ message: updated });
  } catch (e) {
    return errorResponse(e, 'Failed to update message');
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const result = await deleteMessage(id, session.user.id);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, 'Failed to delete message');
  }
}
