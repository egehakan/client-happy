import { NextResponse } from "next/server";
import { type InValue } from "@libsql/client";
import { db, initializeSchema } from "@/lib/db";
import { updatePageSchema } from "@/lib/validators";
import { type PageRow, pageFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await initializeSchema();
    const { id } = await params;

    const result = await db.execute({
      sql: "SELECT * FROM pages WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(pageFromRow(result.rows[0] as unknown as PageRow));
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
    await initializeSchema();
    const { id } = await params;
    const body = await request.json();
    const result = updatePageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.execute({
      sql: "SELECT * FROM pages WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: InValue[] = [];

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

      await db.execute({
        sql: `UPDATE pages SET ${fields.join(", ")} WHERE id = ?`,
        args: values,
      });
    }

    const row = await db.execute({
      sql: "SELECT * FROM pages WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(pageFromRow(row.rows[0] as unknown as PageRow));
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
    await initializeSchema();
    const { id } = await params;

    const existing = await db.execute({
      sql: "SELECT * FROM pages WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    await db.execute({
      sql: "DELETE FROM pages WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete page:", error);
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
