import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { db, initializeSchema } from "@/lib/db";
import {
  type ProjectRow,
  type PageRow,
  type SectionRow,
  type ScreenshotRow,
  type VoteRow,
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  voteFromRow,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ThumbsUp, Minus, ThumbsDown, MessageSquare } from "lucide-react";
import { ResetVotesButton } from "@/components/admin/reset-votes-button";
import { Toaster } from "@/components/ui/sonner";

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
}

interface ProjectWithData {
  project: ReturnType<typeof projectFromRow>;
  pages: PageWithSections[];
  totalVotes: number;
}

async function getGroupedVotes(): Promise<ProjectWithData[]> {
  noStore();
  await initializeSchema();

  // Get all projects
  const projectResult = await db.execute("SELECT * FROM projects ORDER BY name");
  const projectRows = projectResult.rows as unknown as ProjectRow[];

  const result: ProjectWithData[] = [];

  for (const projectRow of projectRows) {
    const project = projectFromRow(projectRow);
    let totalVotes = 0;

    // Get pages for this project
    const pageResult = await db.execute({
      sql: "SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order",
      args: [project.id],
    });
    const pageRows = pageResult.rows as unknown as PageRow[];

    const pages: PageWithSections[] = [];

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

      if (sections.length > 0) {
        pages.push({ page, sections });
      }
    }

    if (pages.length > 0) {
      result.push({ project, pages, totalVotes });
    }
  }

  return result;
}

function VoteSummaryBar({ summary }: { summary: { yes: number; mid: number; no: number; total: number } }) {
  if (summary.total === 0) {
    return (
      <div className="text-sm text-muted-foreground">No votes yet</div>
    );
  }

  const yesPercent = (summary.yes / summary.total) * 100;
  const midPercent = (summary.mid / summary.total) * 100;
  const noPercent = (summary.no / summary.total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full">
        {yesPercent > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${yesPercent}%` }}
          />
        )}
        {midPercent > 0 && (
          <div
            className="bg-yellow-500"
            style={{ width: `${midPercent}%` }}
          />
        )}
        {noPercent > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${noPercent}%` }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-green-500" />
          {summary.yes}
        </span>
        <span className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-yellow-500" />
          {summary.mid}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="h-3 w-3 text-red-500" />
          {summary.no}
        </span>
        <span className="text-muted-foreground">
          ({summary.total} total)
        </span>
      </div>
    </div>
  );
}

function ScreenshotCard({ data }: { data: ScreenshotWithVotes }) {
  const { screenshot, votes, summary } = data;
  const commentsCount = votes.filter((v) => v.comment).length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex gap-4 p-4">
        {/* Screenshot thumbnail */}
        <div className="relative h-32 w-48 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {screenshot.sourceType === "local" && screenshot.filePath ? (
            <Image
              src={screenshot.filePath}
              alt={screenshot.title || "Screenshot"}
              fill
              className="object-cover"
            />
          ) : screenshot.externalUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshot.externalUrl}
              alt={screenshot.title || "Screenshot"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Vote info */}
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="font-medium">
              {screenshot.title || "Untitled Screenshot"}
            </h4>
            {screenshot.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {screenshot.description}
              </p>
            )}
          </div>

          <VoteSummaryBar summary={summary} />
        </div>
      </div>

      {/* Comments section */}
      {commentsCount > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            <MessageSquare className="h-4 w-4" />
            {commentsCount} comment{commentsCount !== 1 ? "s" : ""}
            <ChevronDown className="ml-auto h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-4 py-3 space-y-3">
              {votes
                .filter((v) => v.comment)
                .map((vote) => (
                  <div key={vote.id} className="flex items-start gap-3">
                    <Badge
                      variant={
                        vote.vote === "yes"
                          ? "default"
                          : vote.vote === "mid"
                          ? "secondary"
                          : "destructive"
                      }
                      className="mt-0.5 flex-shrink-0"
                    >
                      {vote.vote}
                    </Badge>
                    <p className="text-sm">{vote.comment}</p>
                  </div>
                ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default async function VotesPage() {
  const groupedData = await getGroupedVotes();

  const totalVotes = groupedData.reduce((sum, p) => sum + p.totalVotes, 0);

  return (
    <div>
      <Toaster />
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Vote Analytics</h1>
        <p className="text-muted-foreground">
          View all votes grouped by project, page, and section
        </p>
      </div>

      {groupedData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No screenshots with votes yet. Create a project, add screenshots,
            and share the link with clients.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                {totalVotes} total votes across {groupedData.length} project
                {groupedData.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Projects */}
          {groupedData.map(({ project, pages, totalVotes: projectVotes }) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {project.name}
                      <Badge variant="outline">{project.type}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {projectVotes} vote{projectVotes !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <ResetVotesButton
                    projectId={project.id}
                    projectName={project.name}
                    voteCount={projectVotes}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {pages.map(({ page, sections }) => (
                  <div key={page.id}>
                    <h3 className="mb-4 text-lg font-semibold border-b pb-2">
                      {page.name}
                    </h3>
                    <div className="space-y-6">
                      {sections.map(({ section, screenshots }) => (
                        <div key={section.id}>
                          <h4 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            {section.name}
                          </h4>
                          <div className="grid gap-4">
                            {screenshots.map((screenshotData) => (
                              <ScreenshotCard
                                key={screenshotData.screenshot.id}
                                data={screenshotData}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
