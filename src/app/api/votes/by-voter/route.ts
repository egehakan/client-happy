import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { type VoteRow, voteFromRow } from "@/types";

export async function GET(request: Request) {
  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const voterIdentifier = searchParams.get("voterIdentifier");
    const screenshotIds = searchParams.get("screenshotIds");

    if (!voterIdentifier || !screenshotIds) {
      return NextResponse.json(
        { error: "voterIdentifier and screenshotIds are required" },
        { status: 400 }
      );
    }

    const ids = screenshotIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    // Build placeholders for the IN clause
    const placeholders = ids.map(() => "?").join(", ");

    const result = await db.execute({
      sql: `SELECT * FROM votes WHERE voter_identifier = ? AND screenshot_id IN (${placeholders})`,
      args: [voterIdentifier, ...ids],
    });

    return NextResponse.json(
      result.rows.map((row) => voteFromRow(row as unknown as VoteRow))
    );
  } catch (err) {
    console.error("Failed to fetch votes by voter:", err);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 }
    );
  }
}
