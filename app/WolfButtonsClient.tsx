"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCardCategories,
  sortCards,
  type CardsResponse,
  type CommunicationCard,
} from "@/lib/cards";

type Props = {
  initialCards: CommunicationCard[];
};

type UiLanguage = "zh" | "ja";

const UI_LANGUAGE_KEY = "wolfButtons.uiLanguage";

const text = {
  zh: {
    categoryLabel: "分類",
    noCards: "目前沒有可使用的字卡",
    emptyCategory: "這個分類目前沒有字卡",
    admin: "管理",
  },
  ja: {
    categoryLabel: "カテゴリ",
    noCards: "現在使えるカードはありません",
    emptyCategory: "このカテゴリにはカードがありません",
    admin: "管理",
  },
} satisfies Record<UiLanguage, Record<string, string>>;

const getCardButtonLabel = (card: CommunicationCard, uiLanguage: UiLanguage) =>
  uiLanguage === "ja" ? card.labelJa || card.label : card.label;

export default function WolfButtonsClient({ initialCards }: Props) {
  const [cards, setCards] = useState(() => sortCards(initialCards));
  const [selectedCardId, setSelectedCardId] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("zh");
  const visibleCards = useMemo(
    () => sortCards(cards.filter((card) => card.isVisible)),
    [cards]
  );
  const categories = useMemo(() => getCardCategories(visibleCards), [visibleCards]);
  const displayedCategory = categories.includes(activeCategory)
    ? activeCategory
    : categories[0] || "";
  const categoryCards = displayedCategory
    ? visibleCards.filter((card) => card.categories.includes(displayedCategory))
    : visibleCards;
  const selectedCard =
    visibleCards.find((card) => card.id === selectedCardId) || null;
  const copy = text[uiLanguage];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(UI_LANGUAGE_KEY);
      if (saved === "zh" || saved === "ja") {
        window.requestAnimationFrame(() => setUiLanguage(saved));
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      try {
        const response = await fetch("/api/cards", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as CardsResponse;
        if (!cancelled) setCards(sortCards(Array.isArray(data.cards) ? data.cards : []));
      } catch {
        return;
      }
    };

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = (nextLanguage: UiLanguage) => {
    setUiLanguage(nextLanguage);

    try {
      window.localStorage.setItem(UI_LANGUAGE_KEY, nextLanguage);
    } catch {
      return;
    }
  };

  return (
    <main className="h-[100dvh] overflow-hidden px-3 py-3 text-[var(--ink-main)] sm:px-4">
      <h1 className="sr-only">狼狼按鈕</h1>
      <div className="app-shell mx-auto flex h-full min-h-0 flex-col gap-3">
        <section
          className="display-panel min-h-[190px] flex-1 overflow-y-auto rounded-lg border border-[var(--line-main)] bg-[var(--panel-main)] p-4"
          aria-live="polite"
        >
          {selectedCard ? (
            <div className="grid gap-3">
              <div className="text-center text-5xl leading-none" aria-hidden="true">
                {selectedCard.emoji}
              </div>
              <p className="break-words text-center text-2xl font-black leading-snug">
                {selectedCard.zh}
              </p>
              <p className="break-words text-center text-xl font-extrabold leading-snug text-[var(--ink-main)]">
                {selectedCard.ja}
              </p>
              {selectedCard.en && (
                <p className="break-words text-center text-base font-bold leading-snug text-[var(--ink-soft)]">
                  {selectedCard.en}
                </p>
              )}
              {selectedCard.note && (
                <p className="rounded-md border border-[var(--line-soft)] bg-[var(--panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--ink-soft)]">
                  {selectedCard.note}
                </p>
              )}
            </div>
          ) : (
            <div className="grid min-h-[150px] place-items-center text-center">
              {visibleCards.length === 0 ? (
                <p className="text-lg font-extrabold text-[var(--ink-soft)]">
                  {copy.noCards}
                </p>
              ) : (
                <div className="grid gap-2">
                  <p className="text-2xl font-black">請點一張字卡</p>
                  <p className="text-xl font-extrabold">カードを選んでください</p>
                  <p className="text-base font-bold text-[var(--ink-soft)]">Tap a card</p>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-[var(--line-main)] bg-[var(--panel-soft)] p-1">
          <button
            type="button"
            aria-pressed={uiLanguage === "zh"}
            onClick={() => setLanguage("zh")}
            className={`rounded-md px-3 py-2 text-sm font-extrabold ${
              uiLanguage === "zh"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--ink-soft)]"
            }`}
          >
            中文
          </button>
          <button
            type="button"
            aria-pressed={uiLanguage === "ja"}
            onClick={() => setLanguage("ja")}
            className={`rounded-md px-3 py-2 text-sm font-extrabold ${
              uiLanguage === "ja"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--ink-soft)]"
            }`}
          >
            日本語
          </button>
        </div>

        {categories.length > 0 && (
          <nav
            className="hide-scrollbar -mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-1"
            aria-label={copy.categoryLabel}
          >
            {categories.map((category) => {
              const active = category === displayedCategory;

              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-md border px-3 py-2 text-sm font-extrabold ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "border-[var(--line-main)] bg-[var(--panel-soft)] text-[var(--ink-soft)]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </nav>
        )}

        <div className="h-[244px] min-w-0 shrink-0 overflow-y-auto overflow-x-hidden">
          {categoryCards.length > 0 ? (
            <section className="grid w-full min-w-0 grid-cols-3 gap-2 auto-rows-[76px]" aria-label="字卡按鈕">
              {categoryCards.map((card) => {
                const selected = selectedCard?.id === card.id;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(card.id)}
                    className={`h-[76px] min-w-0 overflow-hidden rounded-lg border px-2 py-2 text-center font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                        : "border-[var(--line-main)] bg-[var(--button-bg)] text-[var(--ink-main)]"
                    }`}
                  >
                    <span className="block text-2xl leading-none" aria-hidden="true">
                      {card.emoji}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-tight">
                      {getCardButtonLabel(card, uiLanguage)}
                    </span>
                  </button>
                );
              })}
            </section>
          ) : (
            visibleCards.length > 0 && (
              <p className="rounded-lg border border-[var(--line-main)] bg-[var(--panel-soft)] p-4 text-center text-sm font-bold text-[var(--ink-soft)]">
                {copy.emptyCategory}
              </p>
            )
          )}
        </div>

        <Link
          href="/admin"
          className="shrink-0 self-center pb-[env(safe-area-inset-bottom)] text-xs font-bold text-[var(--ink-muted)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {copy.admin}
        </Link>
      </div>
    </main>
  );
}
