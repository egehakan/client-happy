import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, initializeSchema } from "@/lib/db";
import { bulkCreateScreenshotsSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";
import { requireAuth, userOwnsProject, userOwnsSection, userOwnsPage, userOwnsScreenshot } from "@/lib/auth/api-auth";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10;

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const formData = await request.formData();

    // Get metadata
    const metadataJson = formData.get("metadata") as string | null;
    if (!metadataJson) {
      return NextResponse.json({ error: "Metadata is required" }, { status: 400 });
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataJson);
    } catch {
      return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 });
    }

    // Validate metadata
    const validationResult = bulkCreateScreenshotsSchema.safeParse(metadata);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, sectionId, pageId, screenshots: screenshotMetadata } = validationResult.data;

    // Verify user owns the project
    if (!(await userOwnsProject(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership of section or page
    if (sectionId) {
      if (!(await userOwnsSection(session.user.id, sectionId))) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
    } else if (pageId) {
      if (!(await userOwnsPage(session.user.id, pageId))) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }
    }

    // Get all files from form data
    const files: File[] = [];
    for (let i = 0; i < MAX_FILES; i++) {
      const file = formData.get(`file_${i}`) as File | null;
      if (file) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length !== screenshotMetadata.length) {
      return NextResponse.json(
        { error: `File count (${files.length}) doesn't match metadata count (${screenshotMetadata.length})` },
        { status: 400 }
      );
    }

    // Validate all files first
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 10MB` },
          { status: 400 }
        );
      }
    }

    // Get current max sort order
    let maxOrder = -1;
    if (sectionId) {
      const maxOrderResult = await db.execute({
        sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE section_id = ?",
        args: [sectionId],
      });
      maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;
    } else if (pageId) {
      const maxOrderResult = await db.execute({
        sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE page_id = ? AND section_id IS NULL",
        args: [pageId],
      });
      maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;
    }

    // Upload files and create records
    const results: { success: boolean; screenshot?: ReturnType<typeof screenshotFromRow>; error?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = screenshotMetadata[i];

      try {
        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const filename = `${projectId}/${nanoid()}.${ext}`;

        // Upload to Vercel Blob
        const blob = await put(filename, file, {
          access: "public",
          addRandomSuffix: false,
        });

        // Create screenshot record
        const id = nanoid();
        const sortOrder = maxOrder + 1 + i;

        await db.execute({
          sql: `INSERT INTO screenshots (id, section_id, page_id, title, description, source_type, file_path, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            sectionId ?? null,
            pageId ?? null,
            meta.title ?? null,
            meta.description ?? null,
            "local",
            blob.url,
            sortOrder,
          ],
        });

        const row = await db.execute({
          sql: "SELECT * FROM screenshots WHERE id = ?",
          args: [id],
        });

        results.push({
          success: true,
          screenshot: screenshotFromRow(row.rows[0] as unknown as ScreenshotRow),
        });
      } catch (err) {
        console.error(`Failed to upload file ${file.name}:`, err);
        results.push({
          success: false,
          error: `Failed to upload ${file.name}`,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `${successCount} screenshot${successCount !== 1 ? "s" : ""} uploaded${failCount > 0 ? `, ${failCount} failed` : ""}`,
      results,
      successCount,
      failCount,
    }, { status: successCount > 0 ? 201 : 500 });
  } catch (err) {
    console.error("Failed to bulk upload screenshots:", err);
    return NextResponse.json(
      { error: "Failed to upload screenshots" },
      { status: 500 }
    );
  }
}

// Bulk delete schema
const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required").max(50, "Maximum 50 screenshots per delete"),
});

export async function DELETE(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();

    const validationResult = bulkDeleteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { ids } = validationResult.data;

    // Verify user owns all screenshots
    for (const id of ids) {
      if (!(await userOwnsScreenshot(session.user.id, id))) {
        return NextResponse.json(
          { error: `Screenshot not found: ${id}` },
          { status: 404 }
        );
      }
    }

    // Get all screenshots to delete their blob files
    const placeholders = ids.map(() => "?").join(", ");
    const existing = await db.execute({
      sql: `SELECT * FROM screenshots WHERE id IN (${placeholders})`,
      args: ids,
    });

    let successCount = 0;
    let failCount = 0;

    for (const row of existing.rows) {
      const screenshot = row as unknown as ScreenshotRow;
      try {
        // Delete from Vercel Blob if it's a local upload
        if (screenshot.source_type === "local" && screenshot.file_path) {
          try {
            await del(screenshot.file_path);
          } catch {
            // Blob may not exist or already deleted, ignore error
          }
        }

        await db.execute({
          sql: "DELETE FROM screenshots WHERE id = ?",
          args: [screenshot.id],
        });

        successCount++;
      } catch {
        failCount++;
      }
    }

    return NextResponse.json({
      message: `${successCount} screenshot${successCount !== 1 ? "s" : ""} deleted${failCount > 0 ? `, ${failCount} failed` : ""}`,
      successCount,
      failCount,
    });
  } catch (err) {
    console.error("Failed to bulk delete screenshots:", err);
    return NextResponse.json(
      { error: "Failed to delete screenshots" },
      { status: 500 }
    );
  }
}
