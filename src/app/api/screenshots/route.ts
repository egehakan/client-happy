import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createScreenshotSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
      return NextResponse.json(
        { error: "sectionId is required" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order, created_at",
      args: [sectionId],
    });
    const screenshots = result.rows.map((row) => screenshotFromRow(row as unknown as ScreenshotRow));
    return NextResponse.json(screenshots);
  } catch (error) {
    console.error("Failed to fetch screenshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch screenshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initializeSchema();
    const body = await request.json();
    const result = createScreenshotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { sectionId, title, description, sourceType, filePath, externalUrl } =
      result.data;
    const id = nanoid();

    // Verify section exists
    const section = await db.execute({
      sql: "SELECT id FROM sections WHERE id = ?",
      args: [sectionId],
    });
    if (section.rows.length === 0) {
      return NextResponse.json(
        { error: "Section not found" },
        { status: 404 }
      );
    }

    // Get next sort order
    const maxOrderResult = await db.execute({
      sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE section_id = ?",
      args: [sectionId],
    });
    const maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;

    await db.execute({
      sql: `INSERT INTO screenshots (id, section_id, title, description, source_type, file_path, external_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        sectionId,
        title ?? null,
        description ?? null,
        sourceType,
        filePath ?? null,
        externalUrl ?? null,
        maxOrder + 1,
      ],
    });

    const row = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(screenshotFromRow(row.rows[0] as unknown as ScreenshotRow), { status: 201 });
  } catch (error) {
    console.error("Failed to create screenshot:", error);
    return NextResponse.json(
      { error: "Failed to create screenshot" },
      { status: 500 }
    );
  }
}
