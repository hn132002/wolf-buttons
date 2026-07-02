import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { projectStoredCardCategories } from "../lib/cards.ts";
import { readProjectedCategories } from "./backfill-card-categories.mjs";

export const checkCardCategoryConsistency = (projection, database, categoryApiProjection = database) => {
  const projectionByKey = new Map(projection.map((category) => [category.key, category]));
  const databaseByKey = new Map(database.map((category) => [category.key, category]));
  const keyCounts = new Map();
  const sortOrderCounts = new Map();

  for (const category of database) {
    keyCounts.set(category.key, (keyCounts.get(category.key) ?? 0) + 1);
    sortOrderCounts.set(
      category.sortOrder,
      (sortOrderCounts.get(category.sortOrder) ?? 0) + 1
    );
  }

  const duplicateSortOrders = Array.from(sortOrderCounts)
    .filter(([, count]) => count > 1)
    .map(([sortOrder]) => sortOrder);
  const duplicateKeys = Array.from(keyCounts)
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const sortedOrders = database
    .map((category) => category.sortOrder)
    .sort((a, b) => a - b);
  const sortOrderContinuous = sortedOrders.every((sortOrder, index) => sortOrder === index);
  const missing = projection
    .filter((category) => !databaseByKey.has(category.key))
    .map((category) => category.key);
  const extra = database
    .filter((category) => !projectionByKey.has(category.key))
    .map((category) => category.key);
  const unknownCardCategories = missing;
  const emptyDatabaseCategories = extra;
  const legacyOrderMismatch = projection
    .filter((category) => databaseByKey.get(category.key)?.sortOrder !== category.sortOrder)
    .map((category) => ({
      key: category.key,
      projection: category.sortOrder,
      database: databaseByKey.get(category.key)?.sortOrder ?? null,
    }));
  const categoryApiCount = categoryApiProjection.length;

  return {
    ok:
      missing.length === 0 &&
      extra.length === 0 &&
      unknownCardCategories.length === 0 &&
      duplicateKeys.length === 0 &&
      duplicateSortOrders.length === 0 &&
      sortOrderContinuous &&
      categoryApiCount === database.length,
    projection: projection.length,
    database: database.length,
    missing,
    extra,
    unknownCardCategories,
    emptyDatabaseCategories,
    legacyOrderMismatch,
    duplicateKeys,
    duplicateSortOrders,
    sortOrderContinuous,
    categoryApiProjection: categoryApiCount,
  };
};

export const readDatabaseCategories = (prisma) =>
  prisma.communicationCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

export const readVisibleCardCategories = (prisma) =>
  prisma.communicationCard.findMany({
    where: { isVisible: true },
    select: { categories: true, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

const run = async () => {
  const prisma = new PrismaClient();

  try {
    const database = await readDatabaseCategories(prisma);
    const result = checkCardCategoryConsistency(
      await readProjectedCategories(prisma),
      database,
      projectStoredCardCategories(database, await readVisibleCardCategories(prisma))
    );

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
