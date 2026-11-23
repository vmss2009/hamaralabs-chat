"use client"
import { signIn } from "next-auth/react"

export default function SignIn() {

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-8 sm:p-20">
      <h1 className="text-2xl sm:text-3xl font-bold text-center">Welcome to HamaraLabs</h1>
      <button
        onClick={() => signIn("authentik", { redirectTo: "/protected/chat" })}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Sign in with Authentik
      </button>
    </div>
  );
}