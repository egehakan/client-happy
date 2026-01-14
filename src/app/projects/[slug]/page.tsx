import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import {
  type ProjectRow,
  type PageRow,
  type SectionRow,
  type ScreenshotRow,
  type QuestionRow,
  type QuestionGroupRow,
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  questionFromRow,
  questionGroupFromRow,
} from "@/types";
import { VotingInterface } from "@/components/client/voting-interface";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProjectBySlug(slug: string) {
  noStore();
  await initializeSchema();

  const projectResult = await db.execute({
    sql: "SELECT * FROM projects WHERE slug = ?",
    args: [slug],
  });

  if (projectResult.rows.length === 0) return null;

  const project = projectFromRow(projectResult.rows[0] as unknown as ProjectRow);

  // OPTIMIZED: Fetch all data in parallel with batch queries
  const [pagesResult, sectionsResult, screenshotsResult, questionsResult, questionGroupsResult] =
    await Promise.all([
      db.execute({
        sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
        args: [project.id],
      }),
      db.execute({
        sql: `SELECT s.* FROM sections s
              JOIN pages p ON s.page_id = p.id
              WHERE p.project_id = ?
              ORDER BY s.sort_order`,
        args: [project.id],
      }),
      db.execute({
        sql: `SELECT sc.* FROM screenshots sc
              LEFT JOIN sections s ON sc.section_id = s.id
              LEFT JOIN pages p ON sc.page_id = p.id OR s.page_id = p.id
              WHERE p.project_id = ?
              ORDER BY sc.sort_order`,
        args: [project.id],
      }),
      db.execute({
        sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY sort_order, created_at",
        args: [project.id],
      }),
      db.execute({
        sql: "SELECT * FROM question_groups WHERE project_id = ? ORDER BY sort_order, created_at",
        args: [project.id],
      }),
    ]);

  // Process pages
  const allPages = pagesResult.rows.map((r) => pageFromRow(r as unknown as PageRow));

  // Process sections and group by page
  const sectionsByPage = new Map<string, ReturnType<typeof sectionFromRow>[]>();
  const allSections: ReturnType<typeof sectionFromRow>[] = [];

  for (const row of sectionsResult.rows) {
    const section = sectionFromRow(row as unknown as SectionRow);
    allSections.push(section);
    const existing = sectionsByPage.get(section.pageId) || [];
    existing.push(section);
    sectionsByPage.set(section.pageId, existing);
  }

  // Process screenshots and group by section/page
  const screenshotsBySection = new Map<string, ReturnType<typeof screenshotFromRow>[]>();
  const screenshotsByPage = new Map<string, ReturnType<typeof screenshotFromRow>[]>();

  for (const row of screenshotsResult.rows) {
    const screenshot = screenshotFromRow(row as unknown as ScreenshotRow);
    if (screenshot.sectionId) {
      const existing = screenshotsBySection.get(screenshot.sectionId) || [];
      existing.push(screenshot);
      screenshotsBySection.set(screenshot.sectionId, existing);
    } else if (screenshot.pageId) {
      const existing = screenshotsByPage.get(screenshot.pageId) || [];
      existing.push(screenshot);
      screenshotsByPage.set(screenshot.pageId, existing);
    }
  }

  // Build pages with sections and screenshots
  const pagesWithSections = allPages.map((page) => {
    const pageSections = sectionsByPage.get(page.id) || [];
    const sectionsWithScreenshots = pageSections.map((section) => ({
      ...section,
      screenshots: screenshotsBySection.get(section.id) || [],
    }));
    const pageScreenshots = screenshotsByPage.get(page.id) || [];

    return { ...page, sections: sectionsWithScreenshots, screenshots: pageScreenshots };
  });

  // Process questions and question groups
  const questions = questionsResult.rows.map((r) => questionFromRow(r as unknown as QuestionRow));
  const questionGroups = questionGroupsResult.rows.map((r) =>
    questionGroupFromRow(r as unknown as QuestionGroupRow)
  );

  return { project, pages: pagesWithSections, questions, questionGroups, sections: allSections };
}

export default async function ClientVotingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProjectBySlug(slug);

  if (!data) notFound();

  const { project, pages, questions, questionGroups, sections } = data;

  // Flatten all screenshots for voting (both section and page-level screenshots)
  const allScreenshots = pages.flatMap((page) => {
    // Section-level screenshots
    const sectionScreenshots = page.sections.flatMap((section) =>
      section.screenshots.map((screenshot) => ({
        ...screenshot,
        pageName: page.name,
        sectionName: section.name,
      }))
    );

    // Page-level screenshots (no section)
    const pageScreenshots = (page.screenshots || []).map((screenshot) => ({
      ...screenshot,
      pageName: page.name,
      sectionName: null as string | null,
    }));

    return [...pageScreenshots, ...sectionScreenshots];
  });

  // Flatten pages for questionnaire (without sections/screenshots)
  const flatPages = pages.map((page) => ({
    id: page.id,
    projectId: page.projectId,
    name: page.name,
    description: page.description,
    sortOrder: page.sortOrder,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  }));

  // If no screenshots and no questions, show a message
  if (allScreenshots.length === 0 && questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold sm:text-2xl">{project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            No content available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <VotingInterface
      project={project}
      pages={pages}
      screenshots={allScreenshots}
      questions={questions}
      questionGroups={questionGroups}
      flatPages={flatPages}
      sections={sections}
    />
  );
}
