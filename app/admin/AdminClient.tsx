"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  batchRowToPayload,
  exportCardsToTsv,
  parseBatchTsv,
  sortCards,
  type BatchApplyMode,
  type BatchPreview,
  type CardWriteData,
  type CardsResponse,
  type CommunicationCard,
} from "@/lib/cards";

type CardFormState = {
  emoji: string;
  label: string;
  labelJa: string;
  zh: string;
  ja: string;
  en: string;
  note: string;
  categories: string[];
  sortOrder: string;
  isVisible: boolean;
};

const emptyForm = (): CardFormState => ({
  emoji: "",
  label: "",
  labelJa: "",
  zh: "",
  ja: "",
  en: "",
  note: "",
  categories: ["常用"],
  sortOrder: "0",
  isVisible: true,
});

const adminHeaders = (secret: string, json = false): HeadersInit => ({
  "x-admin-secret": secret,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

const parseCategoryText = (value: string) => {
  return Array.from(new Set(value.split("|").map((category) => category.trim()).filter(Boolean)));
};

const cardToForm = (card: CommunicationCard): CardFormState => ({
  emoji: card.emoji,
  label: card.label,
  labelJa: card.labelJa || "",
  zh: card.zh,
  ja: card.ja,
  en: card.en || "",
  note: card.note || "",
  categories: card.categories,
  sortOrder: String(card.sortOrder),
  isVisible: card.isVisible,
});

const formToPayload = (form: CardFormState): CardWriteData => ({
  emoji: form.emoji.trim(),
  label: form.label.trim(),
  labelJa: form.labelJa.trim() || null,
  zh: form.zh.trim(),
  ja: form.ja.trim(),
  en: form.en.trim() || null,
  note: form.note.trim() || null,
  categories: parseCategoryText(form.categories.join("|")),
  sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
  isVisible: form.isVisible,
});

const readApiError = async (response: Response) => {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;

  return typeof data?.error === "string" ? data.error : "操作失敗";
};

function CategoryTextInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]">
      分類（用 | 分隔）
      <input
        className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
        value={value.join("|")}
        onChange={(event) => onChange(parseCategoryText(event.target.value))}
      />
    </label>
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

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("emoji")}>
          Emoji
          <input
            id={fieldId("emoji")}
            className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
            value={form.emoji}
            maxLength={16}
            onChange={(event) => setField("emoji", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("label")}>
          按鈕名稱（中文）
          <input
            id={fieldId("label")}
            className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
            value={form.label}
            maxLength={20}
            onChange={(event) => setField("label", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("label-ja")}>
          按鈕名稱（日文）
          <input
            id={fieldId("label-ja")}
            className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
            value={form.labelJa}
            maxLength={20}
            onChange={(event) => setField("labelJa", event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("sort")}>
          排序
          <input
            id={fieldId("sort")}
            type="number"
            step="1"
            className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
            value={form.sortOrder}
            onChange={(event) => setField("sortOrder", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("zh")}>
        中文完整句
        <textarea
          id={fieldId("zh")}
          className="min-h-20 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
          value={form.zh}
          onChange={(event) => setField("zh", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("ja")}>
        日文完整句
        <textarea
          id={fieldId("ja")}
          className="min-h-20 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
          value={form.ja}
          onChange={(event) => setField("ja", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("en")}>
        英文完整句
        <textarea
          id={fieldId("en")}
          className="min-h-16 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
          value={form.en}
          onChange={(event) => setField("en", event.target.value)}
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]" htmlFor={fieldId("note")}>
        Note
        <textarea
          id={fieldId("note")}
          className="min-h-16 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-[var(--ink-main)]"
          value={form.note}
          onChange={(event) => setField("note", event.target.value)}
        />
      </label>

      <CategoryTextInput
        value={form.categories}
        onChange={(categories) => onChange({ ...form, categories })}
      />

      <label className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink-main)]">
        <input
          type="checkbox"
          checked={form.isVisible}
          onChange={(event) => setField("isVisible", event.target.checked)}
        />
        是否顯示
      </label>
    </div>
  );
}

function BatchManager({
  cards,
  adminSecret,
  onReloadCards,
}: {
  cards: CommunicationCard[];
  adminSecret: string;
  onReloadCards: () => Promise<void>;
}) {
  const [batchText, setBatchText] = useState("");
  const [applyMode, setApplyMode] = useState<BatchApplyMode>("merge");
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState("");
  const canApply = preview && preview.errors.length === 0 && !isApplying;

  const previewLabels = useMemo(
    () =>
      preview
        ? [
            `新增 ${preview.creates.length} 張`,
            `更新 ${preview.updates.length} 張`,
            `設為不顯示 ${preview.hides.length} 張`,
            ...(applyMode === "replace"
              ? [`因取代而刪除 ${preview.replaceDeletes.length} 張`]
              : []),
            `錯誤 ${preview.errors.length} 列`,
          ]
        : [],
    [applyMode, preview]
  );

  const exportCards = () => {
    setBatchText(exportCardsToTsv(cards));
    setPreview(null);
    setMessage("已匯出目前字卡。");
  };

  const parsePreview = () => {
    setPreview(parseBatchTsv(batchText, cards, applyMode));
    setMessage("已解析預覽。");
  };

  const applyPreview = async () => {
    if (!canApply) return;

    setIsApplying(true);
    setMessage("");

    try {
      for (const row of preview.creates) {
        const response = await fetch("/api/cards", {
          method: "POST",
          headers: adminHeaders(adminSecret, true),
          body: JSON.stringify(batchRowToPayload(row)),
        });

        if (!response.ok) throw new Error(await readApiError(response));
      }

      for (const row of [...preview.updates, ...preview.hides]) {
        const response = await fetch(`/api/cards/${row.id}`, {
          method: "PATCH",
          headers: adminHeaders(adminSecret, true),
          body: JSON.stringify(batchRowToPayload(row)),
        });

        if (!response.ok) throw new Error(await readApiError(response));
      }

      for (const card of preview.replaceDeletes) {
        const response = await fetch(`/api/cards/${card.id}`, {
          method: "DELETE",
          headers: adminHeaders(adminSecret),
        });

        if (!response.ok) throw new Error(await readApiError(response));
      }

      await onReloadCards();
      setMessage(
        `已新增 ${preview.creates.length} 張、更新 ${preview.updates.length} 張、設為不顯示 ${
          preview.hides.length
        } 張${
          applyMode === "replace"
            ? `、因取代而刪除 ${preview.replaceDeletes.length} 張`
            : ""
        }`
      );
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "套用失敗");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-white/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">批次 TSV</h2>
        <button
          type="button"
          onClick={exportCards}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-extrabold text-white"
        >
          匯出目前字卡
        </button>
      </div>

      <fieldset className="grid gap-2 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] p-3 text-sm font-bold">
        <legend className="px-1 text-[var(--ink-soft)]">套用模式</legend>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="batch-apply-mode"
            checked={applyMode === "merge"}
            onChange={() => {
              setApplyMode("merge");
              setPreview(null);
            }}
          />
          增加 / 修改
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
          className="min-h-56 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 font-mono text-xs text-[var(--ink-main)]"
          value={batchText}
          onChange={(event) => {
            setBatchText(event.target.value);
            setPreview(null);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={parsePreview}
          disabled={isApplying}
          className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-4 py-2 text-sm font-extrabold text-[var(--ink-main)] disabled:opacity-50"
        >
          解析預覽
        </button>
        {canApply && (
          <button
            type="button"
            onClick={applyPreview}
            disabled={isApplying}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
          >
            確認套用
          </button>
        )}
      </div>

      {preview && (
        <div className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] p-3">
          <div className="flex flex-wrap gap-3 text-sm font-extrabold text-[var(--ink-main)]">
            {previewLabels.map((label) => (
              <span key={label}>{label}</span>
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

function EditCardDetails({
  card,
  adminSecret,
  onSaved,
  onDeleted,
}: {
  card: CommunicationCard;
  adminSecret: string;
  onSaved: (card: CommunicationCard) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState(() => cardToForm(card));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const saveCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: adminHeaders(adminSecret, true),
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
    }
  };

  const deleteCard = async () => {
    if (!window.confirm("確定刪除這張字卡？")) return;

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
        headers: adminHeaders(adminSecret),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      onDeleted(card.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <details className="rounded-lg border border-[var(--line-main)] bg-[var(--control-bg)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3">
        <span className="min-w-0">
          <span className="font-extrabold">
            {card.emoji} {card.label}
          </span>
          <span className="mt-1 block break-words text-xs font-bold text-[var(--ink-soft)]">
            {card.categories.join(" / ")} · 排序 {card.sortOrder} ·{" "}
            {card.isVisible ? "顯示" : "隱藏"}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-[var(--accent)]">編輯</span>
      </summary>

      <form className="grid gap-3 border-t border-[var(--line-main)] p-3" onSubmit={saveCard}>
        <CardFields form={form} idPrefix={`card-${card.id}`} onChange={setForm} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
          >
            儲存
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={deleteCard}
            className="rounded-md border border-[var(--line-main)] px-4 py-2 text-sm font-extrabold text-[var(--danger)] disabled:opacity-50"
          >
            刪除
          </button>
          {message && <span className="text-sm font-bold text-[var(--ink-soft)]">{message}</span>}
        </div>
      </form>
    </details>
  );
}

export default function AdminClient() {
  const [secret, setSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [cards, setCards] = useState<CommunicationCard[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [newCardForm, setNewCardForm] = useState(emptyForm);

  const loadCards = useCallback(async (nextSecret: string) => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/cards?includeHidden=1", {
        headers: adminHeaders(nextSecret),
        cache: "no-store",
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = (await response.json()) as CardsResponse;
      setCards(sortCards(Array.isArray(data.cards) ? data.cards : []));
      setSecret(nextSecret);
      setIsAuthed(true);
      window.sessionStorage.setItem("wolf-buttons.adminSecret", nextSecret);
    } catch (error) {
      setIsAuthed(false);
      window.sessionStorage.removeItem("wolf-buttons.adminSecret");
      setMessage(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("wolf-buttons.adminSecret");

    if (!saved) return;

    window.requestAnimationFrame(() => {
      void loadCards(saved);
    });
  }, [loadCards]);

  const mergeCard = (nextCard: CommunicationCard) => {
    setCards((current) =>
      sortCards(
        current.some((card) => card.id === nextCard.id)
          ? current.map((card) => (card.id === nextCard.id ? nextCard : card))
          : [...current, nextCard]
      )
    );
  };

  const createCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: adminHeaders(secret, true),
        body: JSON.stringify(formToPayload(newCardForm)),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      mergeCard((await response.json()) as CommunicationCard);
      setNewCardForm(emptyForm());
      setMessage("已新增字卡");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const reloadCards = async () => {
    await loadCards(secret);
  };

  if (!isAuthed) {
    return (
      <main className="min-h-screen px-4 py-8">
        <form
          className="mx-auto grid max-w-sm gap-4 rounded-lg border border-[var(--line-main)] bg-[var(--control-bg)] p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void loadCards(passwordInput.trim());
          }}
        >
          <div>
            <p className="text-4xl leading-none" aria-hidden="true">
              🐺
            </p>
            <h1 className="mt-2 text-2xl font-extrabold">狼狼按鈕</h1>
          </div>
          <label className="grid gap-1 text-sm font-bold text-[var(--ink-soft)]">
            管理密碼
            <input
              type="password"
              className="rounded-md border border-[var(--line-main)] bg-white px-3 py-2 text-[var(--ink-main)]"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || !passwordInput.trim()}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
          >
            進入管理
          </button>
          {message && <p className="text-sm font-bold text-[var(--danger)]">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-5 sm:px-5">
      <div className="mx-auto grid max-w-4xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-3xl leading-none" aria-hidden="true">
              🐺
            </p>
            <h1 className="mt-1 text-2xl font-extrabold">狼狼按鈕管理</h1>
            <p className="text-sm font-bold text-[var(--ink-soft)]">{cards.length} 張字卡</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-4 py-2 text-sm font-extrabold text-[var(--ink-main)]"
            >
              使用模式
            </Link>
            <button
              type="button"
              onClick={() => {
                window.sessionStorage.removeItem("wolf-buttons.adminSecret");
                setIsAuthed(false);
                setSecret("");
              }}
              className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-4 py-2 text-sm font-extrabold text-[var(--ink-main)]"
            >
              登出
            </button>
          </div>
        </header>

        <BatchManager cards={cards} adminSecret={secret} onReloadCards={reloadCards} />

        <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-white/45 p-4">
          <h2 className="text-xl font-extrabold">新增字卡</h2>
          <form className="grid gap-3" onSubmit={createCard}>
            <CardFields form={newCardForm} idPrefix="new-card" onChange={setNewCardForm} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
              >
                新增
              </button>
              {message && <span className="text-sm font-bold text-[var(--ink-soft)]">{message}</span>}
            </div>
          </form>
        </section>

        <section className="grid gap-3 rounded-lg border border-[var(--line-main)] bg-white/45 p-4">
          <h2 className="text-xl font-extrabold">所有字卡</h2>
          <div className="grid gap-2">
            {cards.map((card) => (
              <EditCardDetails
                key={card.id}
                card={card}
                adminSecret={secret}
                onSaved={mergeCard}
                onDeleted={(id) => {
                  setCards((current) => current.filter((card) => card.id !== id));
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
