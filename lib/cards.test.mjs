import assert from "node:assert/strict";

const {
  TSV_COLUMNS,
  exportCardsToTsv,
  getCardCategories,
  joinCategories,
  normalizeCategories,
  parseBatchTsv,
  parseTsvBoolean,
  previewBatchRows,
  sortCards,
} = await import("./cards.ts");
const { hasAdminAccess } = await import("./admin-secret.ts");

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

assert.deepEqual(normalizeCategories("⭐常用||🛑界線|⭐常用"), ["⭐常用", "🛑界線"]);
assert.equal(joinCategories(["⭐常用", "", "🛑界線"]), "⭐常用|🛑界線");
assert.deepEqual(getCardCategories(cards), ["⭐常用", "🛑界線", "🐾出毛"]);

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
