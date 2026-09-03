import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Development-only CSP exceptions follow the bundled Next.js 16 CSP guide:
 * React debugging needs eval and Turbopack injects styles while hot reloading.
 * Production remains nonce-based and never permits either unsafe source.
 */
export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean) {
  const scriptDevelopmentSource = isDevelopment ? " 'unsafe-eval'" : "";
  const styleSources = isDevelopment
    ? `'self' 'nonce-${nonce}' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}'`;
  const connectDevelopmentSources = isDevelopment ? " ws: wss:" : "";
  const upgradeInsecureRequests = isDevelopment
    ? ""
    : "upgrade-insecure-requests;";

  return `
    default-src 'self';
    base-uri 'self';
    object-src 'none';
    frame-ancestors 'none';
    form-action 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptDevelopmentSource};
    style-src ${styleSources};
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self'${connectDevelopmentSources};
    manifest-src 'self';
    worker-src 'self' blob:;
    frame-src 'none';
    ${upgradeInsecureRequests}
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", policy);

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-touch-icon.png|icon-192.png|icon-512.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
