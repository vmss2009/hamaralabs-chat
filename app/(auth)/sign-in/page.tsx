import { SignInButton } from "./SignInButton";

// Auth.js redirects failed sign-ins here with ?error=<code>.
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already linked to a different sign-in. Please contact an administrator.",
  AccessDenied: "Access denied. Your account isn't allowed to sign in to this app.",
  Configuration: "Sign-in is temporarily unavailable because of a server configuration problem.",
  OAuthCallbackError: "Authentik didn't complete the sign-in. Please try again.",
  OAuthSignInError: "Couldn't start sign-in with Authentik. Please try again.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  const message = code ? ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again." : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-8 sm:p-20">
      <h1 className="text-2xl sm:text-3xl font-bold text-center">Welcome to HamaraLabs</h1>
      {message && (
        <p role="alert" className="mt-4 max-w-sm text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">
          {message}
        </p>
      )}
      <SignInButton />
    </div>
  );
}
