import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  type ProjectRow,
  type PageRow,
  type SectionRow,
  type ScreenshotRow,
  type VoteRow,
  type QuestionRow,
  type QuestionResponseRow,
  type QuestionGroupRow,
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  voteFromRow,
  questionFromRow,
  questionResponseFromRow,
  questionGroupFromRow,
} from "@/types";
import { ArrowLeft } from "lucide-react";
import { ResponsesFilter } from "@/components/admin/responses-filter";
import { Toaster } from "@/components/ui/sonner";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

interface ScreenshotWithVotes {
  screenshot: ReturnType<typeof screenshotFromRow>;
  votes: ReturnType<typeof voteFromRow>[];
  summary: { yes: number; mid: number; no: number; total: number };
}

interface SectionWithScreenshots {
  section: ReturnType<typeof sectionFromRow>;
  screenshots: ScreenshotWithVotes[];
}

interface PageWithSections {
  page: ReturnType<typeof pageFromRow>;
  sections: SectionWithScreenshots[];
  pageScreenshots: ScreenshotWithVotes[]; // Page-level screenshots (not in any section)
}

interface QuestionWithResponses {
  question: ReturnType<typeof questionFromRow>;
  responses: ReturnType<typeof questionResponseFromRow>[];
  scopeName: string;
}

