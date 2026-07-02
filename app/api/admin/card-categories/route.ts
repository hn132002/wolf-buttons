import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { projectAdminCardCategories } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const categories = await prisma.communicationCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const cards = await prisma.communicationCard.findMany({
      where: { isVisible: true },
      select: { categories: true, isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      categories: projectAdminCardCategories(categories, cards),
    });
  } catch (error) {
    console.error("讀取管理分類失敗:", error);
    return NextResponse.json({ error: "讀取管理分類失敗" }, { status: 500 });
  }
}
