import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { parseCategoryUpdateInput, projectAdminCardCategories } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const categoryOrderBy = [
  { sortOrder: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const { id } = await context.params;
    const result = await prisma.$transaction(
      async (tx) => {
        const category = await tx.communicationCategory.findUnique({
          where: { id },
          select: { id: true, key: true, name: true, emoji: true },
        });

        if (!category) return { status: 404 as const };

        const cardCount = await tx.communicationCard.count({
          where: { categories: { has: category.key } },
        });

        if (cardCount > 0) {
          return { status: 409 as const, cardCount };
        }

        await tx.communicationCategory.delete({ where: { id } });

        const categories = await tx.communicationCategory.findMany({
          orderBy: categoryOrderBy,
        });

        for (const [sortOrder, remainingCategory] of categories.entries()) {
          if (remainingCategory.sortOrder === sortOrder) continue;

          await tx.communicationCategory.update({
            where: { id: remainingCategory.id },
            data: { sortOrder },
          });
          remainingCategory.sortOrder = sortOrder;
        }

        return { status: 200 as const, deletedCategory: category, categories };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.status === 404) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    if (result.status === 409) {
      return NextResponse.json(
        {
          error: "CATEGORY_NOT_EMPTY",
          message: "此分類仍有字卡，無法刪除。",
          cardCount: result.cardCount,
        },
        { status: 409 }
      );
    }

    const cards = await prisma.communicationCard.findMany({
      select: { categories: true, isVisible: true },
      orderBy: categoryOrderBy,
    });

    return NextResponse.json({
      deletedCategory: result.deletedCategory,
      categories: projectAdminCardCategories(result.categories, cards),
    });
  } catch (error) {
    if (isMissingCategoryError(error)) {
      return NextResponse.json({ error: "找不到分類" }, { status: 404 });
    }

    console.error("刪除分類失敗:", error);
    return NextResponse.json({ error: "刪除分類失敗" }, { status: 500 });
  }
}
