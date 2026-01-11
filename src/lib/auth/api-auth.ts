import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function getSession() {
  return await auth();
}

// Check if user owns a project
export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT id FROM projects WHERE id = ? AND user_id = ?",
    args: [projectId, userId],
  });
  return result.rows.length > 0;
}

// Check if user owns a page (through project)
export async function userOwnsPage(userId: string, pageId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT p.id FROM pages p
          JOIN projects pr ON p.project_id = pr.id
          WHERE p.id = ? AND pr.user_id = ?`,
    args: [pageId, userId],
  });
  return result.rows.length > 0;
}

// Check if user owns a section (through project)
export async function userOwnsSection(userId: string, sectionId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT s.id FROM sections s
          JOIN pages p ON s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE s.id = ? AND pr.user_id = ?`,
    args: [sectionId, userId],
  });
  return result.rows.length > 0;
}

// Check if user owns a screenshot (through project)
export async function userOwnsScreenshot(userId: string, screenshotId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT sc.id FROM screenshots sc
          JOIN sections s ON sc.section_id = s.id
          JOIN pages p ON s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE sc.id = ? AND pr.user_id = ?`,
    args: [screenshotId, userId],
  });
  return result.rows.length > 0;
}
