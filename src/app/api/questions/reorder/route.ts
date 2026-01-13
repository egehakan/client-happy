import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { reorderQuestionsSchema } from "@/lib/validators";
import { requireAuth, userOwnsQuestion, userOwnsQuestionGroup } from "@/lib/auth/api-auth";

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = reorderQuestionsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { questionOrders } = result.data;

    // Verify ownership for all questions
    const ownershipChecks = await Promise.all(
      questionOrders.map((q) => userOwnsQuestion(session.user.id, q.id))
    );

    if (!ownershipChecks.every((owned) => owned)) {
      return NextResponse.json(
        { error: "One or more questions not found or not owned" },
        { status: 404 }
      );
    }

    // Verify ownership for all group assignments
    const groupIds = [...new Set(questionOrders.map((q) => q.groupId).filter(Boolean))] as string[];
    if (groupIds.length > 0) {
      const groupOwnershipChecks = await Promise.all(
        groupIds.map((id) => userOwnsQuestionGroup(session.user.id, id))
      );
      if (!groupOwnershipChecks.every((owned) => owned)) {
        return NextResponse.json(
          { error: "One or more question groups not found or not owned" },
          { status: 404 }
        );
      }
    }

    // Update all questions (handles sort order, group, and scope changes)
    for (const q of questionOrders) {
      // Build dynamic update based on provided fields
      const updates: string[] = ["sort_order = ?", "updated_at = datetime('now')"];
      const args: (string | number | null)[] = [q.sortOrder];

      // Always update group_id if provided (even if null to remove from group)
      if (q.groupId !== undefined) {
        updates.push("group_id = ?");
        args.push(q.groupId ?? null);
      }

      // Update scope if provided
      if (q.scopeType !== undefined) {
        updates.push("scope_type = ?");
        args.push(q.scopeType);
      }
      if (q.scopeId !== undefined) {
        updates.push("scope_id = ?");
        args.push(q.scopeId ?? null);
      }

      args.push(q.id);

      await db.execute({
        sql: `UPDATE questions SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });
    }

    return NextResponse.json({ success: true, updatedCount: questionOrders.length });
  } catch (err) {
    console.error("Failed to reorder questions:", err);
    return NextResponse.json({ error: "Failed to reorder questions" }, { status: 500 });
  }
}
