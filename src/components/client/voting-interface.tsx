"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type Project, type Page, type Section, type Screenshot } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ThumbsUp, Minus, ThumbsDown, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
}

interface ScreenshotWithContext extends Screenshot {
  pageName: string;
  sectionName: string;
}

interface VotingInterfaceProps {
  project: Project;
  pages: PageWithSections[];
  screenshots: ScreenshotWithContext[];
}

interface VoteState {
  vote: "yes" | "mid" | "no" | null;
  comment: string;
}

export function VotingInterface({
  project,
  screenshots,
}: VotingInterfaceProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentScreenshot = screenshots[currentIndex];
  const currentVote = votes[currentScreenshot.id] || { vote: null, comment: "" };

  const votedCount = Object.values(votes).filter((v) => v.vote !== null).length;
  const progress = (votedCount / screenshots.length) * 100;

  function handleVote(vote: "yes" | "mid" | "no") {
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
    // Check if all screenshots have been voted on
    const allVoted = screenshots.every(
      (s) => votes[s.id]?.vote !== null && votes[s.id]?.vote !== undefined
    );

    if (!allVoted) {
      toast.error("Please vote on all screenshots before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      const votesToSubmit = screenshots.map((s) => ({
        screenshotId: s.id,
        vote: votes[s.id].vote!,
        comment: votes[s.id].comment || undefined,
      }));

      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: votesToSubmit }),
      });

      if (!response.ok) throw new Error("Failed to submit votes");

      router.push(`/projects/${project.slug}/thank-you`);
    } catch {
      toast.error("Failed to submit votes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold sm:text-xl">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-muted-foreground sm:text-sm">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-card/50 px-4 py-2 sm:px-6 sm:py-3">
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
                  {currentScreenshot.pageName} / {currentScreenshot.sectionName}
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
                  className="object-contain"
                />
              ) : currentScreenshot.externalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentScreenshot.externalUrl}
                  alt={currentScreenshot.title || "Screenshot"}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-muted-foreground">
                    No image available
                  </span>
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
                <span className="hidden sm:inline">Yes</span>
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
                <span className="hidden sm:inline">Maybe</span>
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
                <span className="hidden sm:inline">No</span>
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
                <span className="hidden sm:inline">Previous</span>
              </Button>

              {currentIndex === screenshots.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || votedCount !== screenshots.length}
                  size="sm"
                  className="sm:size-default"
                >
                  <Send className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{isSubmitting ? "Submitting..." : "Submit All Votes"}</span>
                  <span className="sm:hidden">{isSubmitting ? "..." : "Submit"}</span>
                </Button>
              ) : (
                <Button onClick={goToNext} size="sm" className="sm:size-default">
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
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
                        className="h-full w-full object-cover"
                      />
                    ) : screenshot.externalUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={screenshot.externalUrl}
                        alt=""
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
