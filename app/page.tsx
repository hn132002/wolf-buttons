import WolfButtonsClient from "@/app/WolfButtonsClient";
import { projectStoredCardCategories, serializeCard, sortCards } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getInitialData = async () => {
  try {
    const [cards, categories] = await Promise.all([
      prisma.communicationCard.findMany({
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.communicationCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const serializedCards = sortCards(cards.map(serializeCard));

    return {
      cards: serializedCards,
      categories: projectStoredCardCategories(categories, serializedCards),
    };
  } catch (error) {
    console.error("讀取字卡初始資料失敗:", error);
    return { cards: [], categories: [] };
  }
};

export default async function HomePage() {
  const { cards, categories } = await getInitialData();

  return <WolfButtonsClient initialCards={cards} initialCategories={categories} />;
}
