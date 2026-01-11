import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createSectionSchema } from "@/lib/validators";
import { type SectionRow, sectionFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get("pageId");

    if (!pageId) {
      return NextResponse.json(
        { error: "pageId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order, created_at"
      )
      .all(pageId) as SectionRow[];
    const sections = rows.map(sectionFromRow);
    return NextResponse.json(sections);
  } catch (error) {
    console.error("Failed to fetch sections:", error);
    return NextResponse.json(
      { error: "Failed to fetch sections" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createSectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { pageId, name, description } = result.data;
    const id = nanoid();

    const db = getDb();

    // Verify page exists
    const page = db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Get next sort order
    const maxOrder = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM sections WHERE page_id = ?"
      )
      .get(pageId) as { max_order: number };

    const stmt = db.prepare(`
      INSERT INTO sections (id, page_id, name, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, pageId, name, description ?? null, maxOrder.max_order + 1);

    const row = db
      .prepare("SELECT * FROM sections WHERE id = ?")
      .get(id) as SectionRow;
    return NextResponse.json(sectionFromRow(row), { status: 201 });
  } catch (error) {
    console.error("Failed to create section:", error);
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}
