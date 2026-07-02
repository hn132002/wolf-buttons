import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  batchRowToPayload,
  previewBatchRows,
  serializeCard,
  sortCards,
  type BatchApplyMode,
  type BatchCardRow,
} from "@/lib/cards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const isBatchMode = (value: unknown): value is BatchApplyMode =>
  value === "upsert" || value === "replace";

const createData = (row: BatchCardRow) => {
  const payload = batchRowToPayload(row);

  return {
    emoji: payload.emoji!,
    label: payload.label!,
    labelJa: payload.labelJa ?? null,
    zh: payload.zh!,
    ja: payload.ja!,
    en: payload.en ?? null,
    note: payload.note ?? null,
    categories: payload.categories!,
    sortOrder: payload.sortOrder ?? 0,
    isVisible: payload.isVisible ?? true,
  };
};

export async function POST(request: Request) {
  const denied = requireAdmin(request);

  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as {
      mode?: unknown;
      cards?: unknown;
    } | null;

    if (!body || !isBatchMode(body.mode)) {
      return NextResponse.json(
        { error: "mode 必須是 upsert 或 replace" },
        { status: 400 }
      );
    }

    const existing = sortCards(
      (
        await prisma.communicationCard.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        })
      ).map(serializeCard)
    );
    const preview = previewBatchRows(body.cards, existing, body.mode);

    if (preview.errors.length > 0) {
      return NextResponse.json({ errors: preview.errors }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const row of preview.creates) {
        await tx.communicationCard.create({ data: createData(row) });
      }

      for (const row of preview.updates) {
        await tx.communicationCard.update({
          where: { id: row.id },
          data: batchRowToPayload(row),
        });
      }

      if (body.mode === "replace" && preview.replaceDeletes.length > 0) {
        await tx.communicationCard.deleteMany({
          where: { id: { in: preview.replaceDeletes.map((card) => card.id) } },
        });
      }

      return {
        created: preview.creates.length,
        updated: preview.updates.length,
        hidden: preview.hides.length,
        shown: preview.shows.length,
        deleted: body.mode === "replace" ? preview.replaceDeletes.length : 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("批次更新字卡失敗:", error);
    return NextResponse.json({ error: "批次更新字卡失敗" }, { status: 500 });
  }
}
