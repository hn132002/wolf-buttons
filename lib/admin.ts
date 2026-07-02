import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin-secret";

export const requireAdmin = (request: Request) => {
  if (hasAdminAccess(process.env.ADMIN_SECRET, request.headers.get("x-admin-secret"))) {
    return null;
  }

  return NextResponse.json({ error: "管理驗證失敗" }, { status: 401 });
};
