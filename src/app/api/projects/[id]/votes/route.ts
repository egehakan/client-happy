import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsProject } from "@/lib/auth/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE all votes for a project
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { id } = await params;

    // Verify user owns the project
    if (!(await userOwnsProject(session.user.id, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Count votes before deletion (includes both section-level and page-level screenshots)
    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM votes
        WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN pages p ON sec.page_id = p.id OR s.page_id = p.id
          WHERE p.project_id = ?
        )
      `,
      args: [id],
    });
    const deletedCount = (countResult.rows[0] as unknown as { count: number }).count;

    // Delete all votes for screenshots in this project (includes both section-level and page-level screenshots)
    await db.execute({
      sql: `
        DELETE FROM votes
        WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN pages p ON sec.page_id = p.id OR s.page_id = p.id
          WHERE p.project_id = ?
        )
      `,
      args: [id],
    });

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (err) {
    console.error("Failed to reset votes:", err);
    return NextResponse.json(
      { error: "Failed to reset votes" },
      { status: 500 }
    );
  }
}
