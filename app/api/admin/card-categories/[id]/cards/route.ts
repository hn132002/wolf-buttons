import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const { id } = await context.params;
    const category = await prisma.communicationCategory.findUnique({
      where: { id },
      select: { id: true, key: true, name: true },
    });

    if (!category) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    const result = await prisma.communicationCard.deleteMany({
      where: { categories: { has: category.key } },
    });

    return NextResponse.json({ deleted: result.count, category });
  } catch (error) {
    console.error("刪除分類字卡失敗:", error);
    return NextResponse.json({ error: "刪除分類字卡失敗" }, { status: 500 });
  }
}
