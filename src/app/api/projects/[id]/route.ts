import { NextResponse } from "next/server";
import { type InValue } from "@libsql/client";
import { db, initializeSchema } from "@/lib/db";
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
import { requireAuth } from "@/lib/auth/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { id } = await params;

    const projectResult = await db.execute({
      sql: "SELECT * FROM projects WHERE (id = ? OR slug = ?) AND user_id = ?",
      args: [id, id, session.user.id],
    });

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectFromRow(projectResult.rows[0] as unknown as ProjectRow);

    // Fetch pages
    const pageResult = await db.execute({
      sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
      args: [project.id],
    });

    const pagesWithSections = await Promise.all(
      pageResult.rows.map(async (pageRow) => {
        const page = pageFromRow(pageRow as unknown as PageRow);

        const sectionResult = await db.execute({
          sql: "SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order",
          args: [page.id],
        });

        const sectionsWithScreenshots = await Promise.all(
          sectionResult.rows.map(async (sectionRow) => {
            const section = sectionFromRow(sectionRow as unknown as SectionRow);

            const screenshotResult = await db.execute({
              sql: "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order",
              args: [section.id],
            });

            const screenshotsWithVotes = await Promise.all(
              screenshotResult.rows.map(async (screenshotRow) => {
                const screenshot = screenshotFromRow(screenshotRow as unknown as ScreenshotRow);

                const voteResult = await db.execute({
                  sql: "SELECT * FROM votes WHERE screenshot_id = ?",
                  args: [screenshot.id],
                });

                const votes = voteResult.rows.map((v) => voteFromRow(v as unknown as VoteRow));

                const votesSummary = {
                  yes: votes.filter((v) => v.vote === "yes").length,
                  mid: votes.filter((v) => v.vote === "mid").length,
                  no: votes.filter((v) => v.vote === "no").length,
                };

                return { ...screenshot, votes, votesSummary };
              })
            );

            return { ...section, screenshots: screenshotsWithVotes };
          })
        );

        return { ...page, sections: sectionsWithScreenshots };
      })
    );

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
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { id } = await params;
    const body = await request.json();
    const result = updateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ? AND user_id = ?",
      args: [id, session.user.id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updates = result.data;
    const fields: string[] = [];
    const values: InValue[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      const existingSlug = await db.execute({
        sql: "SELECT id FROM projects WHERE slug = ? AND id != ?",
        args: [updates.slug, id],
      });
      if (existingSlug.rows.length > 0) {
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

      await db.execute({
        sql: `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`,
        args: values,
      });
    }

    const row = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(projectFromRow(row.rows[0] as unknown as ProjectRow));
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { id } = await params;

    const existing = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ? AND user_id = ?",
      args: [id, session.user.id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete in correct order due to foreign keys
    await db.execute({
      sql: `DELETE FROM votes WHERE screenshot_id IN (
        SELECT s.id FROM screenshots s
        JOIN sections sec ON s.section_id = sec.id
        JOIN pages p ON sec.page_id = p.id
        WHERE p.project_id = ?
      )`,
      args: [id],
    });
    await db.execute({
      sql: `DELETE FROM screenshots WHERE section_id IN (
        SELECT sec.id FROM sections sec
        JOIN pages p ON sec.page_id = p.id
        WHERE p.project_id = ?
      )`,
      args: [id],
    });
    await db.execute({
      sql: `DELETE FROM sections WHERE page_id IN (
        SELECT id FROM pages WHERE project_id = ?
      )`,
      args: [id],
    });
    await db.execute({
      sql: "DELETE FROM pages WHERE project_id = ?",
      args: [id],
    });
    await db.execute({
      sql: "DELETE FROM projects WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
