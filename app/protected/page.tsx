import { redirect } from "next/navigation";

// The app's home after login is the chat list.
export default function ProtectedHomePage() {
  redirect("/protected/chat");
}
