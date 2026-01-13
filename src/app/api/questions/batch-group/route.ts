import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { batchAddToGroupSchema } from "@/lib/validators";
import { requireAuth, userOwnsQuestion, userOwnsQuestionGroup } from "@/lib/auth/api-auth";

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = batchAddToGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { questionIds, groupId } = result.data;

    // Verify group ownership
    if (!(await userOwnsQuestionGroup(session.user.id, groupId))) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Verify all questions belong to the user
    for (const questionId of questionIds) {
      if (!(await userOwnsQuestion(session.user.id, questionId))) {
        return NextResponse.json(
          { error: `Question not found: ${questionId}` },
          { status: 404 }
        );
      }
    }

    // Update all questions to belong to the group
    for (const questionId of questionIds) {
      await db.execute({
        sql: "UPDATE questions SET group_id = ?, updated_at = datetime('now') WHERE id = ?",
        args: [groupId, questionId],
      });
    }

    return NextResponse.json({
      success: true,
      updatedCount: questionIds.length
    });
  } catch (err) {
    console.error("Failed to batch add questions to group:", err);
    return NextResponse.json(
      { error: "Failed to batch add questions to group" },
      { status: 500 }
    );
  }
}
