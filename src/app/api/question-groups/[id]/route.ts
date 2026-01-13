import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { updateQuestionGroupSchema } from "@/lib/validators";
import { type QuestionGroupRow, questionGroupFromRow } from "@/types";
import { requireAuth, userOwnsQuestionGroup } from "@/lib/auth/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestionGroup(session.user.id, id))) {
      return NextResponse.json({ error: "Question group not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM question_groups WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Question group not found" }, { status: 404 });
    }

    return NextResponse.json(questionGroupFromRow(result.rows[0] as unknown as QuestionGroupRow));
  } catch (err) {
    console.error("Failed to fetch question group:", err);
    return NextResponse.json({ error: "Failed to fetch question group" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestionGroup(session.user.id, id))) {
      return NextResponse.json({ error: "Question group not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = updateQuestionGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (result.data.name !== undefined) {
      updates.push("name = ?");
      args.push(result.data.name);
    }
    if (result.data.description !== undefined) {
      updates.push("description = ?");
      args.push(result.data.description);
    }
    if (result.data.sortOrder !== undefined) {
      updates.push("sort_order = ?");
      args.push(result.data.sortOrder);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    args.push(id);

    await db.execute({
      sql: `UPDATE question_groups SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const row = await db.execute({
      sql: "SELECT * FROM question_groups WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(questionGroupFromRow(row.rows[0] as unknown as QuestionGroupRow));
  } catch (err) {
    console.error("Failed to update question group:", err);
    return NextResponse.json({ error: "Failed to update question group" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestionGroup(session.user.id, id))) {
      return NextResponse.json({ error: "Question group not found" }, { status: 404 });
    }

    // Questions in this group will have their group_id set to NULL (ON DELETE SET NULL)
    await db.execute({
      sql: "DELETE FROM question_groups WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete question group:", err);
    return NextResponse.json({ error: "Failed to delete question group" }, { status: 500 });
  }
}
