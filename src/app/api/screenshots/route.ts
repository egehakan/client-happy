import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createScreenshotSchema } from "@/lib/validators";
import { type ScreenshotRow, screenshotFromRow } from "@/types";
import { requireAuth, userOwnsSection, userOwnsPage } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const pageId = searchParams.get("pageId");

    if (!sectionId && !pageId) {
      return NextResponse.json(
        { error: "sectionId or pageId is required" },
        { status: 400 }
      );
    }

    if (sectionId) {
      // Verify user owns the section
      if (!(await userOwnsSection(session.user.id, sectionId))) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }

      const result = await db.execute({
        sql: "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order, created_at",
        args: [sectionId],
      });
      const screenshots = result.rows.map((row) => screenshotFromRow(row as unknown as ScreenshotRow));
      return NextResponse.json(screenshots);
    } else if (pageId) {
      // Verify user owns the page
      if (!(await userOwnsPage(session.user.id, pageId))) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      const result = await db.execute({
        sql: "SELECT * FROM screenshots WHERE page_id = ? AND section_id IS NULL ORDER BY sort_order, created_at",
        args: [pageId],
      });
      const screenshots = result.rows.map((row) => screenshotFromRow(row as unknown as ScreenshotRow));
      return NextResponse.json(screenshots);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("Failed to fetch screenshots:", err);
    return NextResponse.json(
      { error: "Failed to fetch screenshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const body = await request.json();
    const result = createScreenshotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { sectionId, pageId, title, description, sourceType, filePath, externalUrl } =
      result.data;
    const id = nanoid();

    // Verify ownership based on whether it's a section or page screenshot
    if (sectionId) {
      if (!(await userOwnsSection(session.user.id, sectionId))) {
        return NextResponse.json(
          { error: "Section not found" },
          { status: 404 }
        );
      }
    } else if (pageId) {
      if (!(await userOwnsPage(session.user.id, pageId))) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404 }
        );
      }
    }

    // Get next sort order based on parent (section or page)
    let maxOrder = -1;
    if (sectionId) {
      const maxOrderResult = await db.execute({
        sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE section_id = ?",
        args: [sectionId],
      });
      maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;
    } else if (pageId) {
      const maxOrderResult = await db.execute({
        sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM screenshots WHERE page_id = ? AND section_id IS NULL",
        args: [pageId],
      });
      maxOrder = (maxOrderResult.rows[0] as unknown as { max_order: number }).max_order;
    }

    await db.execute({
      sql: `INSERT INTO screenshots (id, section_id, page_id, title, description, source_type, file_path, external_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        sectionId ?? null,
        pageId ?? null,
        title ?? null,
        description ?? null,
        sourceType,
        filePath ?? null,
        externalUrl ?? null,
        maxOrder + 1,
      ],
    });

    const row = await db.execute({
      sql: "SELECT * FROM screenshots WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(screenshotFromRow(row.rows[0] as unknown as ScreenshotRow), { status: 201 });
  } catch (err) {
    console.error("Failed to create screenshot:", err);
    return NextResponse.json(
      { error: "Failed to create screenshot" },
      { status: 500 }
    );
  }
}
