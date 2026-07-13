import { NextRequest, NextResponse } from "next/server";
// Production-friendly route aliases for dashboard sections.

const routeSections: Record<string, string> = {
  "/login": "home",
  "/dashboard": "home",
  "/admin/users": "users",
  "/admin/candidates": "candidates",
  "/client/feedback": "feedback",
  "/resource/onboarding": "onboarding",
  "/operations/documents": "documents",
  "/operations/timesheets": "timesheets",
  "/operations/overtime": "overtime",
  "/operations/leave": "leave",
  "/finance/gr-invoices": "finance",
  "/help/guide": "guide",
};

export function proxy(request: NextRequest) {
  const section = routeSections[request.nextUrl.pathname];
  if (!section) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("section", section);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/admin/users",
    "/admin/candidates",
    "/client/feedback",
    "/resource/onboarding",
    "/operations/documents",
    "/operations/timesheets",
    "/operations/overtime",
    "/operations/leave",
    "/finance/gr-invoices",
    "/help/guide",
  ],
};
