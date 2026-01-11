import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createScreenshotSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
      return NextResponse.json(
        { error: "sectionId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order, created_at"
      )
      .all(sectionId) as ScreenshotRow[];
    const screenshots = rows.map(screenshotFromRow);
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

    const db = getDb();

    // Verify section exists
    const section = db
      .prepare("SELECT id FROM sections WHERE id = ?")
      .get(sectionId);
    if (!section) {
      return NextResponse.json(
        { error: "Section not found" },
        { status: 404 }
      );
    }

    // Get next sort order
    const maxOrder = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE section_id = ?"
      )
      .get(sectionId) as { max_order: number };

    const stmt = db.prepare(`
      INSERT INTO screenshots (id, section_id, title, description, source_type, file_path, external_url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      sectionId,
      title ?? null,
      description ?? null,
      sourceType,
      filePath ?? null,
      externalUrl ?? null,
      maxOrder.max_order + 1
    );

    const row = db
      .prepare("SELECT * FROM screenshots WHERE id = ?")
      .get(id) as ScreenshotRow;
    return NextResponse.json(screenshotFromRow(row), { status: 201 });
  } catch (error) {
    console.error("Failed to create screenshot:", error);
    return NextResponse.json(
      { error: "Failed to create screenshot" },
      { status: 500 }
    );
  }
}
