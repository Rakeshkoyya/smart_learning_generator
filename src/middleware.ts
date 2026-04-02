import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/unauthorized", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const user = req.auth?.user;

  // Not authenticated → login
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin always has access
  if (user.role === "admin") {
    // Redirect root to admin
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // Not approved → unauthorized (except the unauthorized page itself)
  if (!user.is_approved) {
    if (pathname !== "/unauthorized") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
    return NextResponse.next();
  }

  // Approved user: block admin routes
  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/workspace", req.url));
  }

  // Redirect root to workspace for approved users
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/workspace", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
