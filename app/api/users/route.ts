import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Only expose what the member pickers need.
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  return NextResponse.json({ users });
}
