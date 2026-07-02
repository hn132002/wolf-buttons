import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { parseCategoryUpdateInput, projectAdminCardCategories } from "@/lib/cards";
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

    const parsed = parseCategoryUpdateInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { id } = await context.params;
    const existing = await prisma.communicationCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    if (parsed.data.name) {
      const duplicate = await prisma.communicationCategory.findFirst({
        where: { name: parsed.data.name, NOT: { id } },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json({ error: "分類名稱已存在" }, { status: 409 });
      }
    }

    const category = await prisma.communicationCategory.update({
      where: { id },
      data: parsed.data,
    });
    const cards = await prisma.communicationCard.findMany({
      where: { isVisible: true },
      select: { categories: true, isVisible: true },
    });

    return NextResponse.json({ category: projectAdminCardCategories([category], cards)[0] });
  } catch (error) {
    if (isMissingCategoryError(error)) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    console.error("更新分類失敗:", error);
    return NextResponse.json({ error: "更新分類失敗" }, { status: 500 });
  }
}
