import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updatePageSchema } from "@/lib/validators";
import { type PageRow, pageFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(id) as PageRow | undefined;

    if (!row) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(pageFromRow(row));
  } catch (error) {
    console.error("Failed to fetch page:", error);
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = updatePageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(id) as PageRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
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

      db.prepare(`UPDATE pages SET ${fields.join(", ")} WHERE id = ?`).run(
        ...values
      );
    }

    const row = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(id) as PageRow;
    return NextResponse.json(pageFromRow(row));
  } catch (error) {
    console.error("Failed to update page:", error);
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(id) as PageRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM pages WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete page:", error);
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
