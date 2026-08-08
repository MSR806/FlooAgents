import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminAuthorization, isAdminPath } from "./lib/admin-auth.ts";

export function proxy(request: NextRequest) {
  if (!isAdminPath(request.nextUrl.pathname)) return NextResponse.next();

  const password = process.env.GILLY_WEB_ADMIN_PASSWORD;
  const adminToken = process.env.GILLY_ADMIN_TOKEN;
  if (!password || !adminToken) {
    return new NextResponse("Admin authentication is not configured", { status: 503 });
  }
  if (!isAdminAuthorization(request.headers.get("authorization"), password)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "www-authenticate": 'Basic realm="Gilly administration", charset="UTF-8"',
      },
    });
  }
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.set("x-admin-token", adminToken);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/connectors/:path*", "/api/composio/:path*", "/api/connectors/:path*"],
};
