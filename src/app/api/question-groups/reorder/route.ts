import { NextResponse } from "next/server";
import { z } from "zod";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsQuestionGroup } from "@/lib/auth/api-auth";

const reorderGroupsSchema = z.object({
  groupOrders: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
});

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = reorderGroupsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { groupOrders } = result.data;

    // Verify ownership for all groups
    const ownershipChecks = await Promise.all(
      groupOrders.map((g) => userOwnsQuestionGroup(session.user.id, g.id))
    );

    if (!ownershipChecks.every((owned) => owned)) {
      return NextResponse.json(
        { error: "One or more groups not found or not owned" },
        { status: 404 }
      );
    }

    // Update all groups
    for (const g of groupOrders) {
      await db.execute({
        sql: "UPDATE question_groups SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        args: [g.sortOrder, g.id],
      });
    }

    return NextResponse.json({ success: true, updatedCount: groupOrders.length });
  } catch (err) {
    console.error("Failed to reorder groups:", err);
    return NextResponse.json({ error: "Failed to reorder groups" }, { status: 500 });
  }
}
