import assert from "node:assert/strict";

const {
  TSV_COLUMNS,
  exportCardsToTsv,
  getCardCategories,
  parseBatchTsv,
} = await import("./cards.ts");

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

assert.deepEqual(getCardCategories(cards), ["⭐常用", "🛑界線", "🐾出毛"]);
assert.equal(exportCardsToTsv(cards).split("\n")[0], TSV_COLUMNS.join("\t"));

const header = TSV_COLUMNS.join("\t");
const preview = parseBatchTsv(
  [
    header,
    "card-1\t⭐常用|⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\tThank you!\t\t10\tFALSE",
    "\t⭐常用\t⏳\t等一下\t待って\t請等一下。\t少し待ってください。\tPlease wait.\t\t30\tTRUE",
  ].join("\n"),
  cards,
  "replace"
);

assert.deepEqual(preview.errors, []);
assert.equal(preview.creates.length, 1);
assert.equal(preview.hides.length, 1);
assert.equal(preview.replaceDeletes.length, 1);
assert.deepEqual(preview.hides[0].categories, ["⭐常用"]);

const mergePreview = parseBatchTsv(
  [
    header,
    "card-1\t⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\tThank you!\t\t10\tTRUE",
  ].join("\n"),
  cards,
  "merge"
);

assert.deepEqual(mergePreview.errors, []);
assert.equal(mergePreview.updates.length, 1);
assert.equal(mergePreview.replaceDeletes.length, 0);

const errorPreview = parseBatchTsv(
  [
    header,
    "missing-id\t⭐常用\t🙏\t謝謝\tありがとう\t謝謝！\tありがとうございます！\t\t\t10\tTRUE",
    "\t⭐常用\t❌\t不行\tNG\t不行。\t難しいです。\t\t\t20\tFALSE",
  ].join("\n"),
  cards,
  "merge"
);

assert.deepEqual(errorPreview.errors, [
  "第 2 列：id 不存在，無法更新",
  "第 3 列：新增字卡不可直接設為隱藏",
]);

console.log("cards self-check ok");
