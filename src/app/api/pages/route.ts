import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createPageSchema } from "@/lib/validators";
import { type PageRow, pageFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order, created_at"
      )
      .all(projectId) as PageRow[];
    const pages = rows.map(pageFromRow);
    return NextResponse.json(pages);
  } catch (error) {
    console.error("Failed to fetch pages:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const db = getDb();

    // Verify project exists
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get next sort order
    const maxOrder = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM pages WHERE project_id = ?"
      )
      .get(projectId) as { max_order: number };

    const stmt = db.prepare(`
      INSERT INTO pages (id, project_id, name, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, name, description ?? null, maxOrder.max_order + 1);

    const row = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(id) as PageRow;
    return NextResponse.json(pageFromRow(row), { status: 201 });
  } catch (error) {
    console.error("Failed to create page:", error);
    return NextResponse.json(
      { error: "Failed to create page" },
      { status: 500 }
    );
  }
}