async function getProjectResponseData(projectId: string, userId: string) {
  noStore();
  await initializeSchema();

  // Get project and verify ownership
  const projectResult = await db.execute({
    sql: "SELECT * FROM projects WHERE id = ? AND user_id = ?",
    args: [projectId, userId],
  });

  if (projectResult.rows.length === 0) return null;

  const project = projectFromRow(projectResult.rows[0] as unknown as ProjectRow);

  // OPTIMIZED: Fetch all data in parallel with batch queries (instead of N+1 queries)
  const [
    pagesResult,
    sectionsResult,
    screenshotsResult,
    votesResult,
    questionsResult,
    questionGroupsResult,
    responsesResult,
  ] = await Promise.all([
    // Get all pages for this project
    db.execute({
      sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
      args: [projectId],
    }),
    // Get all sections for this project (with page info)
    db.execute({
      sql: `SELECT s.*, p.name as page_name FROM sections s
            JOIN pages p ON s.page_id = p.id
            WHERE p.project_id = ?
            ORDER BY s.sort_order`,
      args: [projectId],
    }),
    // Get all screenshots for this project
    db.execute({
      sql: `SELECT sc.* FROM screenshots sc
            LEFT JOIN sections s ON sc.section_id = s.id
            LEFT JOIN pages p ON sc.page_id = p.id OR s.page_id = p.id
            WHERE p.project_id = ?
            ORDER BY sc.sort_order`,
      args: [projectId],
    }),
    // Get all votes for all screenshots in this project (single query!)
    db.execute({
      sql: `SELECT v.* FROM votes v
            JOIN screenshots sc ON v.screenshot_id = sc.id
            LEFT JOIN sections s ON sc.section_id = s.id
            LEFT JOIN pages p ON sc.page_id = p.id OR s.page_id = p.id
            WHERE p.project_id = ?
            ORDER BY v.created_at DESC`,
      args: [projectId],
    }),
    // Get all questions
    db.execute({
      sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order",
      args: [projectId],
    }),
    // Get all question groups
    db.execute({
      sql: "SELECT * FROM question_groups WHERE project_id = ? ORDER BY sort_order",
      args: [projectId],
    }),
    // Get all responses for all questions in this project (single query!)
    db.execute({
      sql: `SELECT qr.* FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            WHERE q.project_id = ?
            ORDER BY qr.updated_at DESC`,
      args: [projectId],
    }),
  ]);

  // Process pages
  const pageRows = pagesResult.rows as unknown as PageRow[];
  const allPagesSorted = pageRows.map((row) => pageFromRow(row)).sort((a, b) => a.sortOrder - b.sortOrder);

  // Process sections and build maps
  const pageMap = new Map<string, string>();
  const sectionMap = new Map<string, { name: string; pageName: string }>();

  for (const row of pageRows) {
    const page = pageFromRow(row);
    pageMap.set(page.id, page.name);
  }

  const allSectionsSorted = sectionsResult.rows
    .map((row) => {
      const section = sectionFromRow(row as unknown as SectionRow);
      sectionMap.set(section.id, {
        name: section.name,
        pageName: (row as unknown as { page_name: string }).page_name,
      });
      return section;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Process screenshots
  const allScreenshots = screenshotsResult.rows.map((row) =>
    screenshotFromRow(row as unknown as ScreenshotRow)
  );

  // Build a map of screenshot ID -> votes (process votes once)
  const votesByScreenshot = new Map<string, ReturnType<typeof voteFromRow>[]>();
  const voteEmails = new Set<string>();
  let totalVotes = 0;

  for (const row of votesResult.rows) {
    const vote = voteFromRow(row as unknown as VoteRow);
    totalVotes++;
    if (vote.voterIdentifier) voteEmails.add(vote.voterIdentifier);

    const existing = votesByScreenshot.get(vote.screenshotId) || [];
    existing.push(vote);
    votesByScreenshot.set(vote.screenshotId, existing);
  }

  // Build screenshot data with votes
  function buildScreenshotWithVotes(screenshot: ReturnType<typeof screenshotFromRow>): ScreenshotWithVotes {
    const votes = votesByScreenshot.get(screenshot.id) || [];
    return {
      screenshot,
      votes,
      summary: {
        yes: votes.filter((v) => v.vote === "yes").length,
        mid: votes.filter((v) => v.vote === "mid").length,
        no: votes.filter((v) => v.vote === "no").length,
        total: votes.length,
      },
    };
  }

  // Group screenshots by section and page
  const screenshotsBySection = new Map<string, ScreenshotWithVotes[]>();
  const screenshotsByPage = new Map<string, ScreenshotWithVotes[]>(); // page-level (no section)

  for (const screenshot of allScreenshots) {
    const screenshotWithVotes = buildScreenshotWithVotes(screenshot);

    if (screenshot.sectionId) {
      const existing = screenshotsBySection.get(screenshot.sectionId) || [];
      existing.push(screenshotWithVotes);
      screenshotsBySection.set(screenshot.sectionId, existing);
    } else if (screenshot.pageId) {
      const existing = screenshotsByPage.get(screenshot.pageId) || [];
      existing.push(screenshotWithVotes);
      screenshotsByPage.set(screenshot.pageId, existing);
    }
  }

  // Build sections by page
  const sectionsByPage = new Map<string, SectionWithScreenshots[]>();
  for (const section of allSectionsSorted) {
    const screenshots = screenshotsBySection.get(section.id) || [];
    if (screenshots.length > 0) {
      const existing = sectionsByPage.get(section.pageId) || [];
      existing.push({ section, screenshots });
      sectionsByPage.set(section.pageId, existing);
    }
  }

  // Build pages with sections
  const pages: PageWithSections[] = [];
  for (const page of allPagesSorted) {
    const sections = sectionsByPage.get(page.id) || [];
    const pageScreenshots = screenshotsByPage.get(page.id) || [];

    if (sections.length > 0 || pageScreenshots.length > 0) {
      pages.push({ page, sections, pageScreenshots });
    }
  }

  // Process questions and responses
  const questionGroups = questionGroupsResult.rows.map((row) =>
    questionGroupFromRow(row as unknown as QuestionGroupRow)
  );

  // Build a map of question ID -> responses
  const responsesByQuestion = new Map<string, ReturnType<typeof questionResponseFromRow>[]>();
  const respondentEmails = new Set<string>();

  for (const row of responsesResult.rows) {
    const response = questionResponseFromRow(row as unknown as QuestionResponseRow);
    respondentEmails.add(response.respondentEmail);

    const existing = responsesByQuestion.get(response.questionId) || [];
    existing.push(response);
    responsesByQuestion.set(response.questionId, existing);
  }

  // Build questions with responses
  const questionsWithResponses: QuestionWithResponses[] = (questionsResult.rows as unknown as QuestionRow[])
    .map((questionRow) => {
      const question = questionFromRow(questionRow);
      const responses = responsesByQuestion.get(question.id) || [];

      let scopeName = "Website";
      if (question.scopeType === "page" && question.scopeId) {
        scopeName = pageMap.get(question.scopeId) || "Page";
      } else if (question.scopeType === "section" && question.scopeId) {
        const sectionInfo = sectionMap.get(question.scopeId);
        scopeName = sectionInfo
          ? `${sectionInfo.pageName} / ${sectionInfo.name}`
          : "Section";
      }

      return { question, responses, scopeName };
    });

  // Get unique respondents count
  const totalRespondents = respondentEmails.size;

  // Combine all unique emails from votes and questionnaire
  const allEmails = new Set([...voteEmails, ...respondentEmails]);
  const uniqueEmails = Array.from(allEmails).sort();

  return {
    project,
    pages,
    totalVotes,
    questionsWithResponses,
    totalRespondents,
    uniqueEmails,
    questionGroups,
    allPages: allPagesSorted,
    allSections: allSectionsSorted,
  };
}

export default async function ProjectResponsesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await params;
  const data = await getProjectResponseData(projectId, session.user.id);

  if (!data) notFound();

  const {
    project,
    pages,
    totalVotes,
    questionsWithResponses,
    totalRespondents,
    uniqueEmails,
    questionGroups,
    allPages,
    allSections,
  } = data;

  return (
    <div>
      <Toaster />
      <div className="mb-6 sm:mb-8">
        <Link
          href="/admin/responses"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Responses
        </Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{project.name}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          View all responses for this project
        </p>
      </div>

      <ResponsesFilter
        project={project}
        pages={pages}
        totalVotes={totalVotes}
        questionsWithResponses={questionsWithResponses}
        totalRespondents={totalRespondents}
        uniqueEmails={uniqueEmails}
        questionGroups={questionGroups}
        allPages={allPages}
        allSections={allSections}
      />
    </div>
  );
}
