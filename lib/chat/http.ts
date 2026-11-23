import { NextResponse } from 'next/server';
import { RoomError } from './rooms';

// Known room errors go to the client as-is; anything else is logged and hidden.
export function roomErrorResponse(e: unknown, action: string) {
  if (e instanceof RoomError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(`[api/chat] ${action} failed`, e);
  return NextResponse.json({ error: `Failed to ${action}` }, { status: 500 });
}
