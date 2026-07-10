import WolfButtonsClient from "@/app/WolfButtonsClient";
import { projectPublicCardCategories, serializeCard, sortCards } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getInitialData = async () => {
  try {
    const [cards, categories] = await Promise.all([
      prisma.communicationCard.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.communicationCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const serializedCards = sortCards(cards.map(serializeCard));

    return {
      cards: serializedCards,
      categories: projectPublicCardCategories(categories, serializedCards),
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
