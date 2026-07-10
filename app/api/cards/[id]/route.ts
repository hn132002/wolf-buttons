import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { parseCardInput, resolveCardCategoryKeys, serializeCard } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isMissingCardError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const { id } = await context.params;
    const parsed = parseCardInput(await request.json().catch(() => null), {
      partial: true,
    });

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    let missingKeys: string[] = [];

    if (parsed.data.categories) {
      const categories = await prisma.communicationCategory.findMany({
        select: { key: true, name: true, emoji: true },
      });
      const resolvedCategories = resolveCardCategoryKeys(parsed.data.categories, categories, {
        allowMissing: true,
      });

      if (!resolvedCategories.ok) {
        return NextResponse.json(
          { error: resolvedCategories.error },
          { status: resolvedCategories.status }
        );
      }

      const existingKeys = new Set(categories.map((category) => category.key));
      missingKeys = resolvedCategories.categories.filter(
        (category) => !existingKeys.has(category)
      );
      parsed.data.categories = resolvedCategories.categories;
    }

    const card = await prisma.$transaction(async (tx) => {
      if (missingKeys.length > 0) {
        const lastCategory = await tx.communicationCategory.findFirst({
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        await tx.communicationCategory.createMany({
          data: missingKeys.map((key, index) => ({
            key,
            name: key,
            emoji: null,
            sortOrder: (lastCategory?.sortOrder ?? -1) + index + 1,
            isVisible: true,
          })),
          skipDuplicates: true,
        });
      }

      return tx.communicationCard.update({
        where: { id },
        data: parsed.data,
      });
    });

    return NextResponse.json(serializeCard(card));
  } catch (error) {
    if (isMissingCardError(error)) {
      return NextResponse.json({ error: "找不到字卡" }, { status: 404 });
    }

    console.error("更新字卡失敗:", error);
    return NextResponse.json({ error: "更新字卡失敗" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const { id } = await context.params;
    const card = await prisma.communicationCard.delete({ where: { id } });

    return NextResponse.json(serializeCard(card));
  } catch (error) {
    if (isMissingCardError(error)) {
      return NextResponse.json({ error: "找不到字卡" }, { status: 404 });
    }

    console.error("刪除字卡失敗:", error);
    return NextResponse.json({ error: "刪除字卡失敗" }, { status: 500 });
  }
}
