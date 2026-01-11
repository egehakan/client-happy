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

      // Delete existing response for this email + question (upsert behavior)
      await db.execute({
        sql: "DELETE FROM question_responses WHERE question_id = ? AND respondent_email = ?",
        args: [response.questionId, respondentEmail],
      });

      // Insert new response
      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO question_responses (id, question_id, respondent_email, value, file_path)
              VALUES (?, ?, ?, ?, ?)`,
        args: [id, response.questionId, respondentEmail, response.value ?? null, response.filePath ?? null],
      });

      const row = await db.execute({
        sql: "SELECT * FROM question_responses WHERE id = ?",
        args: [id],
      });
      insertedResponses.push(row.rows[0] as unknown as QuestionResponseRow);
    }

    return NextResponse.json(insertedResponses.map(questionResponseFromRow), { status: 201 });
  } catch (err) {
    console.error("Failed to submit questionnaire:", err);
    return NextResponse.json({ error: "Failed to submit questionnaire" }, { status: 500 });
  }
}
