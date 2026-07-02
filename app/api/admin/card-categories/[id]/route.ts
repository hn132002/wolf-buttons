import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { parseCategoryVisibilityInput } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isMissingCategoryError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const parsed = parseCategoryVisibilityInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { id } = await context.params;
    const category = await prisma.communicationCategory.update({
      where: { id },
      data: { isVisible: parsed.isVisible },
      select: {
        id: true,
        key: true,
        name: true,
        emoji: true,
        sortOrder: true,
        isVisible: true,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    if (isMissingCategoryError(error)) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    console.error("更新分類顯示狀態失敗:", error);
    return NextResponse.json({ error: "更新分類顯示狀態失敗" }, { status: 500 });
  }
}
