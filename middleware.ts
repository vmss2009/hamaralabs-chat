import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

// Page-level gate. Sessions live in the database, so this runs on the Node.js
// runtime (Prisma is not available on Edge).
export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const signedIn = !!req.auth?.user;

  if (!signedIn && pathname.startsWith("/protected")) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }
  if (signedIn && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/protected/chat", origin));
  }
});

export const config = {
  runtime: "nodejs",
  // Pages only. API routes check the session themselves (and answer 401 rather
  // than redirecting); static assets don't need a session lookup.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)"],
};
