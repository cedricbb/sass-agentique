import { type NextRequest, NextResponse } from "next/server";

// Le middleware tourne dans l'Edge Runtime — pas d'import Node.js (postgres, bcrypt, crypto...)
// La validation DB (session, tenant, membership) est déléguée aux Server Components (layout.tsx)

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/set-password",
  "/portal-invitation-help",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Routes publiques — accès libre
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // /verify-2fa est semi-protégée : accessible uniquement avec un cookie totp-challenge actif
  if (pathname === "/verify-2fa" || pathname.startsWith("/verify-2fa/")) {
    const challengeToken = request.cookies.get("totp-challenge")?.value;
    if (!challengeToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Vérification légère : présence du cookie de session (pas de DB en Edge Runtime)
  const sessionToken =
    request.cookies.get("session-token")?.value ??
    request.cookies.get("__session")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // La validation complète (session DB) est faite dans
  // app/(customer)/account/layout.tsx qui tourne en Node.js runtime
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/inngest|api/auth|api/webhooks|api/stripe).*)",
  ],
};
