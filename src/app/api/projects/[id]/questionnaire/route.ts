import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db, initializeSchema } from "@/lib/db";
import { requireAuth, userOwnsProject } from "@/lib/auth/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE all questionnaire responses for a project
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

    // Get all file paths from responses that need to be deleted from blob storage
    const filePathsResult = await db.execute({
      sql: `
        SELECT qr.file_path FROM question_responses qr
        JOIN questions q ON qr.question_id = q.id
        WHERE q.project_id = ? AND qr.file_path IS NOT NULL
      `,
      args: [id],
    });

    // Collect all blob URLs to delete
    const blobUrlsToDelete: string[] = [];
    for (const row of filePathsResult.rows) {
      const filePath = (row as unknown as { file_path: string }).file_path;
      if (filePath) {
        try {
          // Handle both single files and JSON arrays of files
          const parsed = JSON.parse(filePath);
          if (Array.isArray(parsed)) {
            blobUrlsToDelete.push(...parsed.filter((p: string) => p && p.includes("blob.vercel-storage.com")));
          }
        } catch {
          // Single file path (not JSON array)
          if (filePath.includes("blob.vercel-storage.com")) {
            blobUrlsToDelete.push(filePath);
          }
        }
      }
    }

    // Delete files from Vercel Blob storage
    let deletedFilesCount = 0;
    for (const url of blobUrlsToDelete) {
      try {
        await del(url);
        deletedFilesCount++;
      } catch (deleteError) {
        console.error(`Failed to delete blob: ${url}`, deleteError);
        // Continue with other deletions even if one fails
      }
    }

    // Count responses before deletion
    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM question_responses
        WHERE question_id IN (
          SELECT id FROM questions WHERE project_id = ?
        )
      `,
      args: [id],
    });
    const deletedCount = (countResult.rows[0] as unknown as { count: number }).count;

    // Delete all questionnaire responses for questions in this project
    await db.execute({
      sql: `
        DELETE FROM question_responses
        WHERE question_id IN (
          SELECT id FROM questions WHERE project_id = ?
        )
      `,
      args: [id],
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      deletedFilesCount,
    });
  } catch (err) {
    console.error("Failed to reset questionnaire responses:", err);
    return NextResponse.json(
      { error: "Failed to reset questionnaire responses" },
      { status: 500 }
    );
  }
}
