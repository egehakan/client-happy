import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { type QuestionRow, questionFromRow } from "@/types";

// GET - Fetch questions for a project by slug (public, for client questionnaire)
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    await initializeSchema();

    // Get project by slug
    const projectResult = await db.execute({
      sql: "SELECT id FROM projects WHERE slug = ?",
      args: [slug],
    });

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectId = (projectResult.rows[0] as unknown as { id: string }).id;

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
