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

// Check if user owns a screenshot (through project - via section or direct page attachment)
export async function userOwnsScreenshot(userId: string, screenshotId: string): Promise<boolean> {
  // Check for screenshots attached to sections
  const sectionResult = await db.execute({
    sql: `SELECT sc.id FROM screenshots sc
          JOIN sections s ON sc.section_id = s.id
          JOIN pages p ON s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE sc.id = ? AND pr.user_id = ?`,
    args: [screenshotId, userId],
  });
  if (sectionResult.rows.length > 0) return true;

  // Check for screenshots attached directly to pages
  const pageResult = await db.execute({
    sql: `SELECT sc.id FROM screenshots sc
          JOIN pages p ON sc.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE sc.id = ? AND sc.section_id IS NULL AND pr.user_id = ?`,
    args: [screenshotId, userId],
  });
  return pageResult.rows.length > 0;
}

// Check if user owns a question (through project)
export async function userOwnsQuestion(userId: string, questionId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT q.id FROM questions q
          JOIN projects p ON q.project_id = p.id
          WHERE q.id = ? AND p.user_id = ?`,
    args: [questionId, userId],
  });
  return result.rows.length > 0;
}

// Check if user owns a question group (through project)
export async function userOwnsQuestionGroup(userId: string, groupId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT qg.id FROM question_groups qg
          JOIN projects p ON qg.project_id = p.id
          WHERE qg.id = ? AND p.user_id = ?`,
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

// BATCH OWNERSHIP CHECKS - Optimized for bulk operations

// Check if user owns all screenshots (single query for multiple IDs)
export async function userOwnsAllScreenshots(userId: string, screenshotIds: string[]): Promise<boolean> {
  if (screenshotIds.length === 0) return true;

  const placeholders = screenshotIds.map(() => "?").join(", ");

  // Single query that checks both section-attached and page-attached screenshots
  const result = await db.execute({
    sql: `SELECT sc.id FROM screenshots sc
          LEFT JOIN sections s ON sc.section_id = s.id
          LEFT JOIN pages p ON sc.page_id = p.id OR s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE sc.id IN (${placeholders}) AND pr.user_id = ?`,
    args: [...screenshotIds, userId],
  });

  return result.rows.length === screenshotIds.length;
}

// Check if user owns all pages (single query for multiple IDs)
export async function userOwnsAllPages(userId: string, pageIds: string[]): Promise<boolean> {
  if (pageIds.length === 0) return true;

  const placeholders = pageIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT p.id FROM pages p
          JOIN projects pr ON p.project_id = pr.id
          WHERE p.id IN (${placeholders}) AND pr.user_id = ?`,
    args: [...pageIds, userId],
  });

  return result.rows.length === pageIds.length;
}

// Check if user owns all sections (single query for multiple IDs)
export async function userOwnsAllSections(userId: string, sectionIds: string[]): Promise<boolean> {
  if (sectionIds.length === 0) return true;

  const placeholders = sectionIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT s.id FROM sections s
          JOIN pages p ON s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE s.id IN (${placeholders}) AND pr.user_id = ?`,
    args: [...sectionIds, userId],
  });

  return result.rows.length === sectionIds.length;
}

// Check if user owns all questions (single query for multiple IDs)
export async function userOwnsAllQuestions(userId: string, questionIds: string[]): Promise<boolean> {
  if (questionIds.length === 0) return true;

  const placeholders = questionIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT q.id FROM questions q
          JOIN projects p ON q.project_id = p.id
          WHERE q.id IN (${placeholders}) AND p.user_id = ?`,
    args: [...questionIds, userId],
  });

  return result.rows.length === questionIds.length;
}

// Check if user owns all question groups (single query for multiple IDs)
export async function userOwnsAllQuestionGroups(userId: string, groupIds: string[]): Promise<boolean> {
  if (groupIds.length === 0) return true;

  const placeholders = groupIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT qg.id FROM question_groups qg
          JOIN projects p ON qg.project_id = p.id
          WHERE qg.id IN (${placeholders}) AND p.user_id = ?`,
    args: [...groupIds, userId],
  });

  return result.rows.length === groupIds.length;
}
