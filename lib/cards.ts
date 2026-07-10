export type CommunicationCard = {
  id: string;
  emoji: string;
  label: string;
  labelJa: string | null;
  zh: string;
  ja: string;
  en: string | null;
  note: string | null;
  categories: string[];
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardsResponse = {
  categories: string[];
  cards: CommunicationCard[];
};

export type CardCategoryProjection = {
  key: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
  isVisible: boolean;
  cardCount: number;
  pageCount: number;
};

export type AdminCardCategoryProjection = CardCategoryProjection & {
  id: string;
};

export type CardCategoriesResponse = {
  categories: CardCategoryProjection[];
};

export type AdminCardCategoriesResponse = {
  categories: AdminCardCategoryProjection[];
};

type StoredCardCategory = {
  id: string;
  key: string;
  name: string;
  emoji: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: Date | string;
};

export type CardWriteData = {
  emoji?: string;
  label?: string;
  labelJa?: string | null;
  zh?: string;
  ja?: string;
  en?: string | null;
  note?: string | null;
  categories?: string[];
  sortOrder?: number;
  isVisible?: boolean;
};

export type BatchApplyMode = "upsert" | "replace";

export type BatchCardRow = {
  id: string;
  categories: string[];
  emoji: string;
  label: string;
  labelJa: string;
  zh: string;
  ja: string;
  en: string;
  note: string;
  sortOrder: number;
  isVisible: boolean;
};

export type BatchPreview = {
  totalRows: number;
  rows: BatchCardRow[];
  creates: BatchCardRow[];
  updates: BatchCardRow[];
  hides: BatchCardRow[];
  shows: BatchCardRow[];
  replaceDeletes: CommunicationCard[];
  errors: string[];
};

export const DELETE_ALL_CONFIRMATION = "DELETE_ALL_CARDS_AND_CATEGORIES";
export const UNCATEGORIZED_CATEGORY_KEY = "__uncategorized__";
export const UNCATEGORIZED_CATEGORY_NAME = "未分類";

export const TSV_COLUMNS = [
  "id",
  "category",
  "label",
  "labelJa",
  "zh",
  "ja",
  "en",
] as const;

type TsvColumn = (typeof TSV_COLUMNS)[number];

type ParseResult =
  | { ok: true; data: CardWriteData }
  | { ok: false; error: string; status: number };

type CategoryVisibilityParseResult =
  | { ok: true; isVisible: boolean }
  | { ok: false; error: string; status: number };

type CategoryCreateParseResult =
  | { ok: true; data: { name: string; emoji: string | null } }
  | { ok: false; error: string; status: number };

type CategoryUpdateParseResult =
  | { ok: true; data: { name?: string; emoji?: string | null; isVisible?: boolean } }
  | { ok: false; error: string; status: number };

type CategoryOrderParseResult =
  | { ok: true; categoryIds: string[] }
  | { ok: false; error: string; status: number };

const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export const displayText = (value: string | null | undefined) => cleanText(value) || "-";
const codePointLength = (value: string) => Array.from(value).length;

const hasOwn = (body: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(body, key);

const emptyPreview = (): BatchPreview => ({
  totalRows: 0,
  rows: [],
  creates: [],
  updates: [],
  hides: [],
  shows: [],
  replaceDeletes: [],
  errors: [],
});

export const normalizeCategories = (value: unknown) => {
  const source =
    typeof value === "string" ? value.split("|") : Array.isArray(value) ? value : [];

  return Array.from(
    new Set(source.map((category) => cleanText(category)).filter(Boolean))
  );
};

const normalizeCardCategories = (value: unknown) =>
  normalizeCategories(value).filter(
    (category) =>
      category !== UNCATEGORIZED_CATEGORY_KEY &&
      category !== UNCATEGORIZED_CATEGORY_NAME
  );

export const joinCategories = (categories: unknown) =>
  normalizeCategories(categories).join("|");

const collectCardCategories = (
  cards: Pick<CommunicationCard, "categories">[]
): CardCategoryProjection[] => {
  const counts = new Map<string, number>();

  for (const card of cards) {
    const categories = normalizeCategories(card.categories);

    if (categories.length === 0) {
      counts.set(
        UNCATEGORIZED_CATEGORY_KEY,
        (counts.get(UNCATEGORIZED_CATEGORY_KEY) ?? 0) + 1
      );
      continue;
    }

    for (const category of categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([category, cardCount], sortOrder) => ({
    key: category,
    name: category === UNCATEGORIZED_CATEGORY_KEY ? UNCATEGORIZED_CATEGORY_NAME : category,
    emoji: null,
    sortOrder,
    isVisible: true,
    cardCount,
    pageCount: Math.ceil(cardCount / 9),
  }));
};

export const getCardCategories = (
  cards: Pick<CommunicationCard, "categories">[]
) => collectCardCategories(cards).map((category) => category.key);

export const projectCardCategories = (
  cards: Pick<CommunicationCard, "categories" | "isVisible">[]
) => collectCardCategories(cards);

const compareStoredCategories = (a: StoredCardCategory, b: StoredCardCategory) => {
  const createdA = a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt;
  const createdB = b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt;

  return a.sortOrder - b.sortOrder || createdA.localeCompare(createdB) || a.id.localeCompare(b.id);
};

export const projectStoredCardCategories = (
  categories: StoredCardCategory[],
  cards: Pick<CommunicationCard, "categories" | "isVisible">[]
): CardCategoryProjection[] => {
  const categoryKeys = new Set(categories.map((category) => category.key));
  const counts = new Map<string, number>();

  for (const card of cards) {
    if (!Array.isArray(card.categories)) continue;

    for (const category of new Set(card.categories)) {
      if (typeof category !== "string" || !categoryKeys.has(category)) continue;

      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return [...categories].sort(compareStoredCategories).map((category) => {
    const cardCount = counts.get(category.key) ?? 0;

    return {
      key: category.key,
      name: category.name,
      emoji: category.emoji,
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      cardCount,
      pageCount: Math.ceil(cardCount / 9),
    };
  });
};

export const projectPublicCardCategories = (
  categories: StoredCardCategory[],
  cards: Pick<CommunicationCard, "categories" | "isVisible">[]
) => {
  const stored = projectStoredCardCategories(categories, cards).filter(
    (category) => category.isVisible && category.cardCount > 0
  );
  const storedKeys = new Set(categories.map((category) => category.key));
  const missing = projectCardCategories(cards).filter(
    (category) => !storedKeys.has(category.key)
  );

  return [...stored, ...missing];
};

export const projectAdminCardCategories = (
  categories: StoredCardCategory[],
  cards: Pick<CommunicationCard, "categories" | "isVisible">[]
): AdminCardCategoryProjection[] => {
  const byKey = new Map(categories.map((category) => [category.key, category]));
  const allCards = cards.map((card) => ({ ...card, isVisible: true }));

  return projectStoredCardCategories(categories, allCards).map((category) => {
    const stored = byKey.get(category.key)!;

    return {
      id: stored.id,
      ...category,
    };
  });
};

export const formatCardCategoryName = (
  category: Pick<CardCategoryProjection, "name" | "emoji">
) => (category.emoji ? `${category.emoji} ${category.name}` : category.name);

export const countCardsByCategoryKey = (
  cards: Pick<CommunicationCard, "categories">[],
  key: string
) =>
  cards.reduce(
    (count, card) =>
      Array.isArray(card.categories) &&
      (key === UNCATEGORIZED_CATEGORY_KEY
        ? normalizeCategories(card.categories).length === 0
        : card.categories.includes(key))
        ? count + 1
        : count,
    0
  );

export const resolveCardCategoryKeys = (
  inputCategories: unknown,
  storedCategories: Pick<StoredCardCategory, "key" | "name" | "emoji">[],
  options: { allowMissing?: boolean } = {}
) => {
  const aliases = new Map<string, string>();

  for (const category of storedCategories) {
    for (const alias of [category.key, category.name, formatCardCategoryName(category)]) {
      if (alias && !aliases.has(alias)) aliases.set(alias, category.key);
    }
  }

  const resolved: string[] = [];
  const missing: string[] = [];

  for (const category of normalizeCardCategories(inputCategories)) {
    const key = aliases.get(category);

    if (!key) {
      if (options.allowMissing) {
        if (!resolved.includes(category)) resolved.push(category);
        continue;
      }

      missing.push(category);
      continue;
    }

    if (!resolved.includes(key)) resolved.push(key);
  }

  if (missing.length > 0) {
    return { ok: false as const, error: `找不到分類：${missing.join("、")}`, status: 400 };
  }

  return { ok: true as const, categories: resolved };
};

const parseCategoryNameValue = (
  value: unknown
): string | { ok: false; error: string; status: number } => {
  if (typeof value !== "string") {
    return { ok: false, error: "分類名稱必須是字串", status: 400 };
  }

  const name = value.trim();

  if (!name) return { ok: false, error: "分類名稱必填", status: 400 };
  if (/[\r\n]/.test(name)) {
    return { ok: false, error: "分類名稱不可包含換行", status: 400 };
  }
  if (codePointLength(name) > 30) {
    return { ok: false, error: "分類名稱最多 30 字", status: 400 };
  }

  return name;
};

const parseCategoryEmojiValue = (
  value: unknown
): string | null | { ok: false; error: string; status: number } => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return { ok: false, error: "Emoji 必須是字串", status: 400 };
  }

  const emoji = value.trim();

  if (!emoji) return null;
  if (codePointLength(emoji) > 8) {
    return { ok: false, error: "Emoji 最多 8 個字元", status: 400 };
  }
  if (/[\p{Letter}\p{Number}]/u.test(emoji) || !/\p{Extended_Pictographic}/u.test(emoji)) {
    return { ok: false, error: "Emoji 格式不正確", status: 400 };
  }

  return emoji;
};

const isCategoryParseError = (
  value: unknown
): value is { ok: false; error: string; status: number } =>
  Boolean(value && typeof value === "object" && "ok" in value && value.ok === false);

export const parseCategoryCreateInput = (
  body: unknown
): CategoryCreateParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "資料格式不正確", status: 400 };
  }

  const source = body as Record<string, unknown>;
  const allowed = new Set(["name", "emoji"]);

  if (Object.keys(source).some((key) => !allowed.has(key))) {
    return { ok: false, error: "只允許新增 name、emoji", status: 400 };
  }
  if (!hasOwn(source, "name")) {
    return { ok: false, error: "分類名稱必填", status: 400 };
  }

  const name = parseCategoryNameValue(source.name);
  if (isCategoryParseError(name)) return name;

  const emoji = parseCategoryEmojiValue(source.emoji);
  if (isCategoryParseError(emoji)) return emoji;

  return { ok: true, data: { name, emoji } };
};

