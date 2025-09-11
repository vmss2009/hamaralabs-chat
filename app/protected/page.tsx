"use client";
import { useSession, signOut } from "next-auth/react";

export default function ProtectedHomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session || !session.user?.email) {
    return <div>Not logged in.</div>;
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Welcome!</h1>
      <p style={{ marginBottom: 24 }}>Logged in as <b>{session.user.email}</b></p>
      <button
        onClick={() => signOut()}
        style={{ padding: "8px 20px", fontSize: 16, borderRadius: 6, background: "#171717", color: "#fff", border: "none", cursor: "pointer" }}
      >
        Logout
      </button>
    </main>
  );
}
