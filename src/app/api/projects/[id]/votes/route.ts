import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE all votes for a project
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await initializeSchema();
    const { id } = await params;

    // Verify project exists
    const project = await db.execute({
      sql: "SELECT id FROM projects WHERE id = ?",
      args: [id],
    });

    if (project.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Count votes before deletion
    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM votes
        WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
        )
      `,
      args: [id],
    });
    const deletedCount = (countResult.rows[0] as unknown as { count: number }).count;

    // Delete all votes for screenshots in this project
    await db.execute({
      sql: `
        DELETE FROM votes
        WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
        )
      `,
      args: [id],
    });

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error("Failed to reset votes:", error);
    return NextResponse.json(
      { error: "Failed to reset votes" },
      { status: 500 }
    );
  }
}
