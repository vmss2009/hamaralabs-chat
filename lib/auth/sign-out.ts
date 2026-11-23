"use client";
import { signOut } from "next-auth/react";

// Full sign-out: end the app session (deletes the Session row), then the
// Authentik session, so the next "Sign in" asks for credentials again.
export async function signOutCompletely() {
  await signOut({ redirect: false });
  window.location.assign("/api/logout");
}
