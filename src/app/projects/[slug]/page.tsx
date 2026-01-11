import { notFound } from "next/navigation";
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
import { VotingInterface } from "@/components/client/voting-interface";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getProjectBySlug(slug: string) {
  const db = getDb();

  const projectRow = db
    .prepare("SELECT * FROM projects WHERE slug = ?")
    .get(slug) as ProjectRow | undefined;

  if (!projectRow) return null;

  const project = projectFromRow(projectRow);

  const pageRows = db
    .prepare("SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order")
    .all(project.id) as PageRow[];

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

export default async function ClientVotingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = getProjectBySlug(slug);

  if (!data) notFound();

  const { project, pages } = data;

  // Flatten all screenshots for voting
  const allScreenshots = pages.flatMap((page) =>
    page.sections.flatMap((section) =>
      section.screenshots.map((screenshot) => ({
        ...screenshot,
        pageName: page.name,
        sectionName: section.name,
      }))
    )
  );

  if (allScreenshots.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-2 text-muted-foreground">
            No screenshots available for voting yet.
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
    />
  );
}
