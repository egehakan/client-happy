import Image from "next/image";
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
  projectFromRow,
  pageFromRow,
  sectionFromRow,
  screenshotFromRow,
  voteFromRow,
  questionFromRow,
  questionResponseFromRow,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ChevronDown,
  ThumbsUp,
  Minus,
  ThumbsDown,
  MessageSquare,
  User,
  Calendar,
  FileText,
  Link as LinkIcon,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { ResetVotesButton } from "@/components/admin/reset-votes-button";
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

  // Get questions with responses
  const questionsResult = await db.execute({
    sql: "SELECT * FROM questions WHERE project_id = ? ORDER BY scope_type, sort_order",
    args: [projectId],
  });
  const questionRows = questionsResult.rows as unknown as QuestionRow[];

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
  const respondentsResult = await db.execute({
    sql: `SELECT COUNT(DISTINCT respondent_email) as count FROM question_responses qr
          JOIN questions q ON qr.question_id = q.id
          WHERE q.project_id = ?`,
    args: [projectId],
  });
  const totalRespondents = Number(respondentsResult.rows[0]?.count || 0);

  return {
    project,
    pages,
    totalVotes,
    questionsWithResponses,
    totalRespondents,
  };
}

function VoteSummaryBar({
  summary,
}: {
  summary: { yes: number; mid: number; no: number; total: number };
}) {
  if (summary.total === 0) {
    return <div className="text-sm text-muted-foreground">No votes yet</div>;
  }

  const yesPercent = (summary.yes / summary.total) * 100;
  const midPercent = (summary.mid / summary.total) * 100;
  const noPercent = (summary.no / summary.total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full">
        {yesPercent > 0 && (
          <div className="bg-green-500" style={{ width: `${yesPercent}%` }} />
        )}
        {midPercent > 0 && (
          <div className="bg-yellow-500" style={{ width: `${midPercent}%` }} />
        )}
        {noPercent > 0 && (
          <div className="bg-red-500" style={{ width: `${noPercent}%` }} />
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
        <span className="text-muted-foreground">({summary.total} total)</span>
      </div>
    </div>
  );
}

function ScreenshotCard({ data }: { data: ScreenshotWithVotes }) {
  const { screenshot, votes, summary } = data;
  const commentsCount = votes.filter((v) => v.comment).length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* Screenshot thumbnail */}
        <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-md bg-muted sm:h-32 sm:w-48">
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
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {screenshot.description}
              </p>
            )}
          </div>

          <VoteSummaryBar summary={summary} />
        </div>
      </div>

      {/* Votes section */}
      {votes.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            <MessageSquare className="h-4 w-4" />
            {votes.length} vote{votes.length !== 1 ? "s" : ""} ({commentsCount}{" "}
            with comments)
            <ChevronDown className="ml-auto h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t px-4 py-3">
              {votes.map((vote) => (
                <div key={vote.id} className="flex flex-wrap items-start gap-2">
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
                  {vote.voterIdentifier && (
                    <Badge
                      variant="outline"
                      className="mt-0.5 flex-shrink-0 text-xs font-normal"
                    >
                      {vote.voterIdentifier}
                    </Badge>
                  )}
                  {vote.comment && (
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {vote.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function QuestionResponseDisplay({ data }: { data: QuestionWithResponses }) {
  const { question, responses, scopeName } = data;

  const getFieldIcon = () => {
    switch (question.fieldType) {
      case "file":
        return <ImageIcon className="h-4 w-4" />;
      case "url":
        return <LinkIcon className="h-4 w-4" />;
      case "color":
        return <Palette className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {getFieldIcon()}
              <h4 className="font-medium">{question.label}</h4>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {scopeName}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {question.fieldType}
              </Badge>
              {question.isRequired && (
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            {question.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {question.description}
              </p>
            )}
          </div>
          <Badge variant="outline">{responses.length} response{responses.length !== 1 ? "s" : ""}</Badge>
        </div>
      </div>

      {responses.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            <User className="h-4 w-4" />
            View responses
            <ChevronDown className="ml-auto h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t px-4 py-3">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs font-normal">
                      {response.respondentEmail}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(response.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    {question.fieldType === "file" && response.filePath ? (
                      <a
                        href={response.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View uploaded file
                      </a>
                    ) : question.fieldType === "url" && response.value ? (
                      <a
                        href={response.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {response.value}
                      </a>
                    ) : question.fieldType === "color" && response.value ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: response.value }}
                        />
                        <span>{response.value}</span>
                      </div>
                    ) : question.fieldType === "checkbox" && response.value ? (
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(response.value).map((item: string) => (
                          <Badge key={item} variant="secondary">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {response.value || (
                          <span className="text-muted-foreground italic">
                            No response
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default async function ProjectResponsesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await params;
  const data = await getProjectResponseData(projectId, session.user.id);

  if (!data) notFound();

  const { project, pages, totalVotes, questionsWithResponses, totalRespondents } =
    data;

  // Group questions by scope
  const websiteQuestions = questionsWithResponses.filter(
    (q) => q.question.scopeType === "website"
  );
  const pageQuestions = questionsWithResponses.filter(
    (q) => q.question.scopeType === "page"
  );
  const sectionQuestions = questionsWithResponses.filter(
    (q) => q.question.scopeType === "section"
  );

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

      <Tabs defaultValue="votes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="votes" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Votes
            <Badge variant="secondary" className="ml-1">
              {totalVotes}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="questionnaire" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Questionnaire
            <Badge variant="secondary" className="ml-1">
              {totalRespondents}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="votes">
          {pages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No votes yet for this project.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Vote Results</CardTitle>
                    <CardDescription>
                      {totalVotes} vote{totalVotes !== 1 ? "s" : ""} across all
                      screenshots
                    </CardDescription>
                  </div>
                  <ResetVotesButton
                    projectId={project.id}
                    projectName={project.name}
                    voteCount={totalVotes}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {pages.map(({ page, sections }) => (
                  <div key={page.id}>
                    <h3 className="mb-4 border-b pb-2 text-lg font-semibold">
                      {page.name}
                    </h3>
                    <div className="space-y-6">
                      {sections.map(({ section, screenshots }) => (
                        <div key={section.id}>
                          <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
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
          )}
        </TabsContent>

        <TabsContent value="questionnaire">
          {questionsWithResponses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No questionnaire questions configured for this project.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Questionnaire Responses</CardTitle>
                  <CardDescription>
                    {totalRespondents} unique respondent
                    {totalRespondents !== 1 ? "s" : ""} across{" "}
                    {questionsWithResponses.length} question
                    {questionsWithResponses.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Website-scoped questions */}
              {websiteQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Website Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {websiteQuestions.map((data) => (
                      <QuestionResponseDisplay
                        key={data.question.id}
                        data={data}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Page-scoped questions */}
              {pageQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Page Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pageQuestions.map((data) => (
                      <QuestionResponseDisplay
                        key={data.question.id}
                        data={data}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Section-scoped questions */}
              {sectionQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Section Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sectionQuestions.map((data) => (
                      <QuestionResponseDisplay
                        key={data.question.id}
                        data={data}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
