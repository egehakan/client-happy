"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type Project, type Page, type Section, type Screenshot, type Question, type QuestionGroup } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ThumbsUp, Minus, ThumbsDown, ChevronLeft, ChevronRight, Send, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { EmailEntry } from "@/components/client/email-entry";
import { SelectionScreen } from "@/components/client/selection-screen";
import { QuestionnaireInterface } from "@/components/client/questionnaire-interface";

interface CompletionStatus {
  voting: {
    completed: boolean;
    hasNewContent: boolean;
    totalItems: number;
    completedItems: number;
  };
  questionnaire: {
    completed: boolean;
    hasNewContent: boolean;
    totalItems: number;
    completedItems: number;
  };
}

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
}

interface ScreenshotWithContext extends Screenshot {
  pageName: string;
  sectionName: string | null;
}

interface VotingInterfaceProps {
  project: Project;
  pages: PageWithSections[];
  screenshots: ScreenshotWithContext[];
  questions?: Question[];
  questionGroups?: QuestionGroup[];
  flatPages?: Page[];
  sections?: Section[];
}

interface VoteState {
  vote: "yes" | "mid" | "no" | null;
  comment: string;
}

type FlowState = "email" | "selection" | "voting" | "questionnaire";

export function VotingInterface({
  project,
  screenshots,
  questions = [],
  questionGroups = [],
  flatPages = [],
  sections = [],
}: VotingInterfaceProps) {
  const router = useRouter();
  const [voterEmail, setVoterEmail] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("email");
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);

  const hasScreenshots = screenshots.length > 0;
  const hasQuestions = questions.length > 0;

  // Determine if we need selection screen
  const needsSelectionScreen = hasScreenshots && hasQuestions;

  const fetchCompletionStatus = useCallback(async (email: string) => {
    try {
      const response = await fetch(
        `/api/projects/by-slug/${project.slug}/completion-status?email=${encodeURIComponent(email)}`
      );
      if (response.ok) {
        const status = await response.json();
        setCompletionStatus(status);
      }
    } catch (err) {
      console.error("Failed to fetch completion status:", err);
    }
  }, [project.slug]);

  // Check localStorage for existing email on mount
  useEffect(() => {
    const storageKey = `voter_email_${project.slug}`;
    const savedEmail = localStorage.getItem(storageKey);

    if (savedEmail) {
      setVoterEmail(savedEmail);
      // If we have both features, go to selection screen
      if (needsSelectionScreen) {
        setFlowState("selection");
        fetchCompletionStatus(savedEmail).finally(() => setIsLoadingStatus(false));
      } else if (hasScreenshots) {
        setFlowState("voting");
        setIsLoadingVotes(true);
        loadExistingVotes(savedEmail).finally(() => {
          setIsLoadingVotes(false);
          setIsLoadingStatus(false);
          // Show initial context overlay
          if (screenshots.length > 0) {
            showContextFor(screenshots[0]);
          }
        });
      } else if (hasQuestions) {
        setFlowState("questionnaire");
        setIsLoadingStatus(false);
      } else {
        setIsLoadingStatus(false);
      }
    } else {
      setIsLoadingStatus(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentScreenshot = screenshots[currentIndex];
  const previousScreenshot = currentIndex > 0 ? screenshots[currentIndex - 1] : null;
  const currentVote = currentScreenshot
    ? votes[currentScreenshot.id] || { vote: null, comment: "" }
    : { vote: null, comment: "" };

  // Context overlay state
  const [showContextOverlay, setShowContextOverlay] = useState(false);
  const [contextInfo, setContextInfo] = useState<{
    pageName: string;
    sectionName: string | null;
  } | null>(null);

  // Helper to show context overlay
  const showContextFor = useCallback((screenshot: ScreenshotWithContext) => {
    setContextInfo({
      pageName: screenshot.pageName,
      sectionName: screenshot.sectionName
    });
    setShowContextOverlay(true);
    setTimeout(() => setShowContextOverlay(false), 2000);
  }, []);

  // Show overlay on page/section changes during navigation
  useEffect(() => {
    // Reset overlay when index changes
    setShowContextOverlay(false);

    if (!previousScreenshot || !currentScreenshot) return;

    const isNewPage = previousScreenshot.pageName !== currentScreenshot.pageName;
    const isNewSection = !isNewPage && previousScreenshot.sectionName !== currentScreenshot.sectionName;

    if (isNewPage || isNewSection) {
      setContextInfo({
        pageName: currentScreenshot.pageName,
        sectionName: currentScreenshot.sectionName
      });
      setShowContextOverlay(true);
      const timer = setTimeout(() => setShowContextOverlay(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, previousScreenshot, currentScreenshot]);

  const votedCount = Object.values(votes).filter((v) => v.vote !== null).length;
  const progress = screenshots.length > 0 ? (votedCount / screenshots.length) * 100 : 0;
  const hasAnyVotes = votedCount > 0;

  // Get indices of images to preload (current + next 2)
  const preloadIndices = useMemo(() => {
    const indices = new Set<number>();
    indices.add(currentIndex);
    if (currentIndex + 1 < screenshots.length) indices.add(currentIndex + 1);
    if (currentIndex + 2 < screenshots.length) indices.add(currentIndex + 2);
    if (currentIndex - 1 >= 0) indices.add(currentIndex - 1);
    return indices;
  }, [currentIndex, screenshots.length]);

  async function handleEmailSubmit(email: string) {
    setVoterEmail(email);

    // Store email in localStorage for persistence
    const storageKey = `voter_email_${project.slug}`;
    localStorage.setItem(storageKey, email);

    // Fetch completion status
    await fetchCompletionStatus(email);

    // If both screenshots and questions exist, show selection screen
    if (needsSelectionScreen) {
      setFlowState("selection");
      return;
    }

    // Otherwise, go directly to the available feature
    if (hasScreenshots) {
      setFlowState("voting");
      setIsLoadingVotes(true);
      await loadExistingVotes(email);
      setIsLoadingVotes(false);
      // Show initial context overlay
      if (screenshots.length > 0) {
        showContextFor(screenshots[0]);
      }
    } else if (hasQuestions) {
      setFlowState("questionnaire");
    }
  }

  async function loadExistingVotes(email: string) {
    try {
      const screenshotIds = screenshots.map((s) => s.id).join(",");
      const response = await fetch(
        `/api/votes/by-voter?voterIdentifier=${encodeURIComponent(email)}&screenshotIds=${encodeURIComponent(screenshotIds)}`
      );

      if (response.ok) {
        const existingVotes = await response.json();
        const votesRecord: Record<string, VoteState> = {};
        for (const vote of existingVotes) {
          votesRecord[vote.screenshotId] = {
            vote: vote.vote,
            comment: vote.comment || "",
          };
        }
        setVotes(votesRecord);
      }
    } catch (err) {
      console.error("Failed to fetch existing votes:", err);
    }
  }

  async function handleSelectVoting() {
    setFlowState("voting");
    setIsLoadingVotes(true);
    await loadExistingVotes(voterEmail!);
    setIsLoadingVotes(false);
    // Show initial context overlay
    if (screenshots.length > 0) {
      showContextFor(screenshots[0]);
    }
  }

  function handleSelectQuestionnaire() {
    setFlowState("questionnaire");
  }

  function handleBackToSelection() {
    setFlowState("selection");
  }

  function handleVote(vote: "yes" | "mid" | "no") {
    if (!currentScreenshot) return;
    setVotes((prev) => ({
      ...prev,
      [currentScreenshot.id]: {
        ...prev[currentScreenshot.id],
        vote,
        comment: prev[currentScreenshot.id]?.comment || "",
      },
    }));
  }

  function handleCommentChange(comment: string) {
    if (!currentScreenshot) return;
    setVotes((prev) => ({
      ...prev,
      [currentScreenshot.id]: {
        ...prev[currentScreenshot.id],
        vote: prev[currentScreenshot.id]?.vote || null,
        comment,
      },
    }));
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function goToNext() {
    if (currentIndex < screenshots.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  async function handleSubmit() {
    if (!hasAnyVotes) {
      toast.error("Please vote on at least one screenshot before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      // Only submit screenshots that have been voted on
      const votesToSubmit = screenshots
        .filter((s) => votes[s.id]?.vote !== null && votes[s.id]?.vote !== undefined)
        .map((s) => ({
          screenshotId: s.id,
          vote: votes[s.id].vote!,
          comment: votes[s.id].comment || undefined,
        }));

      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: votesToSubmit, voterIdentifier: voterEmail }),
      });

      if (!response.ok) throw new Error("Failed to submit votes");

      router.push(`/projects/${project.slug}/thank-you`);
    } catch {
      toast.error("Failed to submit votes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Initial loading state (checking localStorage)
  if (isLoadingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Email entry state
  if (flowState === "email") {
    return <EmailEntry project={project} onEmailSubmit={handleEmailSubmit} />;
  }

  // Selection screen state
  if (flowState === "selection" && voterEmail) {
    return (
      <SelectionScreen
        project={project}
        email={voterEmail}
        hasScreenshots={hasScreenshots}
        hasQuestions={hasQuestions}
        completionStatus={completionStatus}
        onSelectVoting={handleSelectVoting}
        onSelectQuestionnaire={handleSelectQuestionnaire}
      />
    );
  }

  // Questionnaire state
  if (flowState === "questionnaire" && voterEmail) {
    return (
      <QuestionnaireInterface
        project={project}
        questions={questions}
        questionGroups={questionGroups}
        pages={flatPages}
        sections={sections}
        email={voterEmail}
        onBack={needsSelectionScreen ? handleBackToSelection : () => setFlowState("email")}
      />
    );
  }

  // Loading state for voting
  if (isLoadingVotes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your votes...</p>
        </div>
      </div>
    );
  }

  // Voting interface
  if (!currentScreenshot) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            {needsSelectionScreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToSelection}
                className="h-8 w-8"
                title="Back to selection"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-bold sm:text-xl">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {project.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {voterEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-card/50 px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span>
              {votedCount} of {screenshots.length} voted
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-0 sm:py-8">
        <Card>
          <CardHeader className="p-4 pb-3 pt-0 sm:p-6 sm:pb-4 sm:pt-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg">
                  {currentScreenshot.title || `Screenshot ${currentIndex + 1}`}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {currentScreenshot.pageName}{currentScreenshot.sectionName ? ` / ${currentScreenshot.sectionName}` : ""}
                </CardDescription>
              </div>
              <Badge variant="outline" className="flex-shrink-0 text-xs">
                {currentIndex + 1} / {screenshots.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
            {/* Screenshot Image */}
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
              {currentScreenshot.sourceType === "local" &&
                currentScreenshot.filePath ? (
                <Image
                  src={currentScreenshot.filePath}
                  alt={currentScreenshot.title || "Screenshot"}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 896px"
                  className={cn(
                    "object-contain transition-[filter] duration-500",
                    showContextOverlay && "blur-sm"
                  )}
                />
              ) : currentScreenshot.externalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentScreenshot.externalUrl}
                  alt={currentScreenshot.title || "Screenshot"}
                  loading="eager"
                  className={cn(
                    "h-full w-full object-contain transition-[filter] duration-500",
                    showContextOverlay && "blur-sm"
                  )}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-muted-foreground">
                    No image available
                  </span>
                </div>
              )}

              {/* Preload next images invisibly */}
              {screenshots.map((screenshot, index) => {
                if (index === currentIndex || !preloadIndices.has(index)) return null;
                const src = screenshot.sourceType === "local" ? screenshot.filePath : screenshot.externalUrl;
                if (!src) return null;
                return (
                  <Image
                    key={screenshot.id}
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 896px"
                    className="invisible absolute"
                    aria-hidden="true"
                  />
                );
              })}

              {/* Context Overlay */}
              {showContextOverlay && contextInfo && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 animate-in fade-in duration-300">
                  <div className="text-center px-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Page</p>
                    <h2 className="text-xl sm:text-2xl font-bold">{contextInfo.pageName}</h2>
                    {contextInfo.sectionName && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1">Section</p>
                        <h3 className="text-lg sm:text-xl font-semibold">{contextInfo.sectionName}</h3>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {currentScreenshot.description && (
              <p className="text-sm text-muted-foreground">
                {currentScreenshot.description}
              </p>
            )}

            {/* Vote Buttons */}
            <div className="flex justify-center gap-2 sm:gap-4">
              <Button
                variant={currentVote.vote === "yes" ? "default" : "outline"}
                size="lg"
                className={cn(
                  "flex-1 sm:w-32 sm:flex-none",
                  currentVote.vote === "yes" && "bg-green-600 hover:bg-green-700"
                )}
                onClick={() => handleVote("yes")}
              >
                <ThumbsUp className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline">Yes</span>
              </Button>
              <Button
                variant={currentVote.vote === "mid" ? "default" : "outline"}
                size="lg"
                className={cn(
                  "flex-1 sm:w-32 sm:flex-none",
                  currentVote.vote === "mid" && "bg-yellow-600 hover:bg-yellow-700"
                )}
                onClick={() => handleVote("mid")}
              >
                <Minus className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline">Maybe</span>
              </Button>
              <Button
                variant={currentVote.vote === "no" ? "default" : "outline"}
                size="lg"
                className={cn(
                  "flex-1 sm:w-32 sm:flex-none",
                  currentVote.vote === "no" && "bg-red-600 hover:bg-red-700"
                )}
                onClick={() => handleVote("no")}
              >
                <ThumbsDown className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline">No</span>
              </Button>
            </div>

            {/* Comment */}
            <div>
              <Textarea
                placeholder="Add a comment (optional)..."
                value={currentVote.comment}
                onChange={(e) => handleCommentChange(e.target.value)}
                rows={3}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2 pt-2 sm:pt-4">
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                size="sm"
                className="sm:size-default"
              >
                <ChevronLeft className="h-4 w-4 sm:mr-2" />
                <span className="sm:inline">Previous</span>
              </Button>

              {currentIndex === screenshots.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !hasAnyVotes}
                  size="sm"
                  className="sm:size-default"
                >
                  <Send className="h-4 w-4 sm:mr-2" />
                  <span className="sm:hidden">{isSubmitting ? "..." : "Submit"}</span>
                </Button>
              ) : (
                <Button onClick={goToNext} size="sm" className="sm:size-default">
                  <span className="sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 sm:ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Screenshot Thumbnails */}
        <div className="mt-4 sm:mt-6">
          <h3 className="mb-2 text-xs font-medium sm:mb-3 sm:text-sm">All Screenshots</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {screenshots.map((screenshot, index) => {
              const vote = votes[screenshot.id]?.vote;
              return (
                <button
                  key={screenshot.id}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "relative flex-shrink-0 overflow-hidden rounded-md border-2 transition-all",
                    currentIndex === index
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-transparent hover:border-muted-foreground/30",
                    vote === "yes" && "ring-2 ring-green-500",
                    vote === "mid" && "ring-2 ring-yellow-500",
                    vote === "no" && "ring-2 ring-red-500"
                  )}
                >
                  <div className="h-12 w-16 bg-muted sm:h-16 sm:w-24">
                    {screenshot.sourceType === "local" && screenshot.filePath ? (
                      <Image
                        src={screenshot.filePath}
                        alt=""
                        width={96}
                        height={64}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : screenshot.externalUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={screenshot.externalUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  {vote && (
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 right-0 py-0.5 text-center text-[10px] text-white sm:text-xs",
                        vote === "yes" && "bg-green-600",
                        vote === "mid" && "bg-yellow-600",
                        vote === "no" && "bg-red-600"
                      )}
                    >
                      {vote}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
