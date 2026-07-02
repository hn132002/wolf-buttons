"use client";

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

const getCardButtonLabel = (card: CommunicationCard, uiLanguage: UiLanguage) => {
  return uiLanguage === "ja" ? card.labelJa || card.label : card.label;
};

function IntroPanel() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 text-center">
      <div className="text-5xl leading-none" aria-hidden="true">
        🐺
      </div>
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
        狼狼按鈕
      </h1>
      <p className="whitespace-pre-line text-lg font-bold leading-relaxed text-[var(--ink-main)]">
        {`因為我不會說日文，英文也很不擅長，
所以做了這個按鈕。`}
      </p>
      <p className="whitespace-pre-line text-base font-semibold leading-relaxed text-[var(--ink-soft)]">
        {`日本語が話せなくて、英語も苦手なので、
このボタンを作りました。`}
      </p>
      <p className="text-base font-semibold leading-relaxed text-[var(--ink-soft)]">
        I don&apos;t speak Japanese and my English isn&apos;t very good,
        <br />
        so I made my own buttons.
      </p>
    </div>
  );
}

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
  const selectedCard = visibleCards.find((card) => card.id === selectedCardId) || null;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("wolf-buttons.uiLanguage");
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
      window.localStorage.setItem("wolf-buttons.uiLanguage", nextLanguage);
    } catch {
      return;
    }
  };

  return (
    <main className="h-[100dvh] max-h-[100dvh] w-full min-w-0 max-w-full overflow-hidden px-3 py-3 sm:px-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col gap-3">
        <section
          className="parchment-panel max-h-[min(46dvh,24rem)] shrink-0 overflow-y-auto rounded-lg px-4 py-5 sm:px-6"
          aria-live="polite"
        >
          {selectedCard ? (
            <div className="text-center">
              <div className="text-5xl leading-none sm:text-7xl" aria-hidden="true">
                {selectedCard.emoji}
              </div>
              <p className="mt-3 text-2xl font-extrabold leading-snug sm:text-4xl">
                {selectedCard.zh}
              </p>
              <p className="mt-2 text-xl font-bold leading-snug sm:mt-4 sm:text-3xl">
                {selectedCard.ja}
              </p>
              {selectedCard.en && (
                <p className="mt-2 text-base font-semibold leading-snug text-[var(--ink-soft)] sm:mt-4 sm:text-lg">
                  {selectedCard.en}
                </p>
              )}
              {selectedCard.note && (
                <p className="mt-3 rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-3 py-2 text-sm font-semibold text-[var(--ink-soft)]">
                  {selectedCard.note}
                </p>
              )}
            </div>
          ) : (
            <IntroPanel />
          )}
        </section>

        <div className="flex shrink-0 justify-end">
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] text-sm font-extrabold">
            {(["zh", "ja"] as const).map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={uiLanguage === language}
                onClick={() => setLanguage(language)}
                className={`px-4 py-2 ${
                  uiLanguage === language
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--ink-soft)]"
                }`}
              >
                {language === "zh" ? "中文" : "日本語"}
              </button>
            ))}
          </div>
        </div>

        <nav
          className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-1"
          aria-label="字卡分類"
        >
          {categories.length > 0 ? (
            categories.map((category) => {
              const active = category === displayedCategory;

              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-md border px-4 py-2 text-sm font-extrabold ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line-main)] bg-[var(--control-bg)] text-[var(--ink-soft)]"
                  }`}
                >
                  {category}
                </button>
              );
            })
          ) : (
            <span className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] px-4 py-2 text-sm font-bold text-[var(--ink-soft)]">
              尚未有分類
            </span>
          )}
        </nav>

        <div className="min-h-[9rem] min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <section className="grid w-full min-w-0 grid-cols-3 gap-2" aria-label="字卡按鈕">
            {categoryCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCardId(card.id)}
                className={`min-h-[72px] min-w-0 rounded-md border px-2 py-2 text-center font-extrabold shadow-sm ${
                  selectedCard?.id === card.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line-main)] bg-[var(--control-bg)] text-[var(--ink-main)]"
                }`}
              >
                <span className="block text-2xl leading-none" aria-hidden="true">
                  {card.emoji}
                </span>
                <span className="mt-1 block break-words text-sm leading-tight">
                  {getCardButtonLabel(card, uiLanguage)}
                </span>
              </button>
            ))}
          </section>

          {categoryCards.length === 0 && (
            <p className="rounded-md border border-[var(--line-main)] bg-[var(--control-bg)] p-4 text-center text-sm font-bold text-[var(--ink-soft)]">
              目前沒有可顯示的字卡。
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
