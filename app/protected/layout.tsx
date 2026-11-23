"use client";

import { SessionProvider } from "next-auth/react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <main className="w-full min-w-0 min-h-dvh">{children}</main>
    </SessionProvider>
  );
}
