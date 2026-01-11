import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createProjectSchema } from "@/lib/validators";
import { generateSlug } from "@/lib/utils";
import { type ProjectRow, projectFromRow } from "@/types";

export async function GET() {
  try {
    await initializeSchema();
    const result = await db.execute(
      "SELECT * FROM projects ORDER BY created_at DESC"
    );
    const projects = result.rows.map((row) => projectFromRow(row as unknown as ProjectRow));
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
    await initializeSchema();
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

    // Ensure slug is unique
    const existingSlug = await db.execute({
      sql: "SELECT id FROM projects WHERE slug = ?",
      args: [slug],
    });
    if (existingSlug.rows.length > 0) {
      slug = `${slug}-${nanoid(6)}`;
    }

    await db.execute({
      sql: `INSERT INTO projects (id, name, slug, type, description) VALUES (?, ?, ?, ?, ?)`,
      args: [id, name, slug, type, description ?? null],
    });

    const row = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(projectFromRow(row.rows[0] as unknown as ProjectRow), { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
