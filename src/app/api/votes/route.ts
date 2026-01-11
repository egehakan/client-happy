import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createVoteSchema, submitVotesSchema } from "@/lib/validators";
import { type VoteRow, voteFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const screenshotId = searchParams.get("screenshotId");
    const projectId = searchParams.get("projectId");

    const db = getDb();

    if (screenshotId) {
      const rows = db
        .prepare(
          "SELECT * FROM votes WHERE screenshot_id = ? ORDER BY created_at DESC"
        )
        .all(screenshotId) as VoteRow[];
      return NextResponse.json(rows.map(voteFromRow));
    }

    if (projectId) {
      // Get all votes for a project (join through sections -> pages -> project)
      const rows = db
        .prepare(`
          SELECT v.* FROM votes v
          JOIN screenshots s ON v.screenshot_id = s.id
          JOIN sections sec ON s.section_id = sec.id
          JOIN pages p ON sec.page_id = p.id
          WHERE p.project_id = ?
          ORDER BY v.created_at DESC
        `)
        .all(projectId) as VoteRow[];
      return NextResponse.json(rows.map(voteFromRow));
    }

    // Return all votes (for admin overview)
    const rows = db
      .prepare("SELECT * FROM votes ORDER BY created_at DESC LIMIT 100")
      .all() as VoteRow[];
    return NextResponse.json(rows.map(voteFromRow));
  } catch (error) {
    console.error("Failed to fetch votes:", error);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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
      const db = getDb();

      const insertStmt = db.prepare(`
        INSERT INTO votes (id, screenshot_id, vote, comment, voter_identifier)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((votesToInsert) => {
        const insertedVotes: VoteRow[] = [];
        for (const v of votesToInsert) {
          const id = nanoid();
          insertStmt.run(
            id,
            v.screenshotId,
            v.vote,
            v.comment ?? null,
            voterIdentifier ?? null
          );
          const row = db
            .prepare("SELECT * FROM votes WHERE id = ?")
            .get(id) as VoteRow;
          insertedVotes.push(row);
        }
        return insertedVotes;
      });

      const insertedRows = insertMany(votes);
      return NextResponse.json(insertedRows.map(voteFromRow), { status: 201 });
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

    const db = getDb();

    // Verify screenshot exists
    const screenshot = db
      .prepare("SELECT id FROM screenshots WHERE id = ?")
      .get(screenshotId);
    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    const stmt = db.prepare(`
      INSERT INTO votes (id, screenshot_id, vote, comment, voter_identifier)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, screenshotId, vote, comment ?? null, voterIdentifier ?? null);

    const row = db
      .prepare("SELECT * FROM votes WHERE id = ?")
      .get(id) as VoteRow;
    return NextResponse.json(voteFromRow(row), { status: 201 });
  } catch (error) {
    console.error("Failed to create vote:", error);
    return NextResponse.json(
      { error: "Failed to create vote" },
      { status: 500 }
    );
  }
}
