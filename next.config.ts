import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone is used for voice notes; nothing else needs device access.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  // Kept narrow so it can't break scripts/styles/media; blocks framing, plugins and <base> hijacking.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Next buffers request bodies for middleware and silently truncates anything
    // larger (default 10MB), which breaks bigger uploads. Keep this just above
    // MAX_UPLOAD_BYTES in app/api/storage/upload/route.ts.
    middlewareClientMaxBodySize: "51mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
