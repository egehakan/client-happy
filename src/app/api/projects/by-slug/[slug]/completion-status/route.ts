import { NextRequest, NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET - Get completion status for a voter email
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await initializeSchema();

    // Get project by slug
    const projectResult = await db.execute({
      sql: "SELECT id FROM projects WHERE slug = ?",
      args: [slug],
    });

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectId = projectResult.rows[0].id as string;

    // Get total screenshots count
    const screenshotsResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM screenshots s
            JOIN sections sec ON s.section_id = sec.id
            JOIN pages p ON sec.page_id = p.id
            WHERE p.project_id = ?`,
      args: [projectId],
    });
    const totalScreenshots = Number(screenshotsResult.rows[0]?.count || 0);

    // Get user's vote count and last vote time
    const votesResult = await db.execute({
      sql: `SELECT COUNT(*) as count, MAX(v.created_at) as last_vote
            FROM votes v
            JOIN screenshots s ON v.screenshot_id = s.id
            JOIN sections sec ON s.section_id = sec.id
            JOIN pages p ON sec.page_id = p.id
            WHERE p.project_id = ? AND v.voter_identifier = ?`,
      args: [projectId, email],
    });
    const userVoteCount = Number(votesResult.rows[0]?.count || 0);
    const lastVoteTime = votesResult.rows[0]?.last_vote as string | null;

    // Get total REQUIRED questions count (completion is based on required fields only)
    const questionsResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM questions WHERE project_id = ? AND is_required = 1",
      args: [projectId],
    });
    const totalRequiredQuestions = Number(questionsResult.rows[0]?.count || 0);

    // Get user's response count for REQUIRED questions and last response time
    const responsesResult = await db.execute({
      sql: `SELECT COUNT(*) as count, MAX(qr.updated_at) as last_response
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE q.project_id = ? AND qr.respondent_email = ? AND q.is_required = 1 AND qr.value IS NOT NULL AND qr.value != ''`,
      args: [projectId, email],
    });
    const userRequiredResponseCount = Number(responsesResult.rows[0]?.count || 0);

    // Get last response time from any response (for new content detection)
    const lastResponseResult = await db.execute({
      sql: `SELECT MAX(qr.updated_at) as last_response
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE q.project_id = ? AND qr.respondent_email = ?`,
      args: [projectId, email],
    });
    const lastResponseTime = lastResponseResult.rows[0]?.last_response as string | null;

    // Check for new screenshots since last vote (if user has voted at all)
    let hasNewScreenshots = false;
    let newScreenshotCount = 0;
    if (lastVoteTime && userVoteCount > 0) {
      const newScreenshotsResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM screenshots s
              JOIN sections sec ON s.section_id = sec.id
              JOIN pages p ON sec.page_id = p.id
              WHERE p.project_id = ? AND s.created_at > ?`,
        args: [projectId, lastVoteTime],
      });
      newScreenshotCount = Number(newScreenshotsResult.rows[0]?.count || 0);
      hasNewScreenshots = newScreenshotCount > 0;
    }

    // Check for new questions since last response (ANY new questions, not just required)
    let hasNewQuestions = false;
    let newRequiredQuestionCount = 0;
    if (lastResponseTime) {
      // Check for any new questions (for the "New Questions" badge)
      const anyNewQuestionsResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM questions
              WHERE project_id = ? AND created_at > ?`,
        args: [projectId, lastResponseTime],
      });
      hasNewQuestions = Number(anyNewQuestionsResult.rows[0]?.count || 0) > 0;

      // Check for new REQUIRED questions (for recalculating completion status)
      if (userRequiredResponseCount > 0) {
        const newRequiredQuestionsResult = await db.execute({
          sql: `SELECT COUNT(*) as count FROM questions
                WHERE project_id = ? AND is_required = 1 AND created_at > ?`,
          args: [projectId, lastResponseTime],
        });
        newRequiredQuestionCount = Number(newRequiredQuestionsResult.rows[0]?.count || 0);
      }
    }

    // Determine completion status
    // User completed voting if they have submitted at least one vote
    const votingCompleted = userVoteCount > 0;

    // User completed questionnaire if they answered ALL current required questions
    const questionnaireCompleted = totalRequiredQuestions > 0 && userRequiredResponseCount >= totalRequiredQuestions;

    return NextResponse.json({
      voting: {
        completed: votingCompleted,
        hasNewContent: hasNewScreenshots,
        totalItems: totalScreenshots,
        completedItems: userVoteCount,
      },
      questionnaire: {
        completed: questionnaireCompleted,
        hasNewContent: hasNewQuestions,
        totalItems: totalRequiredQuestions,
        completedItems: userRequiredResponseCount,
      },
    });
  } catch (error) {
    console.error("Failed to get completion status:", error);
    return NextResponse.json(
      { error: "Failed to get completion status" },
      { status: 500 }
    );
  }
}
