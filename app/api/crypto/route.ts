import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const randomUUID = crypto.randomUUID();
        return NextResponse.json({ success: true, data: { randomUUID: randomUUID } });
    } catch (err: any) {
        console.error("Error", err.message);
        return NextResponse.json({ success: false, error: 'Failed to generate id' }, { status: 500 });
    }
}
