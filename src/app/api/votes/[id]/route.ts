import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { type VoteRow, voteFromRow } from "@/types";
import { requireAuth } from "@/lib/auth/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check if user owns a vote (through screenshot -> section -> page -> project)
async function userOwnsVote(userId: string, voteId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT v.id FROM votes v
          JOIN screenshots sc ON v.screenshot_id = sc.id
          JOIN sections s ON sc.section_id = s.id
          JOIN pages p ON s.page_id = p.id
          JOIN projects pr ON p.project_id = pr.id
          WHERE v.id = ? AND pr.user_id = ?`,
    args: [voteId, userId],
  });
  return result.rows.length > 0;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    await initializeSchema();
    const { id } = await params;

    // Verify user owns the vote
    if (!(await userOwnsVote(session.user.id, id))) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM votes WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    return NextResponse.json(voteFromRow(result.rows[0] as unknown as VoteRow));
  } catch (err) {
    console.error("Failed to fetch vote:", err);
    return NextResponse.json(
      { error: "Failed to fetch vote" },
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

    // Verify user owns the vote
    if (!(await userOwnsVote(session.user.id, id))) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const existing = await db.execute({
      sql: "SELECT * FROM votes WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    await db.execute({
      sql: "DELETE FROM votes WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete vote:", err);
    return NextResponse.json(
      { error: "Failed to delete vote" },
      { status: 500 }
    );
  }
}
