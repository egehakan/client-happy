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
import { Images, FileQuestion, ArrowRight } from "lucide-react";

interface SelectionScreenProps {
  project: Project;
  email: string;
  hasScreenshots: boolean;
  hasQuestions: boolean;
  onSelectVoting: () => void;
  onSelectQuestionnaire: () => void;
}

export function SelectionScreen({
  project,
  email,
  hasScreenshots,
  hasQuestions,
  onSelectVoting,
  onSelectQuestionnaire,
}: SelectionScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold sm:text-xl">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-muted-foreground sm:text-sm">
                {project.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Logged in as: {email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
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
              className={`relative overflow-hidden transition-all ${
                hasScreenshots
                  ? "cursor-pointer hover:border-primary hover:shadow-lg"
                  : "opacity-60"
              }`}
              onClick={hasScreenshots ? onSelectVoting : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Images className="h-6 w-6 text-primary" />
                  </div>
                  {!hasScreenshots && (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasScreenshots) onSelectVoting();
                  }}
                >
                  {hasScreenshots ? (
                    <>
                      Start Voting
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
              className={`relative overflow-hidden transition-all ${
                hasQuestions
                  ? "cursor-pointer hover:border-primary hover:shadow-lg"
                  : "opacity-60"
              }`}
              onClick={hasQuestions ? onSelectQuestionnaire : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <FileQuestion className="h-6 w-6 text-primary" />
                  </div>
                  {!hasQuestions && (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasQuestions) onSelectQuestionnaire();
                  }}
                >
                  {hasQuestions ? (
                    <>
                      Start Questionnaire
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
