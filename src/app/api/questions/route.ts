import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createQuestionSchema } from "@/lib/validators";
import { type QuestionRow, questionFromRow } from "@/types";
import { requireAuth, userOwnsProject, userOwnsPage, userOwnsSection, userOwnsQuestionGroup } from "@/lib/auth/api-auth";

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
      sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order, created_at",
      args: [projectId],
    });

    return NextResponse.json(result.rows.map((row) => questionFromRow(row as unknown as QuestionRow)));
  } catch (err) {
    console.error("Failed to fetch questions:", err);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = createQuestionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, groupId, scopeType, scopeId, fieldType, label, description, placeholder, options, isRequired, maxFileCount } = result.data;
    const id = nanoid();

    // Verify ownership
    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify group ownership if applicable
    if (groupId) {
      if (!(await userOwnsQuestionGroup(session.user.id, groupId))) {
        return NextResponse.json({ error: "Question group not found" }, { status: 404 });
      }
    }

    // Verify scope ownership if applicable
    if (scopeType === "page" && scopeId) {
      if (!(await userOwnsPage(session.user.id, scopeId))) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }
    }
    if (scopeType === "section" && scopeId) {
      if (!(await userOwnsSection(session.user.id, scopeId))) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
    }

    // Get next sort order within scope
    const maxOrderResult = await db.execute({
      sql: `SELECT COALESCE(MAX(sort_order), -1) as max_order
            FROM questions
            WHERE project_id = ? AND scope_type = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))`,
      args: [projectId, scopeType, scopeId ?? null, scopeId ?? null],
    });
    const maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;

    await db.execute({
      sql: `INSERT INTO questions (id, project_id, group_id, scope_type, scope_id, field_type, label, description, placeholder, options, is_required, max_file_count, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        projectId,
        groupId ?? null,
        scopeType,
        scopeId ?? null,
        fieldType,
        label,
        description ?? null,
        placeholder ?? null,
        options ? JSON.stringify(options) : null,
        isRequired ? 1 : 0,
        fieldType === "file" ? (maxFileCount ?? 1) : 1,
        maxOrder + 1,
      ],
    });

    const row = await db.execute({
      sql: "SELECT * FROM questions WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(questionFromRow(row.rows[0] as unknown as QuestionRow), { status: 201 });
  } catch (err) {
    console.error("Failed to create question:", err);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}
