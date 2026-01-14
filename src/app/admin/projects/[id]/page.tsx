import { notFound } from "next/navigation";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ProjectDetails } from "@/components/admin/project-details";
import { PagesManager } from "@/components/admin/pages-manager";
import { ScreenshotsManager } from "@/components/admin/screenshots-manager";
import { QuestionnaireManager } from "@/components/admin/questionnaire-manager";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProjectData(id: string) {
  noStore();
  await initializeSchema();

  const projectResult = await db.execute({
    sql: "SELECT * FROM projects WHERE id = ?",
    args: [id],
  });

  if (projectResult.rows.length === 0) return null;

  const project = projectFromRow(projectResult.rows[0] as unknown as ProjectRow);

  // OPTIMIZED: Fetch all data in parallel with batch queries
  const [pagesResult, sectionsResult, screenshotsResult, questionsResult, questionGroupsResult] =
    await Promise.all([
      db.execute({
        sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
        args: [id],
      }),
      db.execute({
        sql: `SELECT s.* FROM sections s
              JOIN pages p ON s.page_id = p.id
              WHERE p.project_id = ?
              ORDER BY s.sort_order`,
        args: [id],
      }),
      db.execute({
        sql: `SELECT sc.* FROM screenshots sc
              LEFT JOIN sections s ON sc.section_id = s.id
              LEFT JOIN pages p ON sc.page_id = p.id OR s.page_id = p.id
              WHERE p.project_id = ?
              ORDER BY sc.sort_order`,
        args: [id],
      }),
      db.execute({
        sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY sort_order, created_at",
        args: [id],
      }),
      db.execute({
        sql: "SELECT * FROM question_groups WHERE project_id = ? ORDER BY sort_order, created_at",
        args: [id],
      }),
    ]);

  // Process pages
  const allPages = pagesResult.rows.map((r) => pageFromRow(r as unknown as PageRow));

  // Process sections and group by page
  const sectionsByPage = new Map<string, ReturnType<typeof sectionFromRow>[]>();
  for (const row of sectionsResult.rows) {
    const section = sectionFromRow(row as unknown as SectionRow);
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

  return { project, pages: pagesWithSections, questions, questionGroups };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getProjectData(id);

  if (!data) notFound();

  const { project, pages, questions, questionGroups } = data;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/projects"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton slug={project.slug} />
          <a
            href={`/projects/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="sm:size-default">
              <ExternalLink className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
              <span className="sm:hidden">View</span>
            </Button>
          </a>
        </div>
      </div>

      <Tabs defaultValue="pages" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
          <TabsTrigger value="pages" className="text-xs sm:text-sm">Pages & Sections</TabsTrigger>
          <TabsTrigger value="screenshots" className="text-xs sm:text-sm">Screenshots</TabsTrigger>
          <TabsTrigger value="questionnaire" className="text-xs sm:text-sm">Questionnaire</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <ProjectDetails project={project} />
        </TabsContent>

        <TabsContent value="pages">
          <PagesManager projectId={project.id} pages={pages} />
        </TabsContent>

        <TabsContent value="screenshots">
          <ScreenshotsManager projectId={project.id} pages={pages} />
        </TabsContent>

        <TabsContent value="questionnaire">
          <QuestionnaireManager projectId={project.id} pages={pages} questions={questions} questionGroups={questionGroups} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
