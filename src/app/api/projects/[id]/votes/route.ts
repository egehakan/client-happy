import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE all votes for a project
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    // Verify project exists
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete all votes for screenshots in this project
    const result = db
      .prepare(
        `
        DELETE FROM votes
        WHERE screenshot_id IN (
          SELECT s.id FROM screenshots s
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
        )
      `
      )
      .run(id);

    return NextResponse.json({
      success: true,
      deletedCount: result.changes,
    });
  } catch (error) {
    console.error("Failed to reset votes:", error);
    return NextResponse.json(
      { error: "Failed to reset votes" },
      { status: 500 }
    );
  }
}
