import WolfButtonsClient from "@/app/WolfButtonsClient";
import { serializeCard, sortCards } from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getInitialCards = async () => {
  try {
    const cards = await prisma.communicationCard.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return sortCards(cards.map(serializeCard));
  } catch (error) {
    console.error("讀取字卡初始資料失敗:", error);
    return [];
  }
};

export default async function HomePage() {
  const cards = await getInitialCards();

  return <WolfButtonsClient initialCards={cards} />;
}
