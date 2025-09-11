import { NextResponse } from 'next/server';
import s3 from '@/lib/storage/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth/auth';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if(!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if(!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  const roomId = form.get('roomId') as string | null;
  const arrayBuffer = await file.arrayBuffer();
  const key = `${roomId || 'misc'}/${Date.now()}-${file.name}`;
  await s3.send(new PutObjectCommand({ Bucket: 'chat', Key: key, Body: Buffer.from(arrayBuffer), ContentType: file.type }));
  const url = `${process.env.S3_PUBLIC_URL?.replace(/\/$/, '') || process.env.S3_ENDPOINT}/${'chat'}/${key}`;
  return NextResponse.json({ url, key });
}
