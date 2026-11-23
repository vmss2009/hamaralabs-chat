import { chatBus, type ChatEvents } from '@/lib/chat/realtime';
import { auth } from '@/lib/auth/auth';
import { isRoomMember } from '@/lib/chat/rooms';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const runtime = 'nodejs';

/*
  Server-sent events for one room:
  - "message": a message was created/edited/deleted
  - "room":    room renamed, members/roles changed ({ kind: "updated" }) or room deleted ({ kind: "deleted" })
  - "removed": the current user is no longer a member; the stream is then closed
*/
export async function GET(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(req.url, BASE_URL);
  const roomId = searchParams.get('roomId');
  if(!roomId) return new Response('roomId required', { status: 400 });
  if (!(await isRoomMember(roomId, userId))) return new Response('Forbidden', { status: 403 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const onMessage = (payload: ChatEvents['message']) => {
        if (payload.roomId === roomId) send('message', payload);
      };
      const onRoom = async (payload: ChatEvents['room']) => {
        if (payload.roomId !== roomId || closed) return;
        if (payload.kind === 'deleted') {
          send('room', payload);
          return close();
        }
        // Membership may have changed: stop streaming to users who were removed.
        const stillMember = await isRoomMember(roomId, userId).catch(() => false);
        if (!stillMember) {
          send('removed', { roomId });
          return close();
        }
        send('room', payload);
      };
      const heartbeat = setInterval(() => send('ping', {}), 30000);
      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        chatBus.off('message', onMessage);
        chatBus.off('room', onRoom);
      };
      const close = () => {
        if (closed) return;
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      };

      chatBus.on('message', onMessage);
      chatBus.on('room', onRoom);
      send('open', { status: 'ok' });
      req.signal?.addEventListener('abort', close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
