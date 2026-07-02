CREATE TABLE "CommunicationCard" (
  "id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "labelJa" TEXT,
  "zh" TEXT NOT NULL,
  "ja" TEXT NOT NULL,
  "en" TEXT,
  "note" TEXT,
  "categories" TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationCard_pkey" PRIMARY KEY ("id")
);
