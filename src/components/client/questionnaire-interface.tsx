"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type Project,
  type Question,
  type QuestionResponse,
  type Page,
  type Section,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  FileText,
  Layout,
  Send,
  ArrowLeft,
  Upload,
  X,
} from "lucide-react";

interface QuestionWithContext extends Question {
  pageName?: string;
  sectionName?: string;
}

interface QuestionnaireInterfaceProps {
  project: Project;
  questions: QuestionWithContext[];
  pages: Page[];
  sections: Section[];
  email: string;
  onBack: () => void;
}

interface ResponseState {
  [questionId: string]: {
    value: string | null;
    filePath: string | null;
    checkboxValues?: string[];
  };
}

export function QuestionnaireInterface({
  project,
  questions,
  pages,
  sections,
  email,
  onBack,
}: QuestionnaireInterfaceProps) {
  const router = useRouter();
  const [responses, setResponses] = useState<ResponseState>({});
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["website"])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Group questions by scope
  const websiteQuestions = questions.filter((q) => q.scopeType === "website");
  const pageQuestions = questions.filter((q) => q.scopeType === "page");
  const sectionQuestions = questions.filter((q) => q.scopeType === "section");

  // Get page name helper
  function getPageName(pageId: string): string {
    return pages.find((p) => p.id === pageId)?.name || "Unknown Page";
  }

  // Get section with page name helper
  function getSectionInfo(sectionId: string): { sectionName: string; pageName: string } {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return { sectionName: "Unknown Section", pageName: "" };
    const page = pages.find((p) => p.id === section.pageId);
    return { sectionName: section.name, pageName: page?.name || "" };
  }

  // Calculate progress
  const requiredQuestions = questions.filter((q) => q.isRequired);
  const answeredRequired = requiredQuestions.filter(
    (q) => responses[q.id]?.value || responses[q.id]?.filePath
  );
  const progress =
    requiredQuestions.length > 0
      ? (answeredRequired.length / requiredQuestions.length) * 100
      : 100;

  // Fetch existing responses on mount
  useEffect(() => {
    async function fetchResponses() {
      try {
        const questionIds = questions.map((q) => q.id).join(",");
        const response = await fetch(
          `/api/questionnaire/by-respondent?respondentEmail=${encodeURIComponent(
            email
          )}&questionIds=${encodeURIComponent(questionIds)}`
        );

        if (response.ok) {
          const existingResponses: QuestionResponse[] = await response.json();
          const responseState: ResponseState = {};

          for (const resp of existingResponses) {
            const question = questions.find((q) => q.id === resp.questionId);
            if (question?.fieldType === "checkbox" && resp.value) {
              try {
                responseState[resp.questionId] = {
                  value: resp.value,
                  filePath: resp.filePath,
                  checkboxValues: JSON.parse(resp.value),
                };
              } catch {
                responseState[resp.questionId] = {
                  value: resp.value,
                  filePath: resp.filePath,
                };
              }
            } else {
              responseState[resp.questionId] = {
                value: resp.value,
                filePath: resp.filePath,
              };
            }
          }
          setResponses(responseState);
        }
      } catch (err) {
        console.error("Failed to fetch existing responses:", err);
      } finally {
        setIsLoadingResponses(false);
      }
    }

    fetchResponses();
  }, [email, questions]);

  function toggleSection(sectionId: string) {
    const newOpen = new Set(openSections);
    if (newOpen.has(sectionId)) {
      newOpen.delete(sectionId);
    } else {
      newOpen.add(sectionId);
    }
    setOpenSections(newOpen);
  }

  function updateResponse(
    questionId: string,
    value: string | null,
    filePath?: string | null
  ) {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        value,
        filePath: filePath !== undefined ? filePath : prev[questionId]?.filePath || null,
      },
    }));
  }

  function updateCheckboxResponse(questionId: string, option: string, checked: boolean) {
    setResponses((prev) => {
      const current = prev[questionId]?.checkboxValues || [];
      const newValues = checked
        ? [...current, option]
        : current.filter((v) => v !== option);
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          value: JSON.stringify(newValues),
          filePath: prev[questionId]?.filePath || null,
          checkboxValues: newValues,
        },
      };
    });
  }

  async function handleFileUpload(questionId: string, file: File) {
    setUploadingFor(questionId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", project.id);
      formData.append("questionId", questionId);

      const response = await fetch("/api/questionnaire/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload file");
      }

      const { filePath } = await response.json();
      updateResponse(questionId, file.name, filePath);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleSubmit() {
    // Check required fields
    const missingRequired = requiredQuestions.filter(
      (q) => !responses[q.id]?.value && !responses[q.id]?.filePath
    );

    if (missingRequired.length > 0) {
      toast.error(
        `Please answer all required questions (${missingRequired.length} remaining)`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const responsesToSubmit = questions
        .filter((q) => responses[q.id]?.value || responses[q.id]?.filePath)
        .map((q) => ({
          questionId: q.id,
          value: responses[q.id]?.value || null,
          filePath: responses[q.id]?.filePath || null,
        }));

      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: responsesToSubmit,
          respondentEmail: email,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit questionnaire");

      router.push(`/projects/${project.slug}/thank-you`);
    } catch {
      toast.error("Failed to submit questionnaire. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderQuestionInput(question: Question) {
    const response = responses[question.id];

    switch (question.fieldType) {
      case "text":
        return (
          <Input
            value={response?.value || ""}
            onChange={(e) => updateResponse(question.id, e.target.value)}
            placeholder={question.placeholder || "Enter your answer..."}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={response?.value || ""}
            onChange={(e) => updateResponse(question.id, e.target.value)}
            placeholder={question.placeholder || "Enter your answer..."}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            value={response?.value || ""}
            onValueChange={(value) => updateResponse(question.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${option}`}
                  checked={response?.checkboxValues?.includes(option) || false}
                  onCheckedChange={(checked) =>
                    updateCheckboxResponse(question.id, option, checked === true)
                  }
                />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case "file":
        return (
          <div className="space-y-2">
            {response?.filePath ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm truncate flex-1">
                  {response.value || "File uploaded"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateResponse(question.id, null, null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(question.id, file);
                  }}
                  disabled={uploadingFor === question.id}
                  className="hidden"
                  id={`file-${question.id}`}
                />
                <Label
                  htmlFor={`file-${question.id}`}
                  className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingFor === question.id
                    ? "Uploading..."
                    : "Choose file"}
                </Label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Accepted: Images, PDF, Word documents (max 10MB)
            </p>
          </div>
        );

      case "date":
        return (
          <Input
            type="date"
            value={response?.value || ""}
            onChange={(e) => updateResponse(question.id, e.target.value)}
          />
        );

      case "color":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={response?.value || "#000000"}
              onChange={(e) => updateResponse(question.id, e.target.value)}
              className="w-16 h-10 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={response?.value || ""}
              onChange={(e) => updateResponse(question.id, e.target.value)}
              placeholder="#000000"
              className="w-32"
            />
          </div>
        );

      case "url":
        return (
          <Input
            type="url"
            value={response?.value || ""}
            onChange={(e) => updateResponse(question.id, e.target.value)}
            placeholder={question.placeholder || "https://example.com"}
          />
        );

      default:
        return null;
    }
  }

  function renderQuestion(question: Question) {
    return (
      <div key={question.id} className="space-y-2 p-4 rounded-lg bg-muted/30">
        <div className="flex items-start gap-2">
          <Label className="text-sm font-medium">
            {question.label}
            {question.isRequired && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
        </div>
        {question.description && (
          <p className="text-xs text-muted-foreground">{question.description}</p>
        )}
        <div className="pt-1">{renderQuestionInput(question)}</div>
      </div>
    );
  }

  if (isLoadingResponses) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading your responses...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold sm:text-xl">{project.name}</h1>
            <p className="text-xs text-muted-foreground">Questionnaire</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      {/* Progress */}
      {requiredQuestions.length > 0 && (
        <div className="border-b bg-card/50 px-4 py-2 sm:px-6 sm:py-3">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span>
                {answeredRequired.length} of {requiredQuestions.length} required
                answered
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="mt-2 h-2" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-8">
        <div className="space-y-4">
          {/* Website Questions */}
          {websiteQuestions.length > 0 && (
            <Card>
              <Collapsible
                open={openSections.has("website")}
                onOpenChange={() => toggleSection("website")}
              >
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center gap-3 hover:bg-muted/50">
                    {openSections.has("website") ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">General Questions</CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {websiteQuestions.length}
                    </Badge>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {websiteQuestions.map(renderQuestion)}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Page and Section Questions grouped by page */}
          {pages.map((page) => {
            const pageQs = pageQuestions.filter((q) => q.scopeId === page.id);
            const pageSections = sections.filter((s) => s.pageId === page.id);
            const sectionQsForPage = pageSections.flatMap((section) =>
              sectionQuestions
                .filter((q) => q.scopeId === section.id)
                .map((q) => ({ ...q, sectionName: section.name }))
            );

            if (pageQs.length === 0 && sectionQsForPage.length === 0) return null;

            return (
              <Card key={page.id}>
                <Collapsible
                  open={openSections.has(page.id)}
                  onOpenChange={() => toggleSection(page.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center gap-3 hover:bg-muted/50">
                      {openSections.has(page.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{page.name}</CardTitle>
                      <Badge variant="secondary" className="ml-auto">
                        {pageQs.length + sectionQsForPage.length}
                      </Badge>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      {/* Page-level questions */}
                      {pageQs.length > 0 && (
                        <div className="space-y-4">
                          {pageQs.map(renderQuestion)}
                        </div>
                      )}

                      {/* Section-level questions */}
                      {pageSections.map((section) => {
                        const sectionQs = sectionQuestions.filter(
                          (q) => q.scopeId === section.id
                        );
                        if (sectionQs.length === 0) return null;

                        return (
                          <div key={section.id} className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                              <Layout className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">
                                {section.name}
                              </span>
                            </div>
                            {sectionQs.map(renderQuestion)}
                          </div>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || progress < 100}
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? "Submitting..." : "Submit Responses"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
