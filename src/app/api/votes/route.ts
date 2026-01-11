import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { createVoteSchema, submitVotesSchema } from "@/lib/validators";
import { type VoteRow, voteFromRow } from "@/types";
import { requireAuth, userOwnsProject, userOwnsScreenshot } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  // GET requires auth to view vote analytics
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const screenshotId = searchParams.get("screenshotId");
    const projectId = searchParams.get("projectId");

    if (screenshotId) {
      // Verify user owns the screenshot
      if (!(await userOwnsScreenshot(session.user.id, screenshotId))) {
        return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
      }
      const result = await db.execute({
        sql: "SELECT * FROM votes WHERE screenshot_id = ? ORDER BY created_at DESC",
        args: [screenshotId],
      });
      return NextResponse.json(result.rows.map((row) => voteFromRow(row as unknown as VoteRow)));
    }

    if (projectId) {
      // Verify user owns the project
      if (!(await userOwnsProject(session.user.id, projectId))) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      // Get all votes for a project (join through sections -> pages -> project)
      const result = await db.execute({
        sql: `
          SELECT v.* FROM votes v
          JOIN screenshots s ON v.screenshot_id = s.id
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
          ORDER BY v.created_at DESC
        `,
        args: [projectId],
      });
      return NextResponse.json(result.rows.map((row) => voteFromRow(row as unknown as VoteRow)));
    }

    // Return votes for user's projects only
    const result = await db.execute({
      sql: `
        SELECT v.* FROM votes v
        JOIN screenshots s ON v.screenshot_id = s.id
        JOIN sections sec ON s.section_id = sec.id
        JOIN pages p ON sec.page_id = p.id
        JOIN projects pr ON p.project_id = pr.id
        WHERE pr.user_id = ?
        ORDER BY v.created_at DESC
        LIMIT 100
      `,
      args: [session.user.id],
    });
    return NextResponse.json(result.rows.map((row) => voteFromRow(row as unknown as VoteRow)));
  } catch (err) {
    console.error("Failed to fetch votes:", err);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initializeSchema();
    const body = await request.json();

    // Check if it's a bulk submission
    if (body.votes && Array.isArray(body.votes)) {
      const result = submitVotesSchema.safeParse(body);

      if (!result.success) {
        return NextResponse.json(
          { error: "Validation failed", details: result.error.flatten() },
          { status: 400 }
        );
      }

      const { votes, voterIdentifier } = result.data;
      const insertedVotes: VoteRow[] = [];

      // Insert votes one by one (Turso doesn't support transactions the same way)
      for (const v of votes) {
        const id = nanoid();
        await db.execute({
          sql: `INSERT INTO votes (id, screenshot_id, vote, comment, voter_identifier) VALUES (?, ?, ?, ?, ?)`,
          args: [id, v.screenshotId, v.vote, v.comment ?? null, voterIdentifier ?? null],
        });

        const row = await db.execute({
          sql: "SELECT * FROM votes WHERE id = ?",
          args: [id],
        });
        insertedVotes.push(row.rows[0] as unknown as VoteRow);
      }

      return NextResponse.json(insertedVotes.map(voteFromRow), { status: 201 });
    }

    // Single vote
    const result = createVoteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { screenshotId, vote, comment, voterIdentifier } = result.data;
    const id = nanoid();

    // Verify screenshot exists
    const screenshot = await db.execute({
      sql: "SELECT id FROM screenshots WHERE id = ?",
      args: [screenshotId],
    });
    if (screenshot.rows.length === 0) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `INSERT INTO votes (id, screenshot_id, vote, comment, voter_identifier) VALUES (?, ?, ?, ?, ?)`,
      args: [id, screenshotId, vote, comment ?? null, voterIdentifier ?? null],
    });

    const row = await db.execute({
      sql: "SELECT * FROM votes WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(voteFromRow(row.rows[0] as unknown as VoteRow), { status: 201 });
  } catch (error) {
    console.error("Failed to create vote:", error);
    return NextResponse.json(
      { error: "Failed to create vote" },
      { status: 500 }
    );
  }
}