export const parseCategoryUpdateInput = (
  body: unknown
): CategoryUpdateParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "資料格式不正確", status: 400 };
  }

  const source = body as Record<string, unknown>;
  const allowed = new Set(["name", "emoji", "isVisible"]);

  if (Object.keys(source).some((key) => !allowed.has(key))) {
    return { ok: false, error: "只允許更新 name、emoji、isVisible", status: 400 };
  }

  const data: { name?: string; emoji?: string | null; isVisible?: boolean } = {};

  if (hasOwn(source, "name")) {
    const name = parseCategoryNameValue(source.name);
    if (isCategoryParseError(name)) return name;
    data.name = name;
  }

  if (hasOwn(source, "emoji")) {
    const emoji = parseCategoryEmojiValue(source.emoji);
    if (isCategoryParseError(emoji)) return emoji;
    data.emoji = emoji;
  }

  if (hasOwn(source, "isVisible")) {
    if (typeof source.isVisible !== "boolean") {
      return { ok: false, error: "顯示狀態格式不正確", status: 400 };
    }

    data.isVisible = source.isVisible;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "缺少可更新欄位", status: 400 };
  }

  return { ok: true, data };
};

export const parseCategoryVisibilityInput = (
  body: unknown
): CategoryVisibilityParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "資料格式不正確", status: 400 };
  }

  const source = body as Record<string, unknown>;
  const keys = Object.keys(source);

  if (keys.length !== 1 || !hasOwn(source, "isVisible")) {
    return { ok: false, error: "只允許更新 isVisible", status: 400 };
  }

  if (typeof source.isVisible !== "boolean") {
    return { ok: false, error: "顯示狀態格式不正確", status: 400 };
  }

  return { ok: true, isVisible: source.isVisible };
};

