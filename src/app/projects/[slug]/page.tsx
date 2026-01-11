import { notFound } from "next/navigation";
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

      // Fetch page-level screenshots (screenshots directly on the page, not in a section)
      const pageScreenshotsResult = await db.execute({
        sql: "SELECT * FROM screenshots WHERE page_id = ? AND section_id IS NULL ORDER BY sort_order",
        args: [page.id],
      });
      const pageScreenshots = pageScreenshotsResult.rows.map((r) =>
        screenshotFromRow(r as unknown as ScreenshotRow)
      );

      return { ...page, sections: sectionsWithScreenshots, screenshots: pageScreenshots };
    })
  );

  // Fetch questions
  const questionsResult = await db.execute({
    sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order, created_at",
    args: [project.id],
  });
  const questions = questionsResult.rows.map((r) =>
    questionFromRow(r as unknown as QuestionRow)
  );

  // Flatten sections for questionnaire
  const allSections = pagesWithSections.flatMap((page) =>
    page.sections.map((section) => ({
      id: section.id,
      pageId: page.id,
      name: section.name,
      description: section.description,
      sortOrder: section.sortOrder,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    }))
  );

  return { project, pages: pagesWithSections, questions, sections: allSections };
}

export default async function ClientVotingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProjectBySlug(slug);

  if (!data) notFound();

  const { project, pages, questions, sections } = data;

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
      flatPages={flatPages}
      sections={sections}
    />
  );
}
