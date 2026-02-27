import { type NextRequest, NextResponse } from "next/server";

// Routes accessibles sans authentification
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Récupère le session token (cookie à adapter selon l'auth provider)
  const sessionToken =
    request.cookies.get("session-token")?.value ??
    request.cookies.get("__session")?.value;

  const isAuthenticated = Boolean(sessionToken);

  // Redirige vers /login si non authentifié sur une route protégée
  if (!isPublicRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Placeholder : résolution du tenant (subdomain ou path)
  // TODO Phase 2 — multi-tenant : extraire tenantSlug du subdomain ou header
  const tenantSlug =
    request.headers.get("x-tenant-slug") ??
    request.nextUrl.hostname.split(".")[0];

  const response = NextResponse.next();

  // Injecte le tenant slug dans les headers pour les Server Components
  if (tenantSlug) {
    response.headers.set("x-tenant-slug", tenantSlug);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - /api/inngest (webhook public)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/inngest).*)",
  ],
};