export const parseCategoryOrderInput = (
  body: unknown
): CategoryOrderParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "資料格式不正確", status: 400 };
  }

  const source = body as Record<string, unknown>;

  if (!hasOwn(source, "categoryIds")) {
    return { ok: false, error: "categoryIds 必填", status: 400 };
  }

  if (!Array.isArray(source.categoryIds)) {
    return { ok: false, error: "categoryIds 必須是陣列", status: 400 };
  }

  if (
    source.categoryIds.some(
      (categoryId) => typeof categoryId !== "string" || categoryId.trim() === ""
    )
  ) {
    return { ok: false, error: "categoryIds 必須都是非空字串", status: 400 };
  }

  const categoryIds = source.categoryIds.map((categoryId) => categoryId.trim());

  if (new Set(categoryIds).size !== categoryIds.length) {
    return { ok: false, error: "categoryIds 不可重複", status: 400 };
  }

  return { ok: true, categoryIds };
};

export const validateCategoryOrderIds = (
  categoryIds: string[],
  currentCategoryIds: string[]
): CategoryOrderParseResult => {
  const current = new Set(currentCategoryIds);

  if (categoryIds.length !== currentCategoryIds.length) {
    return { ok: false, error: "categoryIds 必須包含全部分類", status: 400 };
  }

  if (categoryIds.some((categoryId) => !current.has(categoryId))) {
    return { ok: false, error: "categoryIds 包含未知分類", status: 400 };
  }

  return { ok: true, categoryIds };
};

