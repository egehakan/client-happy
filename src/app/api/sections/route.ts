import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createSectionSchema } from "@/lib/validators";
import { type SectionRow, sectionFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get("pageId");

    if (!pageId) {
      return NextResponse.json(
        { error: "pageId is required" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: "SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order, created_at",
      args: [pageId],
    });
    const sections = result.rows.map((row) => sectionFromRow(row as unknown as SectionRow));
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
    await initializeSchema();
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

    // Verify page exists
    const page = await db.execute({
      sql: "SELECT id FROM pages WHERE id = ?",
      args: [pageId],
    });
    if (page.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Get next sort order
    const maxOrderResult = await db.execute({
      sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM sections WHERE page_id = ?",
      args: [pageId],
    });
    const maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;

    await db.execute({
      sql: `INSERT INTO sections (id, page_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
      args: [id, pageId, name, description ?? null, maxOrder + 1],
    });

    const row = await db.execute({
      sql: "SELECT * FROM sections WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(sectionFromRow(row.rows[0] as unknown as SectionRow), { status: 201 });
  } catch (error) {
    console.error("Failed to create section:", error);
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}
