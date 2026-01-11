import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { updateQuestionSchema } from "@/lib/validators";
import { type QuestionRow, questionFromRow } from "@/types";
import { requireAuth, userOwnsQuestion } from "@/lib/auth/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestion(session.user.id, id))) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM questions WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(questionFromRow(result.rows[0] as unknown as QuestionRow));
  } catch (err) {
    console.error("Failed to fetch question:", err);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestion(session.user.id, id))) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = updateQuestionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (result.data.label !== undefined) {
      updates.push("label = ?");
      args.push(result.data.label);
    }
    if (result.data.description !== undefined) {
      updates.push("description = ?");
      args.push(result.data.description);
    }
    if (result.data.placeholder !== undefined) {
      updates.push("placeholder = ?");
      args.push(result.data.placeholder);
    }
    if (result.data.options !== undefined) {
      updates.push("options = ?");
      args.push(result.data.options ? JSON.stringify(result.data.options) : null);
    }
    if (result.data.isRequired !== undefined) {
      updates.push("is_required = ?");
      args.push(result.data.isRequired ? 1 : 0);
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
      sql: `UPDATE questions SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const row = await db.execute({
      sql: "SELECT * FROM questions WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(questionFromRow(row.rows[0] as unknown as QuestionRow));
  } catch (err) {
    console.error("Failed to update question:", err);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await initializeSchema();

    if (!(await userOwnsQuestion(session.user.id, id))) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await db.execute({
      sql: "DELETE FROM questions WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete question:", err);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
