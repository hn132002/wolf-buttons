import { NextResponse } from "next/server";

export const requireAdmin = (request: Request) => {
  const secret = process.env.ADMIN_SECRET;

  if (secret && request.headers.get("x-admin-secret") === secret) return null;

  return NextResponse.json({ error: "管理密碼錯誤" }, { status: 401 });
};
