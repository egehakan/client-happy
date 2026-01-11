import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { type VoteRow, voteFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await initializeSchema();
    const { id } = await params;

    const result = await db.execute({
      sql: "SELECT * FROM votes WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    return NextResponse.json(voteFromRow(result.rows[0] as unknown as VoteRow));
  } catch (error) {
    console.error("Failed to fetch vote:", error);
    return NextResponse.json(
      { error: "Failed to fetch vote" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await initializeSchema();
    const { id } = await params;

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
  } catch (error) {
    console.error("Failed to delete vote:", error);
    return NextResponse.json(
      { error: "Failed to delete vote" },
      { status: 500 }
    );
  }
}
