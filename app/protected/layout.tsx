"use client";

import { SessionProvider } from "next-auth/react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex">
        <main className="">{children}</main>
      </div>
    </SessionProvider>
  );
}
