import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { findUserByEmail } from "@/services/userService";

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("login_error", message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      return redirectWithError(request, "Email and password are required.");
    }

    const user = await findUserByEmail(email);
    if (!user || user.status !== "ACTIVE") {
      return redirectWithError(request, "Invalid email or password.");
    }
    if (!user.passwordHash) {
      return redirectWithError(request, "This Nexus user has no password configured. Ask Super Admin to reset it.");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return redirectWithError(request, "Invalid email or password.");
    }

    await createSession({
      email: user.email,
      username: user.email,
      name: user.fullName,
      userId: user.legacySourceId || user.id,
      roleId: user.role.code,
    });

    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return redirectWithError(request, message);
  }
}
