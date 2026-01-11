import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createProjectSchema } from "@/lib/validators";
import { generateSlug } from "@/lib/utils";
import { type ProjectRow, projectFromRow } from "@/types";

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all() as ProjectRow[];
    const projects = rows.map(projectFromRow);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, type, description } = result.data;
    const id = nanoid();
    let slug = generateSlug(name);

    const db = getDb();

    // Ensure slug is unique
    const existingSlug = db
      .prepare("SELECT id FROM projects WHERE slug = ?")
      .get(slug);
    if (existingSlug) {
      slug = `${slug}-${nanoid(6)}`;
    }

    const stmt = db.prepare(`
      INSERT INTO projects (id, name, slug, type, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, slug, type, description ?? null);

    const row = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow;
    return NextResponse.json(projectFromRow(row), { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
