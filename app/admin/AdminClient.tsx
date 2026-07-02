"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import {
  DELETE_ALL_CONFIRMATION,
  exportCardsToTsv,
  formatCardCategoryName,
  normalizeCategories,
  parseBatchTsv,
  sortCards,
  type AdminCardCategoriesResponse,
  type AdminCardCategoryProjection,
  type BatchApplyMode,
  type BatchPreview,
  type CardWriteData,
  type CardsResponse,
  type CommunicationCard,
} from "@/lib/cards";

type CardFormState = {
  categories: string;
  emoji: string;
  label: string;
  labelJa: string;
  zh: string;
  ja: string;
  en: string;
  note: string;
  sortOrder: string;
  isVisible: boolean;
};

type CategoryFormState = {
  emoji: string;
  name: string;
};

const emptyForm = (): CardFormState => ({
  categories: "常用",
  emoji: "",
  label: "",
  labelJa: "",
  zh: "",
  ja: "",
  en: "",
  note: "",
  sortOrder: "0",
  isVisible: true,
});

const emptyCategoryForm = (): CategoryFormState => ({
  emoji: "",
  name: "",
});

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };

const cardToForm = (card: CommunicationCard): CardFormState => ({
  categories: card.categories.join("|"),
  emoji: card.emoji,
  label: card.label,
  labelJa: card.labelJa || "",
  zh: card.zh,
  ja: card.ja,
  en: card.en || "",
  note: card.note || "",
  sortOrder: String(card.sortOrder),
  isVisible: card.isVisible,
});

const formToPayload = (form: CardFormState): CardWriteData => ({
  categories: normalizeCategories(form.categories),
  emoji: form.emoji.trim(),
  label: form.label.trim(),
  labelJa: form.labelJa.trim() || null,
  zh: form.zh.trim(),
  ja: form.ja.trim(),
  en: form.en.trim() || null,
  note: form.note.trim() || null,
  sortOrder: Number(form.sortOrder),
  isVisible: form.isVisible,
});

const categoryToForm = (category: AdminCardCategoryProjection): CategoryFormState => ({
  emoji: category.emoji || "",
  name: category.name,
});

const categoryFormToPayload = (form: CategoryFormState) => ({
  emoji: form.emoji.trim() || null,
  name: form.name.trim(),
});

const readApiError = async (response: Response) => {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    errors?: unknown;
  } | null;

  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.errors)) return data.errors.join("、");
  return typeof data?.error === "string" ? data.error : "操作失敗";
};

function LoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <div className="grid gap-3 text-center">
        <span className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--line-soft)] border-t-[var(--accent)]" />
        <p className="text-sm font-extrabold text-[var(--ink-main)]">處理中...</p>
      </div>
    </div>
  );
}