export const sortCards = <
  T extends Pick<CommunicationCard, "id" | "sortOrder" | "createdAt">,
>(
  cards: T[]
) =>
  [...cards].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );

export const serializeCard = (card: {
  id: string;
  emoji: string;
  label: string;
  labelJa: string | null;
  zh: string;
  ja: string;
  en: string | null;
  note: string | null;
  categories: string[];
  sortOrder: number;
  isVisible: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}): CommunicationCard => ({
  ...card,
  categories: normalizeCategories(card.categories),
  createdAt:
    card.createdAt instanceof Date ? card.createdAt.toISOString() : card.createdAt,
  updatedAt:
    card.updatedAt instanceof Date ? card.updatedAt.toISOString() : card.updatedAt,
});

const readText = (
  body: Record<string, unknown>,
  key: "emoji" | "label" | "zh" | "ja",
  label: string,
  maxLength: number,
  partial: boolean
): ParseResult | string | undefined => {
  if (partial && !hasOwn(body, key)) return undefined;

  const value = cleanText(body[key]);

  if (value.length > maxLength) {
    return { ok: false, error: `${label}最多 ${maxLength} 字`, status: 400 };
  }

  return value;
};

export const parseCardInput = (
  body: unknown,
  options: { partial?: boolean } = {}
): ParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "資料格式不正確", status: 400 };
  }

  const source = body as Record<string, unknown>;
  const partial = options.partial === true;
  const data: CardWriteData = {};
  const emoji = readText(source, "emoji", "Emoji", 16, partial);
  const label = readText(source, "label", "Label", 24, partial);
  const zh = readText(source, "zh", "中文", 240, partial);
  const ja = readText(source, "ja", "日文", 240, partial);

  for (const result of [emoji, label, zh, ja]) {
    if (typeof result === "object") return result;
  }

  if (typeof emoji === "string") data.emoji = emoji;
  if (typeof label === "string") data.label = label;
  if (typeof zh === "string") data.zh = zh;
  if (typeof ja === "string") data.ja = ja;

  if (hasOwn(source, "labelJa")) {
    const labelJa = cleanText(source.labelJa);

    if (labelJa.length > 24) {
      return { ok: false, error: "日文按鈕名稱最多 24 字", status: 400 };
    }

    data.labelJa = labelJa || null;
  }

  if (hasOwn(source, "en")) {
    const en = cleanText(source.en);

    if (en.length > 240) {
      return { ok: false, error: "英文最多 240 字", status: 400 };
    }

    data.en = en || null;
  }

  if (hasOwn(source, "note")) {
    data.note = cleanText(source.note) || null;
  }

  if (!partial || hasOwn(source, "categories")) {
    const categories = normalizeCardCategories(source.categories);

    data.categories = categories;
  }

  if (hasOwn(source, "sortOrder")) {
    const sortOrder = source.sortOrder;

    if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) {
      return { ok: false, error: "排序必須是整數", status: 400 };
    }

    data.sortOrder = sortOrder;
  }

  if (hasOwn(source, "isVisible")) {
    return { ok: false, error: "單張字卡不支援隱藏，請使用分類隱藏", status: 400 };
  }

  if (partial && Object.keys(data).length === 0) {
    return { ok: false, error: "缺少可更新欄位", status: 400 };
  }

  return { ok: true, data };
};

