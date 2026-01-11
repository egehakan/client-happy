import { NextResponse } from "next/server";
import { type InValue } from "@libsql/client";
import { del } from "@vercel/blob";
import { db, initializeSchema } from "@/lib/db";
import { updateScreenshotSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await initializeSchema();
    const { id } = await params;

    const result = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(screenshotFromRow(result.rows[0] as unknown as ScreenshotRow));
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
    await initializeSchema();
    const { id } = await params;
    const body = await request.json();
    const result = updateScreenshotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: InValue[] = [];

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

      await db.execute({
        sql: `UPDATE screenshots SET ${fields.join(", ")} WHERE id = ?`,
        args: values,
      });
    }

    const row = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(screenshotFromRow(row.rows[0] as unknown as ScreenshotRow));
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
    await initializeSchema();
    const { id } = await params;

    const existing = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    const row = existing.rows[0] as unknown as ScreenshotRow;

    // Delete from Vercel Blob if it's a local upload (stored as blob URL)
    if (row.source_type === "local" && row.file_path) {
      try {
        await del(row.file_path);
      } catch {
        // Blob may not exist or already deleted, ignore error
      }
    }

    await db.execute({
      sql: "DELETE FROM screenshots WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete screenshot:", error);
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    );
  }
}
