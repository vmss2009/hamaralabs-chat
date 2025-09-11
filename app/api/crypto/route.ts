import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const randomUUID = crypto.randomUUID();
        return NextResponse.json({ success: true, data: { randomUUID: randomUUID } });
    } catch (err: any) {
        console.error("Error", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}