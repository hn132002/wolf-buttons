import { NextResponse } from "next/server";
import { getAdminAuthResult } from "@/lib/admin-session";

export const requireAdmin = (request: Request) => {
  const result = getAdminAuthResult(process.env.ADMIN_SECRET, request);

  if (result.ok) return null;

  return NextResponse.json(
    { error: "管理驗證失敗" },
    { status: result.status }
  );
};
