import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { type VoteRow, voteFromRow } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db
      .prepare("SELECT * FROM votes WHERE id = ?")
      .get(id) as VoteRow | undefined;

    if (!row) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    return NextResponse.json(voteFromRow(row));
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
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT * FROM votes WHERE id = ?")
      .get(id) as VoteRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM votes WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vote:", error);
    return NextResponse.json(
      { error: "Failed to delete vote" },
      { status: 500 }
    );
  }
}
