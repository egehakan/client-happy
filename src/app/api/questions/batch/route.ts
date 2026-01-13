import { NextResponse } from "next/server";
import { z } from "zod";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsQuestion } from "@/lib/auth/api-auth";

const batchDeleteSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1, "At least one question ID is required"),
});

export async function DELETE(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = batchDeleteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { questionIds } = result.data;

    // Verify ownership for all questions
    const ownershipChecks = await Promise.all(
      questionIds.map((id) => userOwnsQuestion(session.user.id, id))
    );

    const allOwned = ownershipChecks.every((owned) => owned);
    if (!allOwned) {
      return NextResponse.json(
        { error: "One or more questions not found or not owned" },
        { status: 404 }
      );
    }

    // Delete all questions in a single transaction-like operation
    const placeholders = questionIds.map(() => "?").join(", ");
    await db.execute({
      sql: `DELETE FROM questions WHERE id IN (${placeholders})`,
      args: questionIds,
    });

    return NextResponse.json({
      success: true,
      deletedCount: questionIds.length
    });
  } catch (err) {
    console.error("Failed to batch delete questions:", err);
    return NextResponse.json(
      { error: "Failed to delete questions" },
      { status: 500 }
    );
  }
}
