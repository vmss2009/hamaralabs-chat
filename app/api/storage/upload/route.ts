import { NextResponse } from 'next/server';
import s3, { CHAT_BUCKET, chatObjectKeyPrefix, chatObjectPublicUrl } from '@/lib/storage/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth/auth';
import { isRoomMember } from '@/lib/chat/rooms';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// 50 MB per file. If you raise this, raise experimental.middlewareClientMaxBodySize in next.config.ts too.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// Types a browser may render inline from the storage URL. Everything else
// (HTML, SVG, XML, JS, ...) is served as a download so it can never execute
// as a page on the storage origin.
const INLINE_SAFE_TYPE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf)$/i;
const MIME_SHAPE = /^[\w.+-]+\/[\w.+-]+$/;
const SAFE_EXT = /^\.[A-Za-z0-9]{1,10}$/;

export async function POST(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const file = form.get('file');
  if(!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 });
  const roomId = form.get('roomId');
  if(typeof roomId !== 'string' || !roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!(await isRoomMember(roomId, session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Build key: <roomId>/<userId>/<uuid><.ext>
  const orig = file.name || 'file';
  const dot = orig.lastIndexOf('.');
  const rawExt = dot > -1 ? orig.slice(dot) : '';
  const ext = SAFE_EXT.test(rawExt) ? rawExt.toLowerCase() : '';
  const key = `${chatObjectKeyPrefix(roomId, session.user.id)}${randomUUID()}${ext}`;

  const declaredType = (file.type || '').split(';')[0].trim().toLowerCase();
  const contentType = MIME_SHAPE.test(declaredType) ? declaredType : 'application/octet-stream';
  const inline = INLINE_SAFE_TYPE.test(contentType);

  await s3.send(new PutObjectCommand({
    Bucket: CHAT_BUCKET,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: contentType,
    ContentDisposition: inline ? 'inline' : 'attachment',
  }));
  return NextResponse.json({ url: chatObjectPublicUrl(key), key });
}
