import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  parseCategoryOrderInput,
  projectAdminCardCategories,
  validateCategoryOrderIds,
} from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const categoryOrderBy = [
  { sortOrder: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

export async function PATCH(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const parsed = parseCategoryOrderInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const currentCategories = await prisma.communicationCategory.findMany({
      orderBy: categoryOrderBy,
    });
    const validated = validateCategoryOrderIds(
      parsed.categoryIds,
      currentCategories.map((category) => category.id)
    );

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const categories = await prisma.$transaction(async (tx) => {
      for (const [index, id] of validated.categoryIds.entries()) {
        await tx.communicationCategory.update({
          where: { id },
          data: { sortOrder: -index - 1 },
        });
      }

      for (const [index, id] of validated.categoryIds.entries()) {
        await tx.communicationCategory.update({
          where: { id },
          data: { sortOrder: index },
        });
      }

      return tx.communicationCategory.findMany({ orderBy: categoryOrderBy });
    });
    const cards = await prisma.communicationCard.findMany({
      select: { categories: true, isVisible: true },
      orderBy: categoryOrderBy,
    });

    return NextResponse.json({
      categories: projectAdminCardCategories(categories, cards),
    });
  } catch (error) {
    console.error("更新分類順序失敗:", error);
    return NextResponse.json({ error: "更新分類順序失敗" }, { status: 500 });
  }
}
