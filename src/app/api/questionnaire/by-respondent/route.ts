import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";
import { type QuestionResponseRow, questionResponseFromRow } from "@/types";

// GET - Fetch existing responses for a respondent (public, for pre-populating form)
export async function GET(request: Request) {
  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const respondentEmail = searchParams.get("respondentEmail");
    const questionIds = searchParams.get("questionIds");

    if (!respondentEmail) {
      return NextResponse.json({ error: "respondentEmail is required" }, { status: 400 });
    }

    let sql = "SELECT * FROM question_responses WHERE respondent_email = ?";
    const args: string[] = [respondentEmail];

    if (questionIds) {
      const ids = questionIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        sql += ` AND question_id IN (${placeholders})`;
        args.push(...ids);
      }
    }

    const result = await db.execute({ sql, args });

    return NextResponse.json(result.rows.map((row) => questionResponseFromRow(row as unknown as QuestionResponseRow)));
  } catch (err) {
    console.error("Failed to fetch responses:", err);
    return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 });
  }
}
