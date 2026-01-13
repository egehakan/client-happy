import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createQuestionGroupSchema } from "@/lib/validators";
import { type QuestionGroupRow, questionGroupFromRow } from "@/types";
import { requireAuth, userOwnsProject } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM question_groups WHERE project_id = ? ORDER BY sort_order, created_at",
      args: [projectId],
    });

    return NextResponse.json(result.rows.map((row) => questionGroupFromRow(row as unknown as QuestionGroupRow)));
  } catch (err) {
    console.error("Failed to fetch question groups:", err);
    return NextResponse.json({ error: "Failed to fetch question groups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = createQuestionGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, name, description, scopeType, scopeId } = result.data;
    const id = nanoid();

    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get next sort order within the same scope
    const maxOrderResult = await db.execute({
      sql: `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM question_groups
            WHERE project_id = ? AND scope_type = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))`,
      args: [projectId, scopeType, scopeId ?? null, scopeId ?? null],
    });
    const maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;

    await db.execute({
      sql: `INSERT INTO question_groups (id, project_id, name, description, scope_type, scope_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, projectId, name, description ?? null, scopeType, scopeId ?? null, maxOrder + 1],
    });

    const row = await db.execute({
      sql: "SELECT * FROM question_groups WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(questionGroupFromRow(row.rows[0] as unknown as QuestionGroupRow), { status: 201 });
  } catch (err) {
    console.error("Failed to create question group:", err);
    return NextResponse.json({ error: "Failed to create question group" }, { status: 500 });
  }
}
