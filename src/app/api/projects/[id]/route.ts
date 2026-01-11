import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateProjectSchema } from "@/lib/validators";
import {
  type ProjectRow,
  type PageRow,
  type SectionRow,
  type ScreenshotRow,
  type VoteRow,
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  voteFromRow,
  type ProjectWithPages,
} from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const projectRow = db
      .prepare("SELECT * FROM projects WHERE id = ? OR slug = ?")
      .get(id, id) as ProjectRow | undefined;

    if (!projectRow) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectFromRow(projectRow);

    // Fetch pages with sections and screenshots
    const pageRows = db
      .prepare("SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order")
      .all(project.id) as PageRow[];

    const pagesWithSections = pageRows.map((pageRow) => {
      const page = pageFromRow(pageRow);

      const sectionRows = db
        .prepare("SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order")
        .all(page.id) as SectionRow[];

      const sectionsWithScreenshots = sectionRows.map((sectionRow) => {
        const section = sectionFromRow(sectionRow);

        const screenshotRows = db
          .prepare(
            "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order"
          )
          .all(section.id) as ScreenshotRow[];

        const screenshotsWithVotes = screenshotRows.map((screenshotRow) => {
          const screenshot = screenshotFromRow(screenshotRow);

          const voteRows = db
            .prepare("SELECT * FROM votes WHERE screenshot_id = ?")
            .all(screenshot.id) as VoteRow[];

          const votes = voteRows.map(voteFromRow);

          const votesSummary = {
            yes: votes.filter((v) => v.vote === "yes").length,
            mid: votes.filter((v) => v.vote === "mid").length,
            no: votes.filter((v) => v.vote === "no").length,
          };

          return { ...screenshot, votes, votesSummary };
        });

        return { ...section, screenshots: screenshotsWithVotes };
      });

      return { ...page, sections: sectionsWithScreenshots };
    });

    const result: ProjectWithPages = {
      ...project,
      pages: pagesWithSections,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = updateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      // Check slug uniqueness
      const existingSlug = db
        .prepare("SELECT id FROM projects WHERE slug = ? AND id != ?")
        .get(updates.slug, id);
      if (existingSlug) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        );
      }
      fields.push("slug = ?");
      values.push(updates.slug);
    }
    if (updates.type !== undefined) {
      fields.push("type = ?");
      values.push(updates.type);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);

      db.prepare(
        `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`
      ).run(...values);
    }

    const row = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow;
    return NextResponse.json(projectFromRow(row));
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete project (cascades to pages, sections, screenshots, votes)
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
