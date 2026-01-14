"use client";

import { type Project } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Images, FileQuestion, ArrowRight, CheckCircle, Sparkles } from "lucide-react";

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

interface SelectionScreenProps {
  project: Project;
  email: string;
  hasScreenshots: boolean;
  hasQuestions: boolean;
  completionStatus: CompletionStatus | null;
  onSelectVoting: () => void;
  onSelectQuestionnaire: () => void;
}

export function SelectionScreen({
  project,
  email,
  hasScreenshots,
  hasQuestions,
  completionStatus,
  onSelectVoting,
  onSelectQuestionnaire,
}: SelectionScreenProps) {
  const votingCompleted = completionStatus?.voting.completed ?? false;
  const votingHasNew = completionStatus?.voting.hasNewContent ?? false;
  const questionnaireCompleted = completionStatus?.questionnaire.completed ?? false;
  const questionnaireHasNew = completionStatus?.questionnaire.hasNewContent ?? false;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-xl">{project.name}</h1>
            {project.description && (
              <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
                {project.description}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {email}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 pb-20 sm:pb-50">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              What would you like to do?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Choose an option below to continue
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Voting Option */}
            <Card
              className={`relative flex flex-col overflow-hidden transition-all ${hasScreenshots
                ? "cursor-pointer hover:border-primary hover:shadow-lg"
                : "opacity-60"
                } ${votingHasNew ? "border-blue-500" : votingCompleted ? "border-green-500/50" : ""}`}
              onClick={hasScreenshots ? onSelectVoting : undefined}
            >
              <CardHeader className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Images className="h-6 w-6 text-primary" />
                </div>
                {(votingCompleted || votingHasNew || !hasScreenshots) && (
                  <div className="flex flex-wrap gap-2">
                    {votingCompleted && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Completed
                      </Badge>
                    )}
                    {votingHasNew && (
                      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                        <Sparkles className="mr-1 h-3 w-3" />
                        New Items
                      </Badge>
                    )}
                    {!hasScreenshots && (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                )}
                <CardTitle className="text-lg">Vote on Designs</CardTitle>
                <CardDescription>
                  Review and vote on design screenshots to help us understand
                  your style preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  disabled={!hasScreenshots}
                  variant={votingCompleted && !votingHasNew ? "outline" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasScreenshots) onSelectVoting();
                  }}
                >
                  {hasScreenshots ? (
                    <>
                      {votingCompleted ? (votingHasNew ? "Review New Items" : "Update Votes") : "Start Voting"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    "No screenshots available"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Questionnaire Option */}
            <Card
              className={`relative flex flex-col overflow-hidden transition-all ${hasQuestions
                ? "cursor-pointer hover:border-primary hover:shadow-lg"
                : "opacity-60"
                } ${questionnaireHasNew ? "border-blue-500" : questionnaireCompleted ? "border-green-500/50" : ""}`}
              onClick={hasQuestions ? onSelectQuestionnaire : undefined}
            >
              <CardHeader className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileQuestion className="h-6 w-6 text-primary" />
                </div>
                {(questionnaireCompleted || questionnaireHasNew || !hasQuestions) && (
                  <div className="flex flex-wrap gap-2">
                    {questionnaireCompleted && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Completed
                      </Badge>
                    )}
                    {questionnaireHasNew && (
                      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                        <Sparkles className="mr-1 h-3 w-3" />
                        New Questions
                      </Badge>
                    )}
                    {!hasQuestions && (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                )}
                <CardTitle className="text-lg">Complete Questionnaire</CardTitle>
                <CardDescription>
                  Answer questions to help us gather information about your
                  project requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  disabled={!hasQuestions}
                  variant={questionnaireCompleted && !questionnaireHasNew ? "outline" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasQuestions) onSelectQuestionnaire();
                  }}
                >
                  {hasQuestions ? (
                    <>
                      {questionnaireCompleted ? (questionnaireHasNew ? "Answer New Questions" : "Update Responses") : "Start Questionnaire"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    "No questions available"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
