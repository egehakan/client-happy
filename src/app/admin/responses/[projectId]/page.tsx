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

  // Get pages for this project
  const pageResult = await db.execute({
    sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
    args: [project.id],
  });
  const pageRows = pageResult.rows as unknown as PageRow[];

  const pages: PageWithSections[] = [];
  let totalVotes = 0;
  const voteEmails = new Set<string>();

  for (const pageRow of pageRows) {
    const page = pageFromRow(pageRow);

    // Get sections for this page
    const sectionResult = await db.execute({
      sql: "SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order",
      args: [page.id],
    });
    const sectionRows = sectionResult.rows as unknown as SectionRow[];

    const sections: SectionWithScreenshots[] = [];

    for (const sectionRow of sectionRows) {
      const section = sectionFromRow(sectionRow);

      // Get screenshots for this section
      const screenshotResult = await db.execute({
        sql: "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order",
        args: [section.id],
      });
      const screenshotRows = screenshotResult.rows as unknown as ScreenshotRow[];

      const screenshots: ScreenshotWithVotes[] = [];

      for (const screenshotRow of screenshotRows) {
        const screenshot = screenshotFromRow(screenshotRow);

        // Get votes for this screenshot
        const voteResult = await db.execute({
          sql: "SELECT * FROM votes WHERE screenshot_id = ? ORDER BY created_at DESC",
          args: [screenshot.id],
        });
        const voteRows = voteResult.rows as unknown as VoteRow[];

        const votes = voteRows.map(voteFromRow);
        totalVotes += votes.length;

        // Collect unique voter emails
        votes.forEach(v => {
          if (v.voterIdentifier) voteEmails.add(v.voterIdentifier);
        });

        const summary = {
          yes: votes.filter((v) => v.vote === "yes").length,
          mid: votes.filter((v) => v.vote === "mid").length,
          no: votes.filter((v) => v.vote === "no").length,
          total: votes.length,
        };

        screenshots.push({ screenshot, votes, summary });
      }

      if (screenshots.length > 0) {
        sections.push({ section, screenshots });
      }
    }

    // Get page-level screenshots (screenshots directly on the page, not in a section)
    const pageScreenshotsResult = await db.execute({
      sql: "SELECT * FROM screenshots WHERE page_id = ? AND section_id IS NULL ORDER BY sort_order",
      args: [page.id],
    });
    const pageScreenshotRows = pageScreenshotsResult.rows as unknown as ScreenshotRow[];

    const pageScreenshots: ScreenshotWithVotes[] = [];

    for (const screenshotRow of pageScreenshotRows) {
      const screenshot = screenshotFromRow(screenshotRow);

      // Get votes for this screenshot
      const voteResult = await db.execute({
        sql: "SELECT * FROM votes WHERE screenshot_id = ? ORDER BY created_at DESC",
        args: [screenshot.id],
      });
      const voteRows = voteResult.rows as unknown as VoteRow[];

      const votes = voteRows.map(voteFromRow);
      totalVotes += votes.length;

      // Collect unique voter emails
      votes.forEach(v => {
        if (v.voterIdentifier) voteEmails.add(v.voterIdentifier);
      });

      const summary = {
        yes: votes.filter((v) => v.vote === "yes").length,
        mid: votes.filter((v) => v.vote === "mid").length,
        no: votes.filter((v) => v.vote === "no").length,
        total: votes.length,
      };

      pageScreenshots.push({ screenshot, votes, summary });
    }

    if (sections.length > 0 || pageScreenshots.length > 0) {
      pages.push({ page, sections, pageScreenshots });
    }
  }

  // Get questions with responses
  const questionsResult = await db.execute({
    sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order",
    args: [projectId],
  });
  const questionRows = questionsResult.rows as unknown as QuestionRow[];

  // Get question groups
  const questionGroupsResult = await db.execute({
    sql: "SELECT * FROM question_groups WHERE project_id = ? ORDER BY sort_order",
    args: [projectId],
  });
  const questionGroups = questionGroupsResult.rows.map((row) =>
    questionGroupFromRow(row as unknown as QuestionGroupRow)
  );

  // Build page and section maps for scope names
  const pageMap = new Map<string, string>();
  const sectionMap = new Map<string, { name: string; pageName: string }>();

  const allPagesResult = await db.execute({
    sql: "SELECT * FROM pages WHERE project_id = ?",
    args: [projectId],
  });
  for (const row of allPagesResult.rows) {
    const page = pageFromRow(row as unknown as PageRow);
    pageMap.set(page.id, page.name);
  }

  const allSectionsResult = await db.execute({
    sql: `SELECT s.*, p.name as page_name FROM sections s
          JOIN pages p ON s.page_id = p.id
          WHERE p.project_id = ?`,
    args: [projectId],
  });
  for (const row of allSectionsResult.rows) {
    const section = sectionFromRow(row as unknown as SectionRow);
    sectionMap.set(section.id, {
      name: section.name,
      pageName: (row as unknown as { page_name: string }).page_name,
    });
  }

  const respondentEmails = new Set<string>();

  const questionsWithResponses: QuestionWithResponses[] = await Promise.all(
    questionRows.map(async (questionRow) => {
      const question = questionFromRow(questionRow);

      const responsesResult = await db.execute({
        sql: "SELECT * FROM question_responses WHERE question_id = ? ORDER BY updated_at DESC",
        args: [question.id],
      });
      const responses = responsesResult.rows.map((r) =>
        questionResponseFromRow(r as unknown as QuestionResponseRow)
      );

      // Collect unique respondent emails
      responses.forEach(r => respondentEmails.add(r.respondentEmail));

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
    })
  );

  // Get unique respondents count
  const totalRespondents = respondentEmails.size;

  // Combine all unique emails from votes and questionnaire
  const allEmails = new Set([...voteEmails, ...respondentEmails]);
  const uniqueEmails = Array.from(allEmails).sort();

  // Get all pages sorted for hierarchical display
  const allPagesSorted = pageRows.map((row) => pageFromRow(row)).sort((a, b) => a.sortOrder - b.sortOrder);

  // Get all sections sorted
  const sectionsSortedResult = await db.execute({
    sql: `SELECT s.* FROM sections s
          JOIN pages p ON s.page_id = p.id
          WHERE p.project_id = ?
          ORDER BY s.sort_order`,
    args: [projectId],
  });
  const allSectionsSorted = sectionsSortedResult.rows
    .map((row) => sectionFromRow(row as unknown as SectionRow))
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
