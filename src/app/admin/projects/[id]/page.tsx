import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
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
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { ProjectDetails } from "@/components/admin/project-details";
import { PagesManager } from "@/components/admin/pages-manager";
import { ScreenshotsManager } from "@/components/admin/screenshots-manager";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getProjectData(id: string) {
  const db = getDb();

  const projectRow = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as ProjectRow | undefined;

  if (!projectRow) return null;

  const project = projectFromRow(projectRow);

  const pageRows = db
    .prepare("SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order")
    .all(id) as PageRow[];

  const pagesWithSections = pageRows.map((pageRow) => {
    const page = pageFromRow(pageRow);

    const sectionRows = db
      .prepare("SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order")
      .all(page.id) as SectionRow[];

    const sectionsWithScreenshots = sectionRows.map((sectionRow) => {
      const section = sectionFromRow(sectionRow);

      const screenshotRows = db
        .prepare(
          "SELECT * FROM screenshots WHERE section_id = ? ORDER BY sort_order"
        )
        .all(section.id) as ScreenshotRow[];

      return {
        ...section,
        screenshots: screenshotRows.map(screenshotFromRow),
      };
    });

    return { ...page, sections: sectionsWithScreenshots };
  });

  return { project, pages: pagesWithSections };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = getProjectData(id);

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
