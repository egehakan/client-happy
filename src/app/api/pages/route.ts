import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createPageSchema } from "@/lib/validators";
import { type PageRow, pageFromRow } from "@/types";
import { requireAuth, userOwnsProject } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify user owns the project
    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order, created_at",
      args: [projectId],
    });
    const pages = result.rows.map((row) => pageFromRow(row as unknown as PageRow));
    return NextResponse.json(pages);
  } catch (err) {
    console.error("Failed to fetch pages:", err);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = createPageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, name, description } = result.data;
    const id = nanoid();

    // Verify user owns the project
    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get next sort order
    const maxOrderResult = await db.execute({
      sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM pages WHERE project_id = ?",
      args: [projectId],
    });
    const maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;

    await db.execute({
      sql: `INSERT INTO pages (id, project_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
      args: [id, projectId, name, description ?? null, maxOrder + 1],
    });

    const row = await db.execute({
      sql: "SELECT * FROM pages WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(pageFromRow(row.rows[0] as unknown as PageRow), { status: 201 });
  } catch (err) {
    console.error("Failed to create page:", err);
    return NextResponse.json(
      { error: "Failed to create page" },
      { status: 500 }
    );
  }
}
