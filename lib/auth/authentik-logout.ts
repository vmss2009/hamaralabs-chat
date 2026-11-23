// Ending the Authentik (identity provider) session, i.e. OIDC RP-initiated logout.
// Without this, "Sign out" only ends the app session and the next "Sign in"
// goes straight through because the user is still logged in to Authentik.

const DISCOVERY_TTL_MS = 60 * 60 * 1000;
let cached: { url: string | null; at: number } | null = null;

function issuerBase(): string | null {
  const issuer = process.env.AUTHENTIK_ISSUER;
  if (!issuer) return null;
  return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

// Reads end_session_endpoint from Authentik's discovery document (cached for an
// hour). Falls back to Authentik's standard per-application path.
export async function authentikEndSessionEndpoint(): Promise<string | null> {
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.url;
  const base = issuerBase();
  if (!base) return null;
  let url: string | null = null;
  try {
    const res = await fetch(new URL(".well-known/openid-configuration", base), {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const doc = await res.json();
      if (typeof doc?.end_session_endpoint === "string") url = doc.end_session_endpoint;
    }
  } catch {
    // Authentik unreachable: use the conventional path below.
  }
  url ??= new URL("end-session/", base).toString();
  cached = { url, at: Date.now() };
  return url;
}

// Where Authentik should send the browser after logging out. Uses the
// configured app URL so it is correct behind proxies.
export function postLogoutRedirectUri(requestUrl: string): string {
  const appUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || requestUrl;
  return new URL("/sign-in", new URL(appUrl).origin).toString();
}

export async function authentikLogoutUrl(requestUrl: string): Promise<string> {
  const afterLogout = postLogoutRedirectUri(requestUrl);
  const endSession = await authentikEndSessionEndpoint();
  if (!endSession) return afterLogout;
  const url = new URL(endSession);
  // No id_token_hint: ID tokens are deliberately not stored. The OIDC
  // RP-Initiated Logout spec allows client_id to identify the app instead.
  if (process.env.AUTHENTIK_CLIENT_ID) url.searchParams.set("client_id", process.env.AUTHENTIK_CLIENT_ID);
  url.searchParams.set("post_logout_redirect_uri", afterLogout);
  return url.toString();
}
