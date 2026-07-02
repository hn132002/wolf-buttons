import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { projectCardCategories } from "../lib/cards.ts";

export const readProjectedCategories = async (prisma) => {
  const cards = await prisma.communicationCard.findMany({
    select: { categories: true, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  return projectCardCategories(cards);
};

export const backfillCardCategories = async (prisma) => {
  const categories = await readProjectedCategories(prisma);
  const result = {
    projection: categories.length,
    created: 0,
    existing: 0,
    updatedSortOrder: 0,
    errors: 0,
  };

  for (const category of categories) {
    try {
      const existing = await prisma.communicationCategory.findUnique({
        where: { key: category.key },
      });

      if (existing) {
        result.existing += 1;
        if (existing.sortOrder !== category.sortOrder) result.updatedSortOrder += 1;
      } else {
        result.created += 1;
      }

      await prisma.communicationCategory.upsert({
        where: { key: category.key },
        create: {
          key: category.key,
          name: category.name,
          emoji: null,
          sortOrder: category.sortOrder,
          isVisible: true,
        },
        update: { sortOrder: category.sortOrder },
      });
    } catch (error) {
      result.errors += 1;
      console.error(`backfill failed for category ${category.key}:`, error);
    }
  }

  return result;
};

const run = async () => {
  const prisma = new PrismaClient();

  try {
    const result = await backfillCardCategories(prisma);

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.errors === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
