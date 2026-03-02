import { type NextRequest, NextResponse } from "next/server";
import { validateSession } from "@saas/services";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/accept-invitation",
];

const NON_TENANT_ROUTES = [...PUBLIC_ROUTES, "/onboarding"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isNonTenantRoute(pathname: string): boolean {
  return NON_TENANT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const sessionToken =
    request.cookies.get("session-token")?.value ??
    request.cookies.get("__session")?.value;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const sessionUser = await validateSession(sessionToken);
  if (!sessionUser) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isNonTenantRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-user-id", sessionUser.id);
    return response;
  }

  const tenantSlug = pathname.split("/").filter(Boolean)[0];

  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { getTenantBySlug, getUserRole } = await import("@saas/services");

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const userRole = await getUserRole(sessionUser.id, tenant.id);
  if (!userRole) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-tenant-id", tenant.id);
  response.headers.set("x-tenant-slug", tenant.slug);
  response.headers.set("x-tenant-plan", tenant.plan);
  response.headers.set("x-user-id", sessionUser.id);
  response.headers.set("x-user-role", userRole);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/inngest|api/auth).*)",
  ],
};
