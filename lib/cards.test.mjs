import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backfillCardCategories } from "../scripts/backfill-card-categories.mjs";
import { checkCardCategoryConsistency } from "../scripts/check-card-category-consistency.mjs";

const {
  TSV_COLUMNS,
  exportCardsToTsv,
  getCardCategories,
  joinCategories,
  normalizeCategories,
  parseBatchTsv,
  parseTsvBoolean,
  projectCardCategories,
  previewBatchRows,
  sortCards,
} = await import("./cards.ts");
const { hasAdminAccess } = await import("./admin-secret.ts");

const makeFakePrisma = (seedCards, seedCategories = []) => {
  const storedCards = structuredClone(seedCards);
  const storedCategories = structuredClone(seedCategories);
  let nextCategoryId = storedCategories.length + 1;

  return {
    storedCards,
    storedCategories,
    communicationCard: {
      findMany: async () => structuredClone(storedCards),
    },
    communicationCategory: {
      findUnique: async ({ where }) =>
        structuredClone(storedCategories.find((category) => category.key === where.key) ?? null),
      upsert: async ({ where, create, update }) => {
        const existing = storedCategories.find((category) => category.key === where.key);

        if (existing) {
          Object.assign(existing, update);
          return structuredClone(existing);
        }

        const category = {
          id: `category-${nextCategoryId++}`,
          ...create,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        storedCategories.push(category);
        return structuredClone(category);
      },
      findMany: async () => structuredClone(storedCategories),
    },
  };
};

const cards = [
  {
    id: "card-1",
    emoji: "🙏",
    label: "謝謝",
    labelJa: "ありがとう",
    zh: "謝謝！",
    ja: "ありがとうございます！",
    en: "Thank you!",
    note: null,
    categories: ["⭐常用", "🛑界線"],
    sortOrder: 10,
    isVisible: true,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
  {
    id: "card-2",
    emoji: "🐾",
    label: "出毛",
    labelJa: "",
    zh: "我要出門。",
    ja: "出かけます。",
    en: "",
    note: "",
    categories: ["🐾出毛", "⭐常用"],
    sortOrder: 20,
    isVisible: false,
    createdAt: "2026-07-02T00:01:00.000Z",
    updatedAt: "2026-07-02T00:01:00.000Z",
  },
];
const header = TSV_COLUMNS.join("\t");
const projectionCard = (id, categories, sortOrder, isVisible = true) => ({
  id,
  categories,
  sortOrder,
  isVisible,
  createdAt: new Date(Date.UTC(2026, 6, 2, 0, 0, sortOrder)).toISOString(),
});
const countedCards = (category, count, start) =>
  Array.from({ length: count }, (_, index) =>
    projectionCard(`${category}-${index}`, [category], start + index)
  );
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

assert.match(schema, /model CommunicationCategory \{/);
assert.match(schema, /key\s+String\s+@unique/);
assert.match(schema, /emoji\s+String\?/);
assert.match(schema, /sortOrder\s+Int\s+@default\(0\)/);
assert.match(schema, /isVisible\s+Boolean\s+@default\(true\)/);
assert.match(schema, /@@index\(\[sortOrder\]\)/);

assert.deepEqual(normalizeCategories("⭐常用||🛑界線|⭐常用"), ["⭐常用", "🛑界線"]);
assert.equal(joinCategories(["⭐常用", "", "🛑界線"]), "⭐常用|🛑界線");
assert.deepEqual(getCardCategories(cards), ["⭐常用", "🛑界線", "🐾出毛"]);

const projection = projectCardCategories(
  sortCards([
    projectionCard("last", ["最後"], 99),
    projectionCard("first", ["最初", "多分類 A", "多分類 B", "最初", ""], 0),
    projectionCard("dedupe", ["重複", "重複"], 1),
    projectionCard("hidden", ["隱藏"], 2, false),
    ...countedCards("1 張", 1, 10),
    ...countedCards("9 張", 9, 20),
    ...countedCards("10 張", 10, 40),
    ...countedCards("18 張", 18, 60),
    ...countedCards("19 張", 19, 90),
  ])
);
const byKey = new Map(projection.map((category) => [category.key, category]));

assert.deepEqual(projection.slice(0, 4).map((category) => category.key), [
  "最初",
  "多分類 A",
  "多分類 B",
  "重複",
]);
assert.equal(projection.filter((category) => category.key === "19 張").length, 1);
assert.equal(byKey.get("多分類 A").cardCount, 1);
assert.equal(byKey.get("多分類 B").cardCount, 1);
assert.equal(byKey.get("重複").cardCount, 1);
assert.equal(byKey.has(""), false);
assert.equal(byKey.has("隱藏"), false);
assert.equal(byKey.get("1 張").pageCount, 1);
assert.equal(byKey.get("9 張").pageCount, 1);
assert.equal(byKey.get("10 張").pageCount, 2);
assert.equal(byKey.get("18 張").pageCount, 2);
assert.equal(byKey.get("19 張").pageCount, 3);
assert.deepEqual(projection.map((category) => category.sortOrder), projection.map((_, index) => index));
assert.deepEqual(projectCardCategories([]), []);

const sevenCategoryCards = Array.from({ length: 7 }, (_, index) =>
  projectionCard(`seed-${index}`, [`分類 ${index}`], index)
);
const fakePrisma = makeFakePrisma(sevenCategoryCards);
const firstBackfill = await backfillCardCategories(fakePrisma);
const cardsBeforeSecondBackfill = structuredClone(fakePrisma.storedCards);
const categoriesBeforeSecondBackfill = structuredClone(fakePrisma.storedCategories);
const secondBackfill = await backfillCardCategories(fakePrisma);

assert.deepEqual(firstBackfill, {
  projection: 7,
  created: 7,
  existing: 0,
  updatedSortOrder: 0,
  errors: 0,
});
assert.deepEqual(secondBackfill, {
  projection: 7,
  created: 0,
  existing: 7,
  updatedSortOrder: 0,
  errors: 0,
});
assert.equal(fakePrisma.storedCategories.length, 7);
assert.deepEqual(
  fakePrisma.storedCategories.map((category) => category.sortOrder),
  [0, 1, 2, 3, 4, 5, 6]
);
assert.deepEqual(fakePrisma.storedCards, cardsBeforeSecondBackfill);
assert.deepEqual(fakePrisma.storedCategories, categoriesBeforeSecondBackfill);

const edgeBackfillPrisma = makeFakePrisma([
  projectionCard("multi", ["A", "B", "A", ""], 0),
]);
const edgeBackfill = await backfillCardCategories(edgeBackfillPrisma);

assert.equal(edgeBackfill.created, 2);
assert.deepEqual(edgeBackfillPrisma.storedCategories.map((category) => category.key), ["A", "B"]);
assert.deepEqual(
  edgeBackfillPrisma.storedCards[0].categories,
  ["A", "B", "A", ""]
);

const emptyBackfillPrisma = makeFakePrisma([]);
const emptyBackfill = await backfillCardCategories(emptyBackfillPrisma);

assert.equal(emptyBackfill.created, 0);
assert.equal(emptyBackfillPrisma.storedCategories.length, 0);

const expectedDbCategories = projection.map((category) => ({
  ...category,
  id: `db-${category.sortOrder}`,
  emoji: null,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
}));
const consistentCategories = checkCardCategoryConsistency(projection, expectedDbCategories);

assert.equal(consistentCategories.ok, true);
assert.equal(
  checkCardCategoryConsistency(projection, expectedDbCategories.slice(1)).missing.length,
  1
);
assert.equal(
  checkCardCategoryConsistency(projection, [
    ...expectedDbCategories,
    {
      id: "extra",
      key: "多餘",
      name: "多餘",
      emoji: null,
      sortOrder: expectedDbCategories.length,
      isVisible: true,
    },
  ]).extra.length,
  1
);
assert.equal(
  checkCardCategoryConsistency(projection, [
    { ...expectedDbCategories[0], sortOrder: 9 },
    ...expectedDbCategories.slice(1),
  ]).orderMismatch.length,
  1
);
assert.deepEqual(
  checkCardCategoryConsistency(projection, [
    expectedDbCategories[0],
    { ...expectedDbCategories[1], sortOrder: expectedDbCategories[0].sortOrder },
    ...expectedDbCategories.slice(2),
  ]).duplicateSortOrders,
  [0]
);

assert.equal(parseTsvBoolean("TRUE"), true);
assert.equal(parseTsvBoolean("false"), false);
assert.equal(parseTsvBoolean("1"), true);
assert.equal(parseTsvBoolean("0"), false);
assert.equal(parseTsvBoolean("yes"), null);

assert.equal(exportCardsToTsv(cards).split("\n")[0], header);
assert.equal(exportCardsToTsv([]), header);

const publicCards = sortCards(cards.filter((card) => card.isVisible));
assert.deepEqual(publicCards.map((card) => card.id), ["card-1"]);
assert.deepEqual(getCardCategories([]), []);

const oldSecret = process.env.ADMIN_SECRET;
delete process.env.ADMIN_SECRET;
assert.equal(hasAdminAccess(process.env.ADMIN_SECRET, null), false);
process.env.ADMIN_SECRET = "secret";
assert.equal(hasAdminAccess(process.env.ADMIN_SECRET, null), false);
assert.equal(hasAdminAccess(process.env.ADMIN_SECRET, "bad"), false);
assert.equal(hasAdminAccess(process.env.ADMIN_SECRET, "secret"), true);
if (oldSecret === undefined) {
  delete process.env.ADMIN_SECRET;
} else {
  process.env.ADMIN_SECRET = oldSecret;
}

const replacePreview = parseBatchTsv(
  [
    header,
    "card-1\t⭐常用|⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\tThank you!\t\t10\tFALSE",
    "\t⭐常用\t⏳\t等一下\t待って\t請等一下。\t少し待ってください。\tPlease wait.\t\t30\tTRUE",
  ].join("\n"),
  cards,
  "replace"
);

assert.deepEqual(replacePreview.errors, []);
assert.equal(replacePreview.totalRows, 2);
assert.equal(replacePreview.rows.length, 2);
assert.equal(replacePreview.creates.length, 1);
assert.equal(replacePreview.updates.length, 1);
assert.equal(replacePreview.hides.length, 1);
assert.equal(replacePreview.replaceDeletes.length, 1);
assert.deepEqual(replacePreview.hides[0].categories, ["⭐常用"]);

const upsertPreview = parseBatchTsv(
  [
    header,
    "card-1\t⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\tThank you!\t\t10\tTRUE",
  ].join("\n"),
  cards,
  "upsert"
);

assert.deepEqual(upsertPreview.errors, []);
assert.equal(upsertPreview.updates.length, 1);
assert.equal(upsertPreview.replaceDeletes.length, 0);

const showPreview = parseBatchTsv(
  [
    header,
    "card-2\t🐾出毛\t🐾\t出毛\t外出\t我要出門。\t出かけます。\t\t\t20\tTRUE",
  ].join("\n"),
  cards,
  "upsert"
);
assert.equal(showPreview.shows.length, 1);

const errorPreview = parseBatchTsv(
  [
    header,
    "missing-id\t⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\t\t\t10\tTRUE",
    "\t⭐常用\t❌\t不行\tNG\t不行。\t難しいです。\t\t\t20\tFALSE",
  ].join("\n"),
  cards,
  "upsert"
);

assert.deepEqual(errorPreview.errors, [
  "第 2 列：id 不存在，無法更新",
  "第 3 列：新增字卡不可直接設為隱藏",
]);

const serverPreview = previewBatchRows(
  [{ ...upsertPreview.rows[0], sortOrder: "10" }],
  cards,
  "upsert"
);
assert.deepEqual(serverPreview.errors, ["第 1 列：sortOrder 必須是整數"]);

let fakeStore = structuredClone(cards);
fakeStore = fakeStore.filter((card) => card.id !== "card-1");
assert.equal(fakeStore.some((card) => card.id === "card-1"), false);

const transactional = async (work) => {
  const draft = structuredClone(fakeStore);

  await work(draft);
  fakeStore = draft;
};
const before = structuredClone(fakeStore);
await assert.rejects(
  transactional(async (draft) => {
    draft[0].label = "已更新";
    throw new Error("boom");
  })
);
assert.deepEqual(fakeStore, before);

const zeroPreview = parseBatchTsv(header, [], "upsert");
assert.deepEqual(zeroPreview.errors, []);
assert.equal(zeroPreview.totalRows, 0);

console.log("cards self-check ok");