const cleanTsvCell = (value: string | number | boolean | null) =>
  String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ");

export const exportCardsToTsv = (cards: CommunicationCard[]) => {
  const rows = sortCards(cards).map((card) =>
    [
      card.id,
      joinCategories(card.categories),
      card.label,
      card.labelJa || "",
      card.zh,
      card.ja,
      card.en || "",
    ]
      .map(cleanTsvCell)
      .join("\t")
  );

  return [TSV_COLUMNS.join("\t"), ...rows].join("\n");
};

export const parseTsvBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  return null;
};

const pushBatchRow = (
  preview: BatchPreview,
  row: BatchCardRow
) => {
  preview.rows.push(row);

  if (!row.id) {
    preview.creates.push(row);
    return;
  }

  preview.updates.push(row);
};

const addReplaceDeletes = (
  preview: BatchPreview,
  cards: CommunicationCard[],
  mode: BatchApplyMode,
  inputIds: Set<string>
) => {
  if (mode === "replace") {
    preview.replaceDeletes = cards.filter((card) => !inputIds.has(card.id));
  }
};

export const parseBatchTsv = (
  text: string,
  cards: CommunicationCard[],
  mode: BatchApplyMode
): BatchPreview => {
  const preview = emptyPreview();
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length === 0) {
    preview.errors.push("第 1 列：缺少 header");
    return preview;
  }

  const headers = lines[0].split("\t").map((header) => header.trim());

  if (
    headers.length !== TSV_COLUMNS.length ||
    TSV_COLUMNS.some((column, index) => headers[index] !== column)
  ) {
    preview.errors.push(`第 1 列：header 必須為 ${TSV_COLUMNS.join("\t")}`);
    return preview;
  }

  const existingCards = new Map(cards.map((card) => [card.id, card]));
  const inputIds = new Set<string>();
  const seenIds = new Set<string>();
  preview.totalRows = lines.length - 1;

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2;
    const cells = line.split("\t");
    const value = (column: TsvColumn) =>
      (cells[TSV_COLUMNS.indexOf(column)] ?? "").trim();
    const id = value("id");
    const categories = normalizeCardCategories(value("category"));
    const rowErrors: string[] = [];

    if (cells.length !== TSV_COLUMNS.length) rowErrors.push("欄位數量不正確");
    if (id && !existingCards.has(id)) rowErrors.push("id 不存在，無法更新");
    if (id && seenIds.has(id)) rowErrors.push("id 重複");

    if (rowErrors.length > 0) {
      preview.errors.push(...rowErrors.map((error) => `第 ${lineNumber} 列：${error}`));
      return;
    }

    if (id) {
      seenIds.add(id);
      inputIds.add(id);
    }

    pushBatchRow(
      preview,
      {
        id,
        categories,
        emoji: "",
        label: value("label"),
        labelJa: value("labelJa"),
        zh: value("zh"),
        ja: value("ja"),
        en: value("en"),
        note: "",
        sortOrder: existingCards.get(id)?.sortOrder ?? index,
        isVisible: true,
      }
    );
  });

  addReplaceDeletes(preview, cards, mode, inputIds);

  return preview;
};

