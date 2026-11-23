import { NextResponse } from 'next/server';
import { authentikLogoutUrl } from '@/lib/auth/authentik-logout';

/*
  Second step of signing out: redirect the browser to Authentik's end-session
  endpoint, which ends the Authentik session and returns to /sign-in.
  The app session is deleted first by Auth.js (CSRF-protected signOut POST, see
  lib/auth/sign-out.ts); this route changes nothing in the app itself.
*/
export async function GET(req: Request) {
  return NextResponse.redirect(await authentikLogoutUrl(req.url));
}
