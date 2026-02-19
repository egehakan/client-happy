"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  type Project,
  type Vote,
  type Question,
  type QuestionResponse,
  type QuestionGroup,
  type Page as PageType,
  type Section as SectionType,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
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
  File,
  Filter,
  Globe,
  Layout,
  Folder,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResetVotesButton } from "@/components/admin/reset-votes-button";
import { ResetQuestionnaireButton } from "@/components/admin/reset-questionnaire-button";
import { exportVotesZip, exportQuestionnaireZip } from "@/lib/export-csv";

interface Screenshot {
  id: string;
  sectionId: string | null;
  pageId: string | null;
  title: string | null;
  description: string | null;
  sourceType: "local" | "url";
  filePath: string | null;
  externalUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ScreenshotWithVotes {
  screenshot: Screenshot;
  votes: Vote[];
  summary: { yes: number; mid: number; no: number; total: number };
}

interface Section {
  id: string;
  pageId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SectionWithScreenshots {
  section: Section;
  screenshots: ScreenshotWithVotes[];
}

interface Page {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PageWithSections {
  page: Page;
  sections: SectionWithScreenshots[];
  pageScreenshots: ScreenshotWithVotes[];
}

interface QuestionWithResponses {
  question: Question;
  responses: QuestionResponse[];
  scopeName: string;
}

interface ResponsesFilterProps {
  project: Project;
  pages: PageWithSections[];
  totalVotes: number;
  questionsWithResponses: QuestionWithResponses[];
  totalRespondents: number;
  uniqueEmails: string[];
  questionGroups: QuestionGroup[];
  allPages: PageType[];
  allSections: SectionType[];
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

function ScreenshotCard({ data, filterEmail }: { data: ScreenshotWithVotes; filterEmail: string | null }) {
  const { screenshot, votes: allVotes } = data;

  // Filter votes by email if filter is set
  const votes = filterEmail
    ? allVotes.filter(v => v.voterIdentifier === filterEmail)
    : allVotes;

  const summary = {
    yes: votes.filter((v) => v.vote === "yes").length,
    mid: votes.filter((v) => v.vote === "mid").length,
    no: votes.filter((v) => v.vote === "no").length,
    total: votes.length,
  };

  const commentsCount = votes.filter((v) => v.comment).length;

  if (filterEmail && votes.length === 0) return null;

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

function QuestionResponseDisplay({
  data,
  filterEmail
}: {
  data: QuestionWithResponses;
  filterEmail: string | null;
}) {
  const { question, responses: allResponses, scopeName } = data;

  // Filter responses by email if filter is set
  const responses = filterEmail
    ? allResponses.filter(r => r.respondentEmail === filterEmail)
    : allResponses;

  if (filterEmail && responses.length === 0) return null;

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
        <Collapsible defaultOpen={filterEmail !== null}>
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
                      (() => {
                        const isImageFile = (filename: string) => {
                          const ext = filename.toLowerCase().split('.').pop();
                          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
                        };

                        try {
                          const filePaths = JSON.parse(response.filePath);
                          const fileNames = response.value ? JSON.parse(response.value) : [];
                          if (Array.isArray(filePaths)) {
                            return (
                              <div className="space-y-3">
                                {filePaths.map((path: string, index: number) => {
                                  const fileName = fileNames[index] || `File ${index + 1}`;
                                  const isImage = isImageFile(fileName) || isImageFile(path);

                                  if (isImage) {
                                    return (
                                      <div key={index} className="space-y-1">
                                        <a href={path} target="_blank" rel="noopener noreferrer" className="block">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={path} alt={fileName} className="max-h-48 rounded-md border object-contain" />
                                        </a>
                                        <p className="text-xs text-muted-foreground">{fileName}</p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <a key={index} href={path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                                      <File className="h-4 w-4" />
                                      {fileName}
                                    </a>
                                  );
                                })}
                              </div>
                            );
                          }
                        } catch {
                          // Single file fallback
                        }

                        const fileName = response.value || "View uploaded file";
                        const isImage = isImageFile(fileName) || isImageFile(response.filePath);

                        if (isImage) {
                          return (
                            <div className="space-y-1">
                              <a href={response.filePath} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={response.filePath} alt={fileName} className="max-h-48 rounded-md border object-contain" />
                              </a>
                              <p className="text-xs text-muted-foreground">{fileName}</p>
                            </div>
                          );
                        }

                        return (
                          <a href={response.filePath} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                            <File className="h-4 w-4" />
                            {fileName}
                          </a>
                        );
                      })()
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

export function ResponsesFilter({
  project,
  pages,
  totalVotes,
  questionsWithResponses,
  totalRespondents,
  uniqueEmails,
  questionGroups,
  allPages,
  allSections,
}: ResponsesFilterProps) {
  const [filterEmail, setFilterEmail] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<"votes" | "questionnaire" | null>(null);

  // Helper to get questions for a group (sorted by sortOrder)
  function getQuestionsForGroup(
    questions: QuestionWithResponses[],
    groupId: string | null,
    scopeType?: string,
    scopeId?: string | null
  ) {
    return questions
      .filter((q) => {
        if (q.question.groupId !== groupId) return false;
        if (scopeType !== undefined && q.question.scopeType !== scopeType) return false;
        if (scopeId !== undefined && q.question.scopeId !== scopeId) return false;
        return true;
      })
      .sort((a, b) => a.question.sortOrder - b.question.sortOrder);
  }

  // Helper to get groups for a scope (sorted by sortOrder)
  function getGroupsForScope(scopeType: string, scopeId: string | null) {
    return questionGroups
      .filter(
        (g) =>
          g.scopeType === scopeType &&
          (scopeId === null ? g.scopeId === null : g.scopeId === scopeId)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Sort pages and get sections helper
  const sortedPages = [...allPages].sort((a, b) => a.sortOrder - b.sortOrder);
  const getSortedSections = (pageId: string) =>
    allSections.filter((s) => s.pageId === pageId).sort((a, b) => a.sortOrder - b.sortOrder);

  // Check if we're using scoped groups
  const hasNewScopedGroups = questionGroups.some((g) => g.scopeType !== null);

  // Calculate filtered totals
  const filteredData = useMemo(() => {
    if (!filterEmail) {
      return { pages, totalVotes, questionsWithResponses, totalRespondents };
    }

    // Filter pages/votes
    let filteredVoteCount = 0;
    const filteredPages = pages.map(({ page, sections, pageScreenshots }) => {
      // Filter section screenshots
      const filteredSections = sections.map(({ section, screenshots }) => ({
        section,
        screenshots: screenshots.map(({ screenshot, votes, summary }) => {
          const filteredVotes = votes.filter(v => v.voterIdentifier === filterEmail);
          filteredVoteCount += filteredVotes.length;
          return {
            screenshot,
            votes: filteredVotes,
            summary: {
              yes: filteredVotes.filter(v => v.vote === "yes").length,
              mid: filteredVotes.filter(v => v.vote === "mid").length,
              no: filteredVotes.filter(v => v.vote === "no").length,
              total: filteredVotes.length,
            },
          };
        }).filter(s => s.votes.length > 0),
      })).filter(s => s.screenshots.length > 0);

      // Filter page-level screenshots
      const filteredPageScreenshots = pageScreenshots.map(({ screenshot, votes, summary }) => {
        const filteredVotes = votes.filter(v => v.voterIdentifier === filterEmail);
        filteredVoteCount += filteredVotes.length;
        return {
          screenshot,
          votes: filteredVotes,
          summary: {
            yes: filteredVotes.filter(v => v.vote === "yes").length,
            mid: filteredVotes.filter(v => v.vote === "mid").length,
            no: filteredVotes.filter(v => v.vote === "no").length,
            total: filteredVotes.length,
          },
        };
      }).filter(s => s.votes.length > 0);

      return {
        page,
        sections: filteredSections,
        pageScreenshots: filteredPageScreenshots,
      };
    }).filter(p => p.sections.length > 0 || p.pageScreenshots.length > 0);

    // Filter questions/responses
    const filteredQuestions = questionsWithResponses.map(({ question, responses, scopeName }) => ({
      question,
      responses: responses.filter(r => r.respondentEmail === filterEmail),
      scopeName,
    })).filter(q => q.responses.length > 0);

    return {
      pages: filteredPages,
      totalVotes: filteredVoteCount,
      questionsWithResponses: filteredQuestions,
      totalRespondents: filterEmail ? 1 : totalRespondents,
    };
  }, [filterEmail, pages, questionsWithResponses, totalRespondents, totalVotes]);

  async function handleExportVotes() {
    setIsExporting("votes");
    try {
      await exportVotesZip(filteredData.pages, project.name);
    } finally {
      setIsExporting(null);
    }
  }

  async function handleExportQuestionnaire() {
    setIsExporting("questionnaire");
    try {
      await exportQuestionnaireZip(
        filteredData.questionsWithResponses,
        project.name
      );
    } finally {
      setIsExporting(null);
    }
  }

  // Group questions by scope
  const websiteQuestions = filteredData.questionsWithResponses.filter(
    (q) => q.question.scopeType === "website"
  );
  const pageQuestions = filteredData.questionsWithResponses.filter(
    (q) => q.question.scopeType === "page"
  );
  const sectionQuestions = filteredData.questionsWithResponses.filter(
    (q) => q.question.scopeType === "section"
  );

  return (
    <div>
      {/* Email Filter */}
      <Card className="mb-6 gap-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">Filter by Client</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="email-filter" className="text-sm text-muted-foreground">
              Client Email:
            </Label>
            <Select
              value={filterEmail || "all"}
              onValueChange={(value) => setFilterEmail(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {uniqueEmails.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterEmail && (
              <Badge variant="secondary" className="w-fit">
                Filtering: {filterEmail}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="votes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="votes" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Votes
            <Badge variant="secondary" className="ml-1">
              {filteredData.totalVotes}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="questionnaire" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Questionnaire
            <Badge variant="secondary" className="ml-1">
              {filteredData.totalRespondents}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="votes">
          {filteredData.pages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {filterEmail ? `No votes from ${filterEmail}` : "No votes yet for this project."}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Vote Results</CardTitle>
                    <CardDescription>
                      {filteredData.totalVotes} vote{filteredData.totalVotes !== 1 ? "s" : ""}
                      {filterEmail ? ` from ${filterEmail}` : " across all screenshots"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportVotes}
                      disabled={filteredData.totalVotes === 0 || isExporting !== null}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isExporting === "votes"
                        ? "Exporting..."
                        : filterEmail
                          ? "Export Filtered ZIP"
                          : "Export ZIP"}
                    </Button>
                    {!filterEmail && (
                      <ResetVotesButton
                        projectId={project.id}
                        projectName={project.name}
                        voteCount={totalVotes}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {filteredData.pages.map(({ page, sections, pageScreenshots }) => (
                  <div key={page.id}>
                    <h3 className="mb-4 border-b pb-2 text-lg font-semibold">
                      {page.name}
                    </h3>
                    <div className="space-y-6">
                      {/* Page-level screenshots (no section) */}
                      {pageScreenshots.length > 0 && (
                        <div>
                          <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            Page Screenshots (No Section)
                          </h4>
                          <div className="grid gap-4">
                            {pageScreenshots.map((screenshotData) => (
                              <ScreenshotCard
                                key={screenshotData.screenshot.id}
                                data={screenshotData}
                                filterEmail={filterEmail}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Section screenshots */}
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
                                filterEmail={filterEmail}
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
          ) : filteredData.questionsWithResponses.length === 0 && filterEmail ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No questionnaire responses from {filterEmail}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Questionnaire Responses</CardTitle>
                      <CardDescription>
                        {filterEmail
                          ? `Responses from ${filterEmail}`
                          : `${totalRespondents} unique respondent${totalRespondents !== 1 ? "s" : ""} across ${questionsWithResponses.length} question${questionsWithResponses.length !== 1 ? "s" : ""}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportQuestionnaire}
                        disabled={filteredData.questionsWithResponses.length === 0 || isExporting !== null}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isExporting === "questionnaire"
                          ? "Exporting..."
                          : filterEmail
                            ? "Export Filtered ZIP"
                            : "Export ZIP"}
                      </Button>
                      {!filterEmail && totalRespondents > 0 && (
                        <ResetQuestionnaireButton
                          projectId={project.id}
                          projectName={project.name}
                          responseCount={totalRespondents}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {hasNewScopedGroups ? (
                <>
                  {/* Website-scoped questions */}
                  {(getGroupsForScope("website", null).length > 0 ||
                    getQuestionsForGroup(filteredData.questionsWithResponses, null, "website", null).length > 0) && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          <CardTitle className="text-base">Website Questions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Groups */}
                        {getGroupsForScope("website", null).map((group) => {
                          const groupQuestions = getQuestionsForGroup(
                            filteredData.questionsWithResponses,
                            group.id,
                            "website",
                            null
                          );
                          if (groupQuestions.length === 0) return null;
                          return (
                            <div key={group.id} className="space-y-4">
                              <div className="border-b pb-2">
                                <h4 className="font-medium">{group.name}</h4>
                                {group.description && (
                                  <p className="text-sm text-muted-foreground">{group.description}</p>
                                )}
                              </div>
                              <div className="space-y-4 pl-4">
                                {groupQuestions.map((data) => (
                                  <QuestionResponseDisplay
                                    key={data.question.id}
                                    data={data}
                                    filterEmail={filterEmail}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {/* Ungrouped */}
                        {getQuestionsForGroup(filteredData.questionsWithResponses, null, "website", null).map((data) => (
                          <QuestionResponseDisplay
                            key={data.question.id}
                            data={data}
                            filterEmail={filterEmail}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Pages with their sections */}
                  {sortedPages.map((page) => {
                    const pageSections = getSortedSections(page.id);
                    const hasPageQuestions =
                      getGroupsForScope("page", page.id).length > 0 ||
                      getQuestionsForGroup(filteredData.questionsWithResponses, null, "page", page.id).length > 0;
                    const hasSectionQuestions = pageSections.some(
                      (section) =>
                        getGroupsForScope("section", section.id).length > 0 ||
                        getQuestionsForGroup(filteredData.questionsWithResponses, null, "section", section.id).length > 0
                    );

                    if (!hasPageQuestions && !hasSectionQuestions) return null;

                    return (
                      <Card key={page.id}>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Layout className="h-5 w-5" />
                            <CardTitle className="text-base">{page.name}</CardTitle>
                          </div>
                          {page.description && (
                            <CardDescription>{page.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Sections first */}
                          {pageSections.map((section) => {
                            const sectionGroups = getGroupsForScope("section", section.id);
                            const ungroupedSectionQuestions = getQuestionsForGroup(
                              filteredData.questionsWithResponses,
                              null,
                              "section",
                              section.id
                            );

                            if (sectionGroups.length === 0 && ungroupedSectionQuestions.length === 0) {
                              return null;
                            }

                            return (
                              <div key={section.id} className="space-y-4">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <h4 className="font-medium">{section.name}</h4>
                                </div>
                                <div className="space-y-4 pl-4">
                                  {/* Section groups */}
                                  {sectionGroups.map((group) => {
                                    const groupQuestions = getQuestionsForGroup(
                                      filteredData.questionsWithResponses,
                                      group.id,
                                      "section",
                                      section.id
                                    );
                                    if (groupQuestions.length === 0) return null;
                                    return (
                                      <div key={group.id} className="space-y-4">
                                        <div className="border-b pb-2">
                                          <h5 className="text-sm font-medium">{group.name}</h5>
                                          {group.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {group.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="space-y-4 pl-4">
                                          {groupQuestions.map((data) => (
                                            <QuestionResponseDisplay
                                              key={data.question.id}
                                              data={data}
                                              filterEmail={filterEmail}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Ungrouped section questions */}
                                  {ungroupedSectionQuestions.map((data) => (
                                    <QuestionResponseDisplay
                                      key={data.question.id}
                                      data={data}
                                      filterEmail={filterEmail}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {/* Page-level groups and questions */}
                          {(getGroupsForScope("page", page.id).length > 0 ||
                            getQuestionsForGroup(filteredData.questionsWithResponses, null, "page", page.id).length > 0) && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b pb-2">
                                <Layout className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-medium">Page Questions</h4>
                              </div>
                              <div className="space-y-4 pl-4">
                                {/* Page groups */}
                                {getGroupsForScope("page", page.id).map((group) => {
                                  const groupQuestions = getQuestionsForGroup(
                                    filteredData.questionsWithResponses,
                                    group.id,
                                    "page",
                                    page.id
                                  );
                                  if (groupQuestions.length === 0) return null;
                                  return (
                                    <div key={group.id} className="space-y-4">
                                      <div className="border-b pb-2">
                                        <h5 className="text-sm font-medium">{group.name}</h5>
                                        {group.description && (
                                          <p className="text-sm text-muted-foreground">
                                            {group.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="space-y-4 pl-4">
                                        {groupQuestions.map((data) => (
                                          <QuestionResponseDisplay
                                            key={data.question.id}
                                            data={data}
                                            filterEmail={filterEmail}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Ungrouped page questions */}
                                {getQuestionsForGroup(filteredData.questionsWithResponses, null, "page", page.id).map(
                                  (data) => (
                                    <QuestionResponseDisplay
                                      key={data.question.id}
                                      data={data}
                                      filterEmail={filterEmail}
                                    />
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Legacy flat display - Website questions */}
                  {websiteQuestions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          <CardTitle className="text-base">Website Questions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {websiteQuestions.map((data) => (
                          <QuestionResponseDisplay
                            key={data.question.id}
                            data={data}
                            filterEmail={filterEmail}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Legacy - Page questions */}
                  {pageQuestions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Layout className="h-5 w-5" />
                          <CardTitle className="text-base">Page Questions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {pageQuestions.map((data) => (
                          <QuestionResponseDisplay
                            key={data.question.id}
                            data={data}
                            filterEmail={filterEmail}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Legacy - Section questions */}
                  {sectionQuestions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Folder className="h-5 w-5" />
                          <CardTitle className="text-base">Section Questions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {sectionQuestions.map((data) => (
                          <QuestionResponseDisplay
                            key={data.question.id}
                            data={data}
                            filterEmail={filterEmail}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
