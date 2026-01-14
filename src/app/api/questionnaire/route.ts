import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { submitQuestionnaireSchema } from "@/lib/validators";
import { type QuestionResponseRow, questionResponseFromRow } from "@/types";

// POST - Submit questionnaire responses (public, no auth required - like voting)
export async function POST(request: Request) {
  try {
    await initializeSchema();
    const body = await request.json();
    const result = submitQuestionnaireSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { responses, respondentEmail } = result.data;
    const insertedResponses: QuestionResponseRow[] = [];

    for (const response of responses) {
      // Verify question exists
      const questionExists = await db.execute({
        sql: "SELECT id FROM questions WHERE id = ?",
        args: [response.questionId],
      });

      if (questionExists.rows.length === 0) {
        continue; // Skip invalid question IDs
      }

      // Upsert response (atomic operation to handle concurrent saves)
      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO question_responses (id, question_id, respondent_email, value, file_path)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (question_id, respondent_email)
              DO UPDATE SET value = excluded.value, file_path = excluded.file_path, updated_at = CURRENT_TIMESTAMP`,
        args: [id, response.questionId, respondentEmail, response.value ?? null, response.filePath ?? null],
      });

      const row = await db.execute({
        sql: "SELECT * FROM question_responses WHERE question_id = ? AND respondent_email = ?",
        args: [response.questionId, respondentEmail],
      });
      if (row.rows[0]) {
        insertedResponses.push(row.rows[0] as unknown as QuestionResponseRow);
      }
    }

    return NextResponse.json(
      insertedResponses.filter(Boolean).map(questionResponseFromRow),
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to submit questionnaire:", err);
    return NextResponse.json({ error: "Failed to submit questionnaire" }, { status: 500 });
  }
}
