import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { readProjectedCategories } from "./backfill-card-categories.mjs";

export const checkCardCategoryConsistency = (projection, database) => {
  const projectionByKey = new Map(projection.map((category) => [category.key, category]));
  const databaseByKey = new Map(database.map((category) => [category.key, category]));
  const sortOrderCounts = new Map();

  for (const category of database) {
    sortOrderCounts.set(
      category.sortOrder,
      (sortOrderCounts.get(category.sortOrder) ?? 0) + 1
    );
  }

  const duplicateSortOrders = Array.from(sortOrderCounts)
    .filter(([, count]) => count > 1)
    .map(([sortOrder]) => sortOrder);
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
  const orderMismatch = projection
    .filter((category) => databaseByKey.get(category.key)?.sortOrder !== category.sortOrder)
    .map((category) => ({
      key: category.key,
      projection: category.sortOrder,
      database: databaseByKey.get(category.key)?.sortOrder ?? null,
    }));
  const hidden = database
    .filter((category) => category.isVisible !== true)
    .map((category) => category.key);
  const emojiNotNull = database
    .filter((category) => category.emoji !== null)
    .map((category) => category.key);
  const nameMismatch = database
    .filter((category) => category.name !== category.key)
    .map((category) => category.key);

  return {
    ok:
      missing.length === 0 &&
      extra.length === 0 &&
      orderMismatch.length === 0 &&
      duplicateSortOrders.length === 0 &&
      sortOrderContinuous &&
      hidden.length === 0 &&
      emojiNotNull.length === 0 &&
      nameMismatch.length === 0,
    projection: projection.length,
    database: database.length,
    missing,
    extra,
    orderMismatch,
    duplicateSortOrders,
    sortOrderContinuous,
    hidden,
    emojiNotNull,
    nameMismatch,
  };
};

export const readDatabaseCategories = (prisma) =>
  prisma.communicationCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

const run = async () => {
  const prisma = new PrismaClient();

  try {
    const result = checkCardCategoryConsistency(
      await readProjectedCategories(prisma),
      await readDatabaseCategories(prisma)
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
