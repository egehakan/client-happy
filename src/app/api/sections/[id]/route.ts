import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateSectionSchema } from "@/lib/validators";
import { type SectionRow, sectionFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db
      .prepare("SELECT * FROM sections WHERE id = ?")
      .get(id) as SectionRow | undefined;

    if (!row) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(sectionFromRow(row));
  } catch (error) {
    console.error("Failed to fetch section:", error);
    return NextResponse.json(
      { error: "Failed to fetch section" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = updateSectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM sections WHERE id = ?")
      .get(id) as SectionRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
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

      db.prepare(`UPDATE sections SET ${fields.join(", ")} WHERE id = ?`).run(
        ...values
      );
    }

    const row = db
      .prepare("SELECT * FROM sections WHERE id = ?")
      .get(id) as SectionRow;
    return NextResponse.json(sectionFromRow(row));
  } catch (error) {
    console.error("Failed to update section:", error);
    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM sections WHERE id = ?")
      .get(id) as SectionRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM sections WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete section:", error);
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }
}
