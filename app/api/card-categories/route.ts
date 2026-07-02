import { NextResponse } from "next/server";
import { projectCardCategories } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await prisma.communicationCard.findMany({
      where: { isVisible: true },
      select: { categories: true, isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({ categories: projectCardCategories(cards) });
  } catch (error) {
    console.error("讀取分類投影失敗:", error);
    return NextResponse.json({ error: "讀取分類投影失敗" }, { status: 500 });
  }
}