export const previewBatchRows = (
  rows: unknown,
  cards: CommunicationCard[],
  mode: BatchApplyMode,
  storedCategories?: Pick<StoredCardCategory, "key" | "name" | "emoji">[]
): BatchPreview => {
  const preview = emptyPreview();

  if (!Array.isArray(rows)) {
    preview.errors.push("cards 必須是陣列");
    return preview;
  }

  const existingCards = new Map(cards.map((card) => [card.id, card]));
  const categoryAliases = storedCategories
    ? new Map(
        storedCategories.flatMap((category) =>
          [category.key, category.name, formatCardCategoryName(category)]
            .filter(Boolean)
            .map((alias) => [alias, category.key] as const)
        )
      )
    : null;
  const inputIds = new Set<string>();
  const seenIds = new Set<string>();
  preview.totalRows = rows.length;

  rows.forEach((rawRow, index) => {
    const lineNumber = index + 1;
    const source =
      rawRow && typeof rawRow === "object" && !Array.isArray(rawRow)
        ? (rawRow as Record<string, unknown>)
        : null;
    const rowErrors: string[] = [];

    if (!source) {
      preview.errors.push(`第 ${lineNumber} 列：資料格式不正確`);
      return;
    }

    const readString = (key: TsvColumn) => {
      const value = source[key];

      if (value === undefined || value === null) return "";
      if (typeof value !== "string") {
        rowErrors.push(`${key} 必須是字串`);
        return "";
      }

      return value.trim();
    };
    const id = readString("id");
    const categories = normalizeCardCategories(source.categories ?? source.category);
    const label = readString("label");
    const labelJa = readString("labelJa");
    const zh = readString("zh");
    const ja = readString("ja");
    const en = readString("en");

    if (id && !existingCards.has(id)) rowErrors.push("id 不存在，無法更新");
    if (id && seenIds.has(id)) rowErrors.push("id 重複");

    const resolvedCategories = categoryAliases
      ? Array.from(new Set(categories.map((category) => categoryAliases.get(category) ?? category)))
      : categories;

    if (rowErrors.length > 0) {
      preview.errors.push(...rowErrors.map((error) => `第 ${lineNumber} 列：${error}`));
      return;
    }

    if (id) {
      seenIds.add(id);
      inputIds.add(id);
    }

    pushBatchRow(
      preview,
      {
        id,
        categories: resolvedCategories,
        emoji: "",
        label,
        labelJa,
        zh,
        ja,
        en,
        note: "",
        sortOrder: existingCards.get(id)?.sortOrder ?? index,
        isVisible: true,
      }
    );
  });

  addReplaceDeletes(preview, cards, mode, inputIds);

  return preview;
};

export const batchRowToPayload = (row: BatchCardRow): CardWriteData => ({
  categories: row.categories,
  emoji: row.emoji,
  label: row.label,
  labelJa: row.labelJa || null,
  zh: row.zh,
  ja: row.ja,
  en: row.en || null,
  note: row.note || null,
  sortOrder: row.sortOrder,
  isVisible: true,
});
