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

export const DELETE_ALL_CONFIRMATION = "DELETE_ALL_CARDS";

export const TSV_COLUMNS = [
  "id",
  "categories",
  "emoji",
  "label",
  "labelJa",
  "zh",
  "ja",
  "en",
  "note",
  "sortOrder",
  "isVisible",
] as const;

type TsvColumn = (typeof TSV_COLUMNS)[number];

type ParseResult =
  | { ok: true; data: CardWriteData }
  | { ok: false; error: string; status: number };

const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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

export const joinCategories = (categories: unknown) =>
  normalizeCategories(categories).join("|");

export const getCardCategories = (
  cards: Pick<CommunicationCard, "categories">[]
) => {
  const categories: string[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    for (const category of normalizeCategories(card.categories)) {
      if (seen.has(category)) continue;

      seen.add(category);
      categories.push(category);
    }
  }

  return categories;
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

const readRequiredText = (
  body: Record<string, unknown>,
  key: "emoji" | "label" | "zh" | "ja",
  label: string,
  maxLength: number,
  partial: boolean
): ParseResult | string | undefined => {
  if (partial && !hasOwn(body, key)) return undefined;

  const value = cleanText(body[key]);

  if (!value) return { ok: false, error: `${label}必填`, status: 400 };
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
  const emoji = readRequiredText(source, "emoji", "Emoji", 16, partial);
  const label = readRequiredText(source, "label", "Label", 24, partial);
  const zh = readRequiredText(source, "zh", "中文", 240, partial);
  const ja = readRequiredText(source, "ja", "日文", 240, partial);

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
    const categories = normalizeCategories(source.categories);

    if (categories.length === 0) {
      return { ok: false, error: "分類至少要有一個", status: 400 };
    }

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
    if (typeof source.isVisible !== "boolean") {
      return { ok: false, error: "顯示狀態格式不正確", status: 400 };
    }

    data.isVisible = source.isVisible;
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
      card.emoji,
      card.label,
      card.labelJa || "",
      card.zh,
      card.ja,
      card.en || "",
      card.note || "",
      card.sortOrder,
      card.isVisible ? "TRUE" : "FALSE",
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
  row: BatchCardRow,
  existingCards: Map<string, CommunicationCard>
) => {
  preview.rows.push(row);

  if (!row.id) {
    preview.creates.push(row);
    return;
  }

  preview.updates.push(row);

  if (!row.isVisible) {
    preview.hides.push(row);
  } else if (existingCards.get(row.id)?.isVisible === false) {
    preview.shows.push(row);
  }
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
    const categories = normalizeCategories(value("categories"));
    const sortOrderText = value("sortOrder");
    const sortOrder = Number(sortOrderText);
    const isVisible = parseTsvBoolean(value("isVisible"));
    const rowErrors: string[] = [];

    if (cells.length !== TSV_COLUMNS.length) rowErrors.push("欄位數量不正確");
    if (categories.length === 0) rowErrors.push("缺少 categories");
    if (!value("emoji")) rowErrors.push("缺少 emoji");
    if (!value("label")) rowErrors.push("缺少 label");
    if (!value("zh")) rowErrors.push("缺少 zh");
    if (!value("ja")) rowErrors.push("缺少 ja");
    if (!sortOrderText || !Number.isInteger(sortOrder)) {
      rowErrors.push("sortOrder 必須是整數");
    }
    if (isVisible === null) rowErrors.push("isVisible 必須是 TRUE / FALSE / 1 / 0");
    if (!id && isVisible === false) rowErrors.push("新增字卡不可直接設為隱藏");
    if (id && !existingCards.has(id)) rowErrors.push("id 不存在，無法更新");
    if (id && seenIds.has(id)) rowErrors.push("id 重複");

    if (rowErrors.length > 0 || isVisible === null) {
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
        emoji: value("emoji"),
        label: value("label"),
        labelJa: value("labelJa"),
        zh: value("zh"),
        ja: value("ja"),
        en: value("en"),
        note: value("note"),
        sortOrder,
        isVisible,
      },
      existingCards
    );
  });

  addReplaceDeletes(preview, cards, mode, inputIds);

  return preview;
};

export const previewBatchRows = (
  rows: unknown,
  cards: CommunicationCard[],
  mode: BatchApplyMode
): BatchPreview => {
  const preview = emptyPreview();

  if (!Array.isArray(rows)) {
    preview.errors.push("cards 必須是陣列");
    return preview;
  }

  const existingCards = new Map(cards.map((card) => [card.id, card]));
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
    const categories = normalizeCategories(source.categories);
    const emoji = readString("emoji");
    const label = readString("label");
    const labelJa = readString("labelJa");
    const zh = readString("zh");
    const ja = readString("ja");
    const en = readString("en");
    const note = readString("note");
    const { sortOrder, isVisible } = source;

    if (categories.length === 0) rowErrors.push("缺少 categories");
    if (!emoji) rowErrors.push("缺少 emoji");
    if (!label) rowErrors.push("缺少 label");
    if (!zh) rowErrors.push("缺少 zh");
    if (!ja) rowErrors.push("缺少 ja");
    if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) {
      rowErrors.push("sortOrder 必須是整數");
    }
    if (typeof isVisible !== "boolean") rowErrors.push("isVisible 必須是布林值");
    if (!id && isVisible === false) rowErrors.push("新增字卡不可直接設為隱藏");
    if (id && !existingCards.has(id)) rowErrors.push("id 不存在，無法更新");
    if (id && seenIds.has(id)) rowErrors.push("id 重複");

    if (rowErrors.length > 0 || typeof sortOrder !== "number" || typeof isVisible !== "boolean") {
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
        emoji,
        label,
        labelJa,
        zh,
        ja,
        en,
        note,
        sortOrder,
        isVisible,
      },
      existingCards
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
  isVisible: row.isVisible,
});