function CardFields({
  form,
  onChange,
  idPrefix,
}: {
  form: CardFormState;
  onChange: (next: CardFormState) => void;
  idPrefix: string;
}) {
  const fieldId = (field: string) => `${idPrefix}-${field}`;
  const setField = (field: keyof CardFormState, value: string | boolean) => {
    onChange({ ...form, [field]: value });
  };
  const inputClass =
    "rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-3 py-2 text-[var(--ink-main)] outline-none focus-visible:border-[var(--accent)]";

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("categories")}>
        categories（用 | 分隔）
        <input
          id={fieldId("categories")}
          className={inputClass}
          value={form.categories}
          onChange={(event) => setField("categories", event.target.value)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("emoji")}>
          emoji
          <input
            id={fieldId("emoji")}
            className={inputClass}
            value={form.emoji}
            maxLength={16}
            onChange={(event) => setField("emoji", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("label")}>
          label
          <input
            id={fieldId("label")}
            className={inputClass}
            value={form.label}
            maxLength={24}
            onChange={(event) => setField("label", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("labelJa")}>
          labelJa
          <input
            id={fieldId("labelJa")}
            className={inputClass}
            value={form.labelJa}
            maxLength={24}
            onChange={(event) => setField("labelJa", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("sortOrder")}>
          sortOrder
          <input
            id={fieldId("sortOrder")}
            type="number"
            step="1"
            className={inputClass}
            value={form.sortOrder}
            onChange={(event) => setField("sortOrder", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("zh")}>
        zh
        <textarea
          id={fieldId("zh")}
          className={`${inputClass} min-h-20`}
          value={form.zh}
          onChange={(event) => setField("zh", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("ja")}>
        ja
        <textarea
          id={fieldId("ja")}
          className={`${inputClass} min-h-20`}
          value={form.ja}
          onChange={(event) => setField("ja", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("en")}>
        en
        <textarea
          id={fieldId("en")}
          className={`${inputClass} min-h-16`}
          value={form.en}
          onChange={(event) => setField("en", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("note")}>
        note
        <textarea
          id={fieldId("note")}
          className={`${inputClass} min-h-16`}
          value={form.note}
          onChange={(event) => setField("note", event.target.value)}
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink-main)]">
        <input
          type="checkbox"
          checked={form.isVisible}
          onChange={(event) => setField("isVisible", event.target.checked)}
        />
        顯示這張字卡
      </label>
    </div>
  );
}

function BatchManager({
  cards,
  onReloadCards,
  isBusy,
  onBusyChange,
}: {
  cards: CommunicationCard[];
  onReloadCards: () => Promise<void>;
  isBusy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [batchText, setBatchText] = useState("");
  const [applyMode, setApplyMode] = useState<BatchApplyMode>("upsert");
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [message, setMessage] = useState("");
  const canApply = Boolean(preview && preview.errors.length === 0 && !isBusy);
  const previewLabels = useMemo(
    () =>
      preview
        ? [
            `總列數 ${preview.totalRows}`,
            `新增 ${preview.creates.length}`,
            `更新 ${preview.updates.length}`,
            `隱藏 ${preview.hides.length}`,
            `顯示 ${preview.shows.length}`,
            `刪除 ${applyMode === "replace" ? preview.replaceDeletes.length : 0}`,
            `錯誤 ${preview.errors.length}`,
          ]
        : [],
    [applyMode, preview]
  );

  const exportCards = () => {
    onBusyChange(true);
    window.requestAnimationFrame(() => {
      try {
        setBatchText(exportCardsToTsv(cards));
        setPreview(null);
        setMessage("已匯出全部字卡。");
      } finally {
        onBusyChange(false);
      }
    });
  };

  const parsePreview = () => {
    const nextPreview = parseBatchTsv(batchText, cards, applyMode);

    setPreview(nextPreview);
    setMessage("已解析預覽。");
  };

  const applyPreview = async () => {
    if (!preview || !canApply) return;
    if (
      applyMode === "replace" &&
      !window.confirm("TSV 未包含的既有字卡會直接刪除，且無法復原。")
    ) {
      return;
    }

    onBusyChange(true);
    setMessage("");

    try {
      const response = await fetch("/api/cards/batch", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ mode: applyMode, cards: preview.rows }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const result = (await response.json()) as {
        created: number;
        updated: number;
        hidden: number;
        shown: number;
        deleted: number;
      };

      await onReloadCards();
      setPreview(null);
      setMessage(
        `已新增 ${result.created} 張、更新 ${result.updated} 張、隱藏 ${result.hidden} 張、顯示 ${result.shown} 張、因取代而刪除 ${result.deleted} 張`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "套用失敗");
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">TSV</h2>
        <button type="button" onClick={exportCards} disabled={isBusy} className="primary-button disabled:opacity-50">
          匯出
        </button>
      </div>

      <fieldset className="grid gap-2 rounded-md border border-[var(--line-main)] bg-[var(--panel-soft)] p-3 text-sm font-bold">
        <legend className="px-1 text-[var(--ink-soft)]">模式</legend>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="batch-apply-mode"
            checked={applyMode === "upsert"}
            onChange={() => {
              setApplyMode("upsert");
              setPreview(null);
            }}
          />
          增加／修改
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="batch-apply-mode"
            checked={applyMode === "replace"}
            onChange={() => {
              setApplyMode("replace");
              setPreview(null);
            }}
          />
          完全取代目前字卡
        </label>
      </fieldset>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]">
        貼上 TSV
        <textarea
          className="min-h-56 rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-3 py-2 font-mono text-xs text-[var(--ink-main)] outline-none focus-visible:border-[var(--accent)]"
          value={batchText}
          onChange={(event) => {
            setBatchText(event.target.value);
            setPreview(null);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={parsePreview} disabled={isBusy} className="secondary-button disabled:opacity-50">
          解析預覽
        </button>
        <button type="button" onClick={applyPreview} disabled={!canApply} className="primary-button disabled:opacity-50">
          確認套用
        </button>
      </div>

      {preview && (
        <div className="rounded-md border border-[var(--line-main)] bg-[var(--panel-soft)] p-3">
          <div className="flex flex-wrap gap-2 text-sm font-extrabold">
            {previewLabels.map((label) => (
              <span key={label} className="rounded bg-[var(--button-bg)] px-2 py-1">
                {label}
              </span>
            ))}
          </div>
          {preview.errors.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm font-bold text-[var(--danger)]">
              {preview.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && <p className="text-sm font-bold text-[var(--ink-soft)]">{message}</p>}
    </section>
  );
}

function CategoryManager({
  categories,
  onReloadCards,
  isBusy,
}: {
  categories: AdminCardCategoryProjection[];
  onReloadCards: () => Promise<void>;
  isBusy: boolean;
}) {
  const ORDER_PENDING_ID = "__category-order__";
  const CREATE_PENDING_ID = "__category-create__";
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState(emptyCategoryForm);
  const [editingId, setEditingId] = useState("");
  const [editCategoryForm, setEditCategoryForm] = useState(emptyCategoryForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminCardCategoryProjection | null>(null);
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    dragging: boolean;
    previous: AdminCardCategoryProjection[];
    timer: number | null;
  } | null>(null);
  const visibleCount = orderedCategories.filter((category) => category.isVisible).length;
  const disabled = isBusy || pendingId.length > 0;
  const inputClass =
    "rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-3 py-2 text-[var(--ink-main)] outline-none focus-visible:border-[var(--accent)]";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOrderedCategories(categories);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [categories]);

  const sameOrder = (
    a: AdminCardCategoryProjection[],
    b: AdminCardCategoryProjection[]
  ) => a.length === b.length && a.every((category, index) => category.id === b[index]?.id);

  const moveCategory = (
    list: AdminCardCategoryProjection[],
    fromId: string,
    toId: string
  ) => {
    const fromIndex = list.findIndex((category) => category.id === fromId);
    const toIndex = list.findIndex((category) => category.id === toId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;

    const next = [...list];
    const [category] = next.splice(fromIndex, 1);

    next.splice(toIndex, 0, category);
    return next;
  };

  const saveOrder = async (
    nextCategories: AdminCardCategoryProjection[],
    previousCategories: AdminCardCategoryProjection[]
  ) => {
    if (sameOrder(nextCategories, previousCategories)) return;

    setPendingId(ORDER_PENDING_ID);
    setMessage("");

    try {
      const response = await fetch("/api/admin/card-categories/order", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          categoryIds: nextCategories.map((category) => category.id),
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = (await response.json()) as AdminCardCategoriesResponse;
      setOrderedCategories(Array.isArray(data.categories) ? data.categories : nextCategories);
      await onReloadCards();
      setMessage("分類順序已儲存");
    } catch (error) {
      setOrderedCategories(previousCategories);
      setMessage(error instanceof Error ? error.message : "分類順序儲存失敗");
    } finally {
      setPendingId("");
    }
  };

  const moveByButton = (index: number, offset: -1 | 1) => {
    if (disabled) return;

    const toIndex = index + offset;
    if (toIndex < 0 || toIndex >= orderedCategories.length) return;

    const previous = orderedCategories;
    const next = [...orderedCategories];
    const [category] = next.splice(index, 1);

    next.splice(toIndex, 0, category);
    setOrderedCategories(next);
    void saveOrder(next, previous);
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingId(CREATE_PENDING_ID);
    setMessage("");

    try {
      const response = await fetch("/api/admin/card-categories", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(categoryFormToPayload(newCategoryForm)),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = (await response.json()) as { category: AdminCardCategoryProjection };
      setOrderedCategories((current) => [...current, data.category]);
      await onReloadCards();
      setNewCategoryForm(emptyCategoryForm());
      setIsAddingCategory(false);
      setDeleteTarget(null);
      setMessage("已新增分類");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增分類失敗");
    } finally {
      setPendingId("");
    }
  };

  const startEditingCategory = (category: AdminCardCategoryProjection) => {
    if (disabled) return;

    setIsAddingCategory(false);
    setDeleteTarget(null);
    setEditingId(category.id);
    setEditCategoryForm(categoryToForm(category));
    setMessage("");
  };

  const saveCategory = async (
    event: FormEvent<HTMLFormElement>,
    category: AdminCardCategoryProjection
  ) => {
    event.preventDefault();
    setPendingId(category.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/card-categories/${category.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify(categoryFormToPayload(editCategoryForm)),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = (await response.json()) as { category: AdminCardCategoryProjection };
      setOrderedCategories((current) =>
        current.map((item) => (item.id === data.category.id ? data.category : item))
      );
      await onReloadCards();
      setEditingId("");
      setMessage("分類已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新分類失敗");
    } finally {
      setPendingId("");
    }
  };

  const deleteCategory = async () => {
    if (!deleteTarget) return;

    setPendingId(deleteTarget.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/card-categories/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = (await response.json()) as AdminCardCategoriesResponse & {
        deletedCategory: Pick<AdminCardCategoryProjection, "id" | "key" | "name" | "emoji">;
      };

      setOrderedCategories((current) =>
        Array.isArray(data.categories)
          ? data.categories
          : current.filter((category) => category.id !== deleteTarget.id)
      );
      await onReloadCards();
      setDeleteTarget(null);
      setEditingId("");
      setMessage("分類已刪除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除分類失敗");
    } finally {
      setPendingId("");
    }
  };

  const startDragging = () => {
    if (!dragRef.current) return;

    dragRef.current.dragging = true;
    setDraggingId(dragRef.current.id);
  };

  const dragHandlePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    category: AdminCardCategoryProjection
  ) => {
    if (disabled) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    const isTouch = event.pointerType === "touch" || event.pointerType === "pen";
    const timer =
      isTouch
        ? window.setTimeout(startDragging, 220)
        : null;

    dragRef.current = {
      id: category.id,
      pointerId: event.pointerId,
      dragging: false,
      previous: orderedCategories,
      timer,
    };

    if (!isTouch) startDragging();
  };

  const dragHandlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging) return;

    event.preventDefault();

    if (event.clientY < 80) window.scrollBy({ top: -16 });
    if (event.clientY > window.innerHeight - 80) window.scrollBy({ top: 16 });

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-category-row-id]");
    const targetId = target?.dataset.categoryRowId;

    if (!targetId || targetId === drag.id) return;

    setOrderedCategories((current) => moveCategory(current, drag.id, targetId));
  };

  const dragHandlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.timer) window.clearTimeout(drag.timer);
    dragRef.current = null;
    setDraggingId("");

    if (!drag.dragging) return;

    event.preventDefault();
    setOrderedCategories((current) => {
      void saveOrder(current, drag.previous);
      return current;
    });
  };

  const toggleCategory = async (category: AdminCardCategoryProjection) => {
    const isVisible = !category.isVisible;

    setPendingId(category.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/card-categories/${category.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ isVisible }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      await onReloadCards();
      setMessage(`${category.name} 已${isVisible ? "顯示" : "隱藏"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新分類失敗");
    } finally {
      setPendingId("");
    }
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">分類管理</h2>
          <p className="text-sm font-bold text-[var(--ink-soft)]">
            顯示 {visibleCount} 個，隱藏 {orderedCategories.length - visibleCount} 個
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsAddingCategory(true);
            setEditingId("");
            setDeleteTarget(null);
            setMessage("");
          }}
          className="secondary-button disabled:opacity-50"
        >
          ＋ 新增分類
        </button>
      </div>

      {isAddingCategory && (
        <form
          className="grid gap-3 rounded-md border border-[var(--line-main)] bg-[var(--panel-soft)] p-3"
          onSubmit={createCategory}
        >
          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor="new-category-emoji">
              Emoji
              <input
                id="new-category-emoji"
                className={inputClass}
                value={newCategoryForm.emoji}
                maxLength={16}
                onChange={(event) =>
                  setNewCategoryForm({ ...newCategoryForm, emoji: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor="new-category-name">
              分類名稱
              <input
                id="new-category-name"
                className={inputClass}
                value={newCategoryForm.name}
                maxLength={30}
                onChange={(event) =>
                  setNewCategoryForm({ ...newCategoryForm, name: event.target.value })
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={disabled || newCategoryForm.name.trim().length === 0}
              className="primary-button disabled:opacity-50"
            >
              新增
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsAddingCategory(false);
                setNewCategoryForm(emptyCategoryForm());
              }}
              className="secondary-button disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {orderedCategories.length === 0 || visibleCount === 0 ? (
        <p className="rounded-md border border-[var(--line-main)] bg-[var(--panel-soft)] p-3 text-sm font-bold text-[var(--ink-soft)]">
          {orderedCategories.length === 0 ? "目前沒有分類" : "目前所有分類皆已隱藏"}
        </p>
      ) : null}

      {orderedCategories.length > 0 && (
        <div className="grid gap-2">
          {orderedCategories.map((category, index) => {
            const isPending = pendingId === category.id;
            const isDragging = draggingId === category.id;
            const canDelete = category.cardCount === 0;

            return (
              <div
                key={category.id}
                data-category-row-id={category.id}
                className={`grid gap-3 rounded-lg border border-[var(--line-main)] bg-[var(--panel-soft)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${
                  isDragging ? "opacity-50 outline outline-2 outline-[var(--accent)]" : ""
                }`}
              >
                <button
                  type="button"
                  aria-label={`拖曳排序 ${category.name}`}
                  disabled={disabled}
                  onPointerDown={(event) => dragHandlePointerDown(event, category)}
                  onPointerMove={dragHandlePointerMove}
                  onPointerUp={dragHandlePointerEnd}
                  onPointerCancel={dragHandlePointerEnd}
                  className="shrink-0 touch-none rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-2 py-2 text-base font-black disabled:opacity-50"
                >
                  ☰
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-extrabold">
                      {formatCardCategoryName(category)}
                    </span>
                    {!category.isVisible && (
                      <span className="rounded bg-[var(--button-bg)] px-2 py-1 text-xs font-extrabold text-[var(--danger)]">
                        已隱藏
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-bold text-[var(--ink-soft)]">
                    {category.cardCount} 張字卡 · {category.pageCount} 頁
                  </p>
                </div>

                <div className="grid shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => startEditingCategory(category)}
                    className="rounded-md border border-[var(--line-main)] bg-[var(--button-bg)] px-3 py-2 text-sm font-extrabold disabled:opacity-40"
                  >
                    編輯
                  </button>
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-md border border-[var(--line-main)] bg-[var(--button-bg)] px-3 py-2 text-center text-sm font-extrabold">
                      更多
                    </summary>
                    <div className="mt-1 grid gap-1 rounded-md border border-[var(--line-main)] bg-[var(--panel-main)] p-2">
                      <button
                        type="button"
                        disabled={disabled || !canDelete}
                        onClick={() => {
                          setIsAddingCategory(false);
                          setEditingId("");
                          setDeleteTarget(category);
                          setMessage("");
                        }}
                        className="danger-button text-sm disabled:opacity-40"
                      >
                        刪除分類
                      </button>
                      {!canDelete && (
                        <p className="text-xs font-bold text-[var(--ink-soft)]">
                          仍有 {category.cardCount} 張字卡，無法刪除
                        </p>
                      )}
                    </div>
                  </details>
                  <label className="inline-flex items-center gap-2 rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-3 py-2 text-sm font-extrabold">
                    <input
                      type="checkbox"
                      checked={category.isVisible}
                      disabled={disabled}
                      onChange={() => void toggleCategory(category)}
                    />
                    {isPending ? "更新中" : category.isVisible ? "顯示" : "隱藏"}
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      aria-label={`上移 ${category.name}`}
                      disabled={disabled || index === 0}
                      onClick={() => moveByButton(index, -1)}
                      className="rounded-md border border-[var(--line-main)] bg-[var(--button-bg)] px-2 py-1 text-xs font-extrabold disabled:opacity-40"
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      aria-label={`下移 ${category.name}`}
                      disabled={disabled || index === orderedCategories.length - 1}
                      onClick={() => moveByButton(index, 1)}
                      className="rounded-md border border-[var(--line-main)] bg-[var(--button-bg)] px-2 py-1 text-xs font-extrabold disabled:opacity-40"
                    >
                      下移
                    </button>
                  </div>
                </div>

                {editingId === category.id && (
                  <form
                    className="grid gap-3 border-t border-[var(--line-main)] pt-3 sm:col-span-3"
                    onSubmit={(event) => saveCategory(event, category)}
                  >
                    <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={`category-${category.id}-emoji`}>
                        Emoji
                        <input
                          id={`category-${category.id}-emoji`}
                          className={inputClass}
                          value={editCategoryForm.emoji}
                          maxLength={16}
                          onChange={(event) =>
                            setEditCategoryForm({
                              ...editCategoryForm,
                              emoji: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={`category-${category.id}-name`}>
                        分類名稱
                        <input
                          id={`category-${category.id}-name`}
                          className={inputClass}
                          value={editCategoryForm.name}
                          maxLength={30}
                          onChange={(event) =>
                            setEditCategoryForm({
                              ...editCategoryForm,
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={disabled || editCategoryForm.name.trim().length === 0}
                        className="primary-button disabled:opacity-50"
                      >
                        儲存
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setEditingId("")}
                        className="secondary-button disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="grid gap-3 rounded-md border border-[var(--danger)] bg-[var(--panel-soft)] p-3"
        >
          <h3 className="text-lg font-extrabold">
            刪除「{formatCardCategoryName(deleteTarget)}」？
          </h3>
          <p className="text-sm font-bold text-[var(--ink-soft)]">
            此分類目前沒有字卡。刪除後無法復原。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDeleteTarget(null)}
              className="secondary-button disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void deleteCategory()}
              className="danger-button disabled:opacity-50"
            >
              {pendingId === deleteTarget.id ? "刪除中" : "刪除分類"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p aria-live="polite" className="text-sm font-bold text-[var(--ink-soft)]">
          {message}
        </p>
      )}
    </section>
  );
}

function EditCardDetails({
  card,
  onSaved,
  onDeleted,
  onBusyChange,
}: {
  card: CommunicationCard;
  onSaved: (card: CommunicationCard) => void;
  onDeleted: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [form, setForm] = useState(() => cardToForm(card));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const saveCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    onBusyChange(true);
    setMessage("");

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify(formToPayload(form)),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const saved = (await response.json()) as CommunicationCard;
      setForm(cardToForm(saved));
      onSaved(saved);
      setMessage("已儲存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setIsSaving(false);
      onBusyChange(false);
    }
  };

  const deleteCard = async () => {
    if (!window.confirm("直接刪除這張字卡，且無法復原。確定刪除？")) return;

    setIsSaving(true);
    onBusyChange(true);
    setMessage("");

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await readApiError(response));

      onDeleted(card.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setIsSaving(false);
      onBusyChange(false);
    }
  };

  return (
    <details className="rounded-lg border border-[var(--line-main)] bg-[var(--panel-soft)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3">
        <span className="min-w-0">
          <span className="break-words font-extrabold">
            {card.emoji} {card.label}
          </span>
          <span className="mt-1 block break-words text-xs font-bold text-[var(--ink-soft)]">
            {card.categories.join(" / ")} · {card.sortOrder} ·{" "}
            {card.isVisible ? "顯示" : "隱藏"}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-[var(--accent)]">編輯</span>
      </summary>

      <form className="grid gap-3 border-t border-[var(--line-main)] p-3" onSubmit={saveCard}>
        <CardFields form={form} idPrefix={`card-${card.id}`} onChange={setForm} />

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={isSaving} className="primary-button disabled:opacity-50">
            儲存
          </button>
          <button type="button" disabled={isSaving} onClick={deleteCard} className="danger-button disabled:opacity-50">
            直接刪除
          </button>
          {message && <span className="text-sm font-bold text-[var(--ink-soft)]">{message}</span>}
        </div>
      </form>
    </details>
  );
}

export default function AdminClient() {
  const [passwordInput, setPasswordInput] = useState("");
  const [cards, setCards] = useState<CommunicationCard[]>([]);
  const [categories, setCategories] = useState<AdminCardCategoryProjection[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [newCardForm, setNewCardForm] = useState(emptyForm);

  const loadCards = useCallback(async (showLoading = true, reportError = true) => {
    if (showLoading) setIsLoading(true);
    setMessage("");

    try {
      const [cardsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/cards?includeHidden=1", {
          cache: "no-store",
        }),
        fetch("/api/admin/card-categories", {
          cache: "no-store",
        }),
      ]);

      if (!cardsResponse.ok) throw new Error(await readApiError(cardsResponse));
      if (!categoriesResponse.ok) throw new Error(await readApiError(categoriesResponse));

      const cardsData = (await cardsResponse.json()) as CardsResponse;
      const categoriesData = (await categoriesResponse.json()) as AdminCardCategoriesResponse;
      setCards(sortCards(Array.isArray(cardsData.cards) ? cardsData.cards : []));
      setCategories(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
      setIsAuthed(true);
      setPasswordInput("");
    } catch (error) {
      setIsAuthed(false);
      setCards([]);
      setCategories([]);
      if (reportError) setMessage(error instanceof Error ? error.message : "登入失敗");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      void loadCards(false, false);
    });
  }, [loadCards]);

  const createSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ password: passwordInput }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      await loadCards(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const mergeCard = (nextCard: CommunicationCard) => {
    setCards((current) =>
      sortCards(
        current.some((card) => card.id === nextCard.id)
          ? current.map((card) => (card.id === nextCard.id ? nextCard : card))
          : [...current, nextCard]
      )
    );
  };

  const createCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(formToPayload(newCardForm)),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      await loadCards(false);
      setNewCardForm(emptyForm());
      setMessage("已新增字卡");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAllCards = async () => {
    if (cards.length === 0) return;

    const answer = window.prompt(
      `這會永久刪除 ${cards.length} 張字卡，無法復原。請輸入「全部刪除」確認。`
    );

    if (answer !== "全部刪除") {
      setMessage("已取消清空");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/cards", {
        method: "DELETE",
        headers: jsonHeaders,
        body: JSON.stringify({ confirm: DELETE_ALL_CONFIRMATION }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const result = (await response.json()) as { deleted: number };
      await loadCards(false);
      setMessage(`已刪除 ${result.deleted} 張字卡`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const leaveAdmin = () => {
    void fetch("/api/admin/session", { method: "DELETE" });
    setIsAuthed(false);
    setPasswordInput("");
    setCards([]);
    setCategories([]);
  };

  if (!isAuthed) {
    return (
      <main className="min-h-screen px-4 py-8">
        <form
          className="mx-auto grid max-w-sm gap-4 rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-5"
          onSubmit={createSession}
        >
          <h1 className="text-2xl font-extrabold">狼狼按鈕管理</h1>
          <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]">
            管理密碼
            <input
              type="password"
              autoComplete="current-password"
              className="rounded-md border border-[var(--line-main)] bg-[var(--input-bg)] px-3 py-2 text-[var(--ink-main)] outline-none focus-visible:border-[var(--accent)]"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || passwordInput.length === 0}
            className="primary-button disabled:opacity-50"
          >
            進入管理模式
          </button>
          <p aria-live="polite" className="min-h-5 text-sm font-bold text-[var(--danger)]">
            {message}
          </p>
          <Link href="/" className="text-sm font-bold text-[var(--ink-soft)] underline-offset-4 hover:underline">
            返回使用模式
          </Link>
        </form>
        {isLoading && <LoadingOverlay />}
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-3 py-5 sm:px-5">
      <div className="mx-auto grid max-w-4xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">狼狼按鈕管理</h1>
            <p className="text-sm font-bold text-[var(--ink-soft)]">
              {cards.length} 張字卡，包含 hidden cards
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="secondary-button">
              返回使用模式
            </Link>
            <button
              type="button"
              onClick={deleteAllCards}
              disabled={isLoading || cards.length === 0}
              className="danger-button disabled:opacity-50"
            >
              全部刪除
            </button>
            <button type="button" onClick={leaveAdmin} className="secondary-button">
              離開管理模式
            </button>
          </div>
        </header>

        <BatchManager
          cards={cards}
          onReloadCards={() => loadCards(false)}
          isBusy={isLoading}
          onBusyChange={setIsLoading}
        />

        <CategoryManager
          categories={categories}
          onReloadCards={() => loadCards(false)}
          isBusy={isLoading}
        />

        <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-4">
          <h2 className="text-xl font-extrabold">新增字卡</h2>
          <form className="grid gap-3" onSubmit={createCard}>
            <CardFields form={newCardForm} idPrefix="new-card" onChange={setNewCardForm} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={isLoading} className="primary-button disabled:opacity-50">
                新增
              </button>
              {message && <span className="text-sm font-bold text-[var(--ink-soft)]">{message}</span>}
            </div>
          </form>
        </section>

        <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-4">
          <h2 className="text-xl font-extrabold">字卡總覽</h2>
          {cards.length === 0 ? (
            <p className="rounded-md border border-[var(--line-main)] bg-[var(--panel-soft)] p-3 text-sm font-bold text-[var(--ink-soft)]">
              零張字卡
            </p>
          ) : (
            <div className="grid gap-2">
              {cards.map((card) => (
                <EditCardDetails
                  key={card.id}
                  card={card}
                  onSaved={(card) => {
                    mergeCard(card);
                    void loadCards(false);
                  }}
                  onDeleted={(id) => {
                    setCards((current) => current.filter((card) => card.id !== id));
                    void loadCards(false);
                  }}
                  onBusyChange={setIsLoading}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {isLoading && <LoadingOverlay />}
    </main>
  );
}
