import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  formatCardCategoryName,
  parseCategoryCreateInput,
  projectAdminCardCategories,
} from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const categoryOrderBy = [
  { sortOrder: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

const isUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export async function GET(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const categories = await prisma.communicationCategory.findMany({
      orderBy: categoryOrderBy,
    });
    const cards = await prisma.communicationCard.findMany({
      select: { categories: true, isVisible: true },
      orderBy: categoryOrderBy,
    });

    return NextResponse.json({
      categories: projectAdminCardCategories(categories, cards),
    });
  } catch (error) {
    console.error("讀取管理分類失敗:", error);
    return NextResponse.json({ error: "讀取管理分類失敗" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = requireAdmin(request);

    if (denied) return denied;

    const parsed = parseCategoryCreateInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const category = await prisma.$transaction(
      async (tx) => {
        const categoryKey = formatCardCategoryName(parsed.data);
        const duplicate = await tx.communicationCategory.findFirst({
          where: {
            OR: [{ key: categoryKey }, { name: parsed.data.name }],
          },
          select: { id: true },
        });

        if (duplicate) return null;

        const lastCategory = await tx.communicationCategory.findFirst({
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        return tx.communicationCategory.create({
          data: {
            key: categoryKey,
            name: parsed.data.name,
            emoji: parsed.data.emoji,
            sortOrder: (lastCategory?.sortOrder ?? -1) + 1,
            isVisible: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!category) {
      return NextResponse.json({ error: "分類名稱已存在" }, { status: 409 });
    }

    return NextResponse.json(
      { category: projectAdminCardCategories([category], [])[0] },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueError(error)) {
      return NextResponse.json({ error: "分類 key 已存在，請重試" }, { status: 409 });
    }

    console.error("新增管理分類失敗:", error);
    return NextResponse.json({ error: "新增管理分類失敗" }, { status: 500 });
  }
}
