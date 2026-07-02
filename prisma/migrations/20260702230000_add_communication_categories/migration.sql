CREATE TABLE "CommunicationCategory" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "emoji" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationCategory_key_key" ON "CommunicationCategory"("key");
CREATE INDEX "CommunicationCategory_sortOrder_idx" ON "CommunicationCategory"("sortOrder");
