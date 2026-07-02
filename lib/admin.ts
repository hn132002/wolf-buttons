import { NextResponse } from "next/server";
import { getAdminFailureStatus, hasAdminAccess } from "@/lib/admin-secret";

export const requireAdmin = (request: Request) => {
  const given = request.headers.get("x-admin-secret");

  if (hasAdminAccess(process.env.ADMIN_SECRET, given)) {
    return null;
  }

  return NextResponse.json(
    { error: "管理驗證失敗" },
    { status: getAdminFailureStatus(given) }
  );
};
