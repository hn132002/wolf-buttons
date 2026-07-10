import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  DELETE_ALL_CONFIRMATION,
  getCardCategories,
  parseCardInput,
  resolveCardCategoryKeys,
  serializeCard,
} from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const includeHidden = new URL(request.url).searchParams.get("includeHidden") === "1";

    if (includeHidden) {
      const denied = requireAdmin(request);

      if (denied) return denied;
    }

    const cards = await prisma.communicationCard.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const serializedCards = cards.map(serializeCard);

    return NextResponse.json({
      categories: getCardCategories(serializedCards),
      cards: serializedCards,
    });
  } catch (error) {
    console.error("讀取字卡失敗:", error);
    return NextResponse.json({ error: "讀取字卡失敗" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const parsed = parseCardInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

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

    const card = await prisma.$transaction(async (tx) => {
      const existingKeys = new Set(categories.map((category) => category.key));
      const missingKeys = resolvedCategories.categories.filter(
        (category) => !existingKeys.has(category)
      );

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

      return tx.communicationCard.create({
        data: {
          emoji: parsed.data.emoji ?? "",
          label: parsed.data.label ?? "",
          labelJa: parsed.data.labelJa ?? null,
          zh: parsed.data.zh ?? "",
          ja: parsed.data.ja ?? "",
          en: parsed.data.en ?? null,
          note: parsed.data.note ?? null,
          categories: resolvedCategories.categories,
          sortOrder: parsed.data.sortOrder ?? 0,
          isVisible: true,
        },
      });
    });

    return NextResponse.json(serializeCard(card), { status: 201 });
  } catch (error) {
    console.error("新增字卡失敗:", error);
    return NextResponse.json({ error: "新增字卡失敗" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as {
      confirm?: unknown;
    } | null;

    if (body?.confirm !== DELETE_ALL_CONFIRMATION) {
      return NextResponse.json({ error: "清空確認失敗" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [cards, categories] = await Promise.all([
        tx.communicationCard.deleteMany(),
        tx.communicationCategory.deleteMany(),
      ]);

      return { deletedCards: cards.count, deletedCategories: categories.count };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("清空字卡與分類失敗:", error);
    return NextResponse.json({ error: "清空字卡與分類失敗" }, { status: 500 });
  }
}
