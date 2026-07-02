import { NextResponse } from "next/server";
import { getAdminFailureStatus, hasAdminAccess } from "@/lib/admin-secret";
import { clearAdminSessionCookie, createAdminSessionCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const given = typeof body?.password === "string" ? body.password : null;

  if (!hasAdminAccess(process.env.ADMIN_SECRET, given)) {
    return NextResponse.json(
      { error: "管理驗證失敗" },
      { status: getAdminFailureStatus(given) }
    );
  }

  const cookie = createAdminSessionCookie(process.env.ADMIN_SECRET);
  if (!cookie) {
    return NextResponse.json({ error: "管理驗證失敗" }, { status: 401 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}

export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearAdminSessionCookie() } }
  );
}
