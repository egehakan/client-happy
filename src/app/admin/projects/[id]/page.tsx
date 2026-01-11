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
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  questionFromRow,
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

  const pageResult = await db.execute({
    sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
    args: [id],
  });

  const pagesWithSections = await Promise.all(
    pageResult.rows.map(async (pageRow) => {
      const page = pageFromRow(pageRow as unknown as PageRow);

      const sectionResult = await db.execute({
        sql: "SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order",
        args: [page.id],
      });

      const sectionsWithScreenshots = await Promise.all(
        sectionResult.rows.map(async (sectionRow) => {
          const section = sectionFromRow(sectionRow as unknown as SectionRow);

          const screenshotResult = await db.execute({
            sql: "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order",
            args: [section.id],
          });

          return {
            ...section,
            screenshots: screenshotResult.rows.map((r) =>
              screenshotFromRow(r as unknown as ScreenshotRow)
            ),
          };
        })
      );

      return { ...page, sections: sectionsWithScreenshots };
    })
  );

  // Fetch questions
  const questionsResult = await db.execute({
    sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order, created_at",
    args: [id],
  });
  const questions = questionsResult.rows.map((r) =>
    questionFromRow(r as unknown as QuestionRow)
  );

  return { project, pages: pagesWithSections, questions };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getProjectData(id);

  if (!data) notFound();

  const { project, pages, questions } = data;

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
          <QuestionnaireManager projectId={project.id} pages={pages} questions={questions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
