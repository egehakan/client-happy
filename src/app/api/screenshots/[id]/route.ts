import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { getDb } from "@/lib/db";
import { updateScreenshotSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db
      .prepare("SELECT * FROM screenshots WHERE id = ?")
      .get(id) as ScreenshotRow | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(screenshotFromRow(row));
  } catch (error) {
    console.error("Failed to fetch screenshot:", error);
    return NextResponse.json(
      { error: "Failed to fetch screenshot" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = updateScreenshotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM screenshots WHERE id = ?")
      .get(id) as ScreenshotRow | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.sortOrder !== undefined) {
      fields.push("sort_order = ?");
      values.push(updates.sortOrder);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);

      db.prepare(`UPDATE screenshots SET ${fields.join(", ")} WHERE id = ?`).run(
        ...values
      );
    }

    const row = db
      .prepare("SELECT * FROM screenshots WHERE id = ?")
      .get(id) as ScreenshotRow;
    return NextResponse.json(screenshotFromRow(row));
  } catch (error) {
    console.error("Failed to update screenshot:", error);
    return NextResponse.json(
      { error: "Failed to update screenshot" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM screenshots WHERE id = ?")
      .get(id) as ScreenshotRow | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    // Delete local file if exists
    if (existing.source_type === "local" && existing.file_path) {
      try {
        const filePath = join(process.cwd(), "public", existing.file_path);
        await unlink(filePath);
      } catch {
        // File may not exist, ignore error
      }
    }

    db.prepare("DELETE FROM screenshots WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete screenshot:", error);
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    );
  }
}
