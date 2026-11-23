import { redirect } from "next/navigation";

// Middleware sends signed-out users to /sign-in first.
export default function Home() {
  redirect("/protected/chat");
}
