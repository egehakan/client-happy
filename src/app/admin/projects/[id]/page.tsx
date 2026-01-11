import { notFound } from "next/navigation";
import Link from "next/link";
import { db, initializeSchema } from "@/lib/db";
import {
  type ProjectRow,
  type PageRow,
  type SectionRow,
  type ScreenshotRow,
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ProjectDetails } from "@/components/admin/project-details";
import { PagesManager } from "@/components/admin/pages-manager";
import { ScreenshotsManager } from "@/components/admin/screenshots-manager";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProjectData(id: string) {
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

  return { project, pages: pagesWithSections };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getProjectData(id);

  if (!data) notFound();

  const { project, pages } = data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/projects"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton slug={project.slug} />
          <a
            href={`/projects/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </a>
        </div>
      </div>

      <Tabs defaultValue="pages" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pages">Pages & Sections</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
