import { notFound } from "next/navigation";
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
import { VotingInterface } from "@/components/client/voting-interface";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProjectBySlug(slug: string) {
  await initializeSchema();

  const projectResult = await db.execute({
    sql: "SELECT * FROM projects WHERE slug = ?",
    args: [slug],
  });

  if (projectResult.rows.length === 0) return null;

  const project = projectFromRow(projectResult.rows[0] as unknown as ProjectRow);

  const pageResult = await db.execute({
    sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
    args: [project.id],
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

export default async function ClientVotingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProjectBySlug(slug);

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
