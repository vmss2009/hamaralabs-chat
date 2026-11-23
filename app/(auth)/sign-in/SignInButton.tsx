"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      onClick={() => { setPending(true); signIn("authentik", { redirectTo: "/protected/chat" }); }}
      disabled={pending}
      className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
    >
      {pending ? "Redirecting…" : "Sign in with Authentik"}
    </button>
  );
}
