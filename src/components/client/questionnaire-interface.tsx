"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  type Project,
  type Question,
  type QuestionResponse,
  type QuestionGroup,
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
  ArrowLeft,
  Upload,
  X,
  Folder,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

interface QuestionWithContext extends Question {
  pageName?: string;
  sectionName?: string;
}

interface QuestionnaireInterfaceProps {
  project: Project;
  questions: QuestionWithContext[];
  questionGroups: QuestionGroup[];
  pages: Page[];
  sections: Section[];
  email: string;
  onBack: () => void;
}

interface UploadedFile {
  name: string;
  path: string;
}

interface ResponseState {
  [questionId: string]: {
    value: string | null;
    filePath: string | null;
    checkboxValues?: string[];
    files?: UploadedFile[];
  };
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY = 1000; // 1 second debounce

export function QuestionnaireInterface({
  project,
  questions,
  questionGroups,
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
  const [dragOverFor, setDragOverFor] = useState<string | null>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const pendingChangesRef = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Group questions by scope
  const websiteQuestions = questions.filter((q) => q.scopeType === "website");
  const pageQuestions = questions.filter((q) => q.scopeType === "page");
  const sectionQuestions = questions.filter((q) => q.scopeType === "section");

  // Helper to get questions for a group (sorted by sortOrder)
  function getQuestionsForGroup(groupId: string | null, scopeType?: string, scopeId?: string | null) {
    return questions
      .filter((q) => {
        if (q.groupId !== groupId) return false;
        if (scopeType !== undefined && q.scopeType !== scopeType) return false;
        if (scopeId !== undefined && q.scopeId !== scopeId) return false;
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Helper to get groups for a scope (sorted by sortOrder)
  function getGroupsForScope(scopeType: string, scopeId: string | null) {
    return questionGroups
      .filter(g =>
        g.scopeType === scopeType &&
        (scopeId === null ? g.scopeId === null : g.scopeId === scopeId)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Sort pages and sections by sortOrder
  const sortedPages = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
  const getSortedSections = (pageId: string) =>
    sections.filter(s => s.pageId === pageId).sort((a, b) => a.sortOrder - b.sortOrder);

  // Check if we're using scoped groups (new style) vs flat groups
  const hasNewScopedGroups = questionGroups.some(g => g.scopeType !== null);

  // Calculate progress
  const requiredQuestions = questions.filter((q) => q.isRequired);
  const answeredRequired = requiredQuestions.filter((q) => {
    const resp = responses[q.id];
    if (!resp) return false;
    // For file questions, check if any files uploaded
    if (q.fieldType === "file") {
      return resp.files && resp.files.length > 0;
    }
    return resp.value || resp.filePath;
  });
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
            } else if (question?.fieldType === "file" && resp.filePath) {
              // Parse file paths as JSON array for multiple files
              try {
                const filePaths = JSON.parse(resp.filePath);
                const fileNames = resp.value ? JSON.parse(resp.value) : [];
                const files: UploadedFile[] = Array.isArray(filePaths)
                  ? filePaths.map((path: string, i: number) => ({
                    name: fileNames[i] || `File ${i + 1}`,
                    path,
                  }))
                  : [{ name: resp.value || "File", path: resp.filePath }];
                responseState[resp.questionId] = {
                  value: resp.value,
                  filePath: resp.filePath,
                  files,
                };
              } catch {
                // Single file (legacy format)
                responseState[resp.questionId] = {
                  value: resp.value,
                  filePath: resp.filePath,
                  files: [{ name: resp.value || "File", path: resp.filePath }],
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
        // Mark initial load as complete after a brief delay
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    }

    fetchResponses();
  }, [email, questions]);

  // Auto-save function
  const saveResponses = useCallback(async (responsesToSave: ResponseState, questionIds: string[]) => {
    if (questionIds.length === 0) return;

    setSaveStatus("saving");

    try {
      const responsesPayload = questionIds
        .filter((qId) => {
          const resp = responsesToSave[qId];
          return resp && (resp.value !== null || resp.filePath !== null);
        })
        .map((qId) => ({
          questionId: qId,
          value: responsesToSave[qId]?.value || null,
          filePath: responsesToSave[qId]?.filePath || null,
        }));

      if (responsesPayload.length === 0) {
        setSaveStatus("saved");
        return;
      }

      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: responsesPayload,
          respondentEmail: email,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setSaveStatus("saved");

      // Clear saved questions from pending
      questionIds.forEach((qId) => pendingChangesRef.current.delete(qId));
    } catch (err) {
      console.error("Auto-save failed:", err);
      setSaveStatus("error");
      toast.error("Failed to save changes. Will retry...");

      // Retry after 3 seconds
      setTimeout(() => {
        if (pendingChangesRef.current.size > 0) {
          triggerAutoSave();
        }
      }, 3000);
    }
  }, [email]);

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const questionIds = Array.from(pendingChangesRef.current);
      if (questionIds.length > 0) {
        setResponses((current) => {
          saveResponses(current, questionIds);
          return current;
        });
      }
    }, AUTOSAVE_DELAY);
  }, [saveResponses]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChangesRef.current.size > 0) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
    filePath?: string | null,
    skipAutoSave?: boolean
  ) {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        value,
        filePath: filePath !== undefined ? filePath : prev[questionId]?.filePath || null,
      },
    }));

    // Trigger auto-save (unless skipped or during initial load)
    if (!skipAutoSave && !isInitialLoadRef.current) {
      pendingChangesRef.current.add(questionId);
      triggerAutoSave();
    }
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

    // Trigger auto-save
    if (!isInitialLoadRef.current) {
      pendingChangesRef.current.add(questionId);
      triggerAutoSave();
    }
  }

  async function handleFileUpload(questionId: string, file: File, maxFiles: number) {
    // Check current files count using a ref-like pattern via promise
    const currentFilesCount = responses[questionId]?.files?.length || 0;
    if (currentFilesCount >= maxFiles) {
      toast.error(`Maximum ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`);
      return;
    }

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
      const newFile: UploadedFile = { name: file.name, path: filePath };

      // Use functional update to get latest state
      setResponses((prev) => {
        const currentFiles = prev[questionId]?.files || [];
        // Double-check we haven't exceeded max while upload was in progress
        if (currentFiles.length >= maxFiles) {
          return prev;
        }
        const updatedFiles = [...currentFiles, newFile];
        return {
          ...prev,
          [questionId]: {
            ...prev[questionId],
            value: JSON.stringify(updatedFiles.map((f) => f.name)),
            filePath: JSON.stringify(updatedFiles.map((f) => f.path)),
            files: updatedFiles,
          },
        };
      });

      // Trigger auto-save immediately for file uploads
      pendingChangesRef.current.add(questionId);
      triggerAutoSave();

      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingFor(null);
    }
  }

  function removeFile(questionId: string, fileIndex: number) {
    setResponses((prev) => {
      const currentFiles = prev[questionId]?.files || [];
      const updatedFiles = currentFiles.filter((_, i) => i !== fileIndex);

      if (updatedFiles.length === 0) {
        return {
          ...prev,
          [questionId]: {
            ...prev[questionId],
            value: null,
            filePath: null,
            files: [],
          },
        };
      }

      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          value: JSON.stringify(updatedFiles.map((f) => f.name)),
          filePath: JSON.stringify(updatedFiles.map((f) => f.path)),
          files: updatedFiles,
        },
      };
    });

    // Trigger auto-save
    pendingChangesRef.current.add(questionId);
    triggerAutoSave();
  }

  async function handleComplete() {
    // Check required fields
    const missingRequired = requiredQuestions.filter((q) => {
      const resp = responses[q.id];
      if (!resp) return true;
      // For file questions, check if any files uploaded
      if (q.fieldType === "file") {
        return !resp.files || resp.files.length === 0;
      }
      return !resp.value && !resp.filePath;
    });

    if (missingRequired.length > 0) {
      toast.error(
        `Please answer all required questions (${missingRequired.length} remaining)`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Save any pending changes before completing
      if (pendingChangesRef.current.size > 0) {
        const questionIds = Array.from(pendingChangesRef.current);
        await saveResponses(responses, questionIds);
      }

      // Wait a moment to ensure save completes
      await new Promise((resolve) => setTimeout(resolve, 500));

      router.push(`/projects/${project.slug}/thank-you`);
    } catch {
      toast.error("Failed to save. Please try again.");
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

      case "file": {
        const files = response?.files || [];
        const maxFiles = question.maxFileCount || 1;
        const canUploadMore = files.length < maxFiles;
        const remainingSlots = maxFiles - files.length;
        const isDragOver = dragOverFor === question.id;

        const handleDragOver = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (canUploadMore && uploadingFor !== question.id) {
            setDragOverFor(question.id);
          }
        };

        const handleDragLeave = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFor(null);
        };

        const handleDrop = async (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFor(null);

          if (!canUploadMore || uploadingFor === question.id) return;

          const droppedFiles = Array.from(e.dataTransfer.files);
          if (droppedFiles.length > 0) {
            // Upload files sequentially to avoid race conditions
            const filesToUpload = droppedFiles.slice(0, remainingSlots);
            for (const file of filesToUpload) {
              await handleFileUpload(question.id, file, maxFiles);
            }
          }
        };

        return (
          <div className="space-y-2">
            {/* Uploaded files list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name) ||
                    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.path);

                  return (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-muted rounded-md"
                    >
                      {isImage ? (
                        <div className="flex-1 space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.path}
                            alt={file.name}
                            className="max-h-32 rounded border object-contain"
                          />
                          <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                        </div>
                      ) : (
                        <span className="text-sm truncate flex-1">{file.name}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeFile(question.id, index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Drop zone / Upload button */}
            {canUploadMore && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
              >
                <Input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  multiple={maxFiles > 1}
                  onChange={async (e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    const filesToUpload = selectedFiles.slice(0, remainingSlots);
                    for (const file of filesToUpload) {
                      await handleFileUpload(question.id, file, maxFiles);
                    }
                    e.target.value = "";
                  }}
                  disabled={uploadingFor === question.id}
                  className="hidden"
                  id={`file-${question.id}`}
                />
                <Label
                  htmlFor={`file-${question.id}`}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <Upload className={`h-8 w-8 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                  {uploadingFor === question.id ? (
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  ) : isDragOver ? (
                    <span className="text-sm text-primary font-medium">Drop files here</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium">
                        {files.length > 0 ? "Add more files" : "Drop files here or click to upload"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Images, PDF, Word documents (max 30MB)
                      </span>
                    </>
                  )}
                </Label>
              </div>
            )}

            {maxFiles > 1 && (
              <p className="text-xs text-muted-foreground">
                {files.length} of {maxFiles} files uploaded
                {canUploadMore && ` (${remainingSlots} remaining)`}
              </p>
            )}
          </div>
        );
      }

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
      <header className="sticky top-0 z-50 border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 flex-shrink-0"
              title="Back to selection"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold sm:text-xl">{project.name}</h1>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {/* Auto-save status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span className="hidden sm:inline">Saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="hidden sm:inline">Error</span>
                </>
              )}
            </div>
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
          {hasNewScopedGroups ? (
            <>
              {/* Scoped groups display - Website */}
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
                        <CardTitle className="text-base">Website</CardTitle>
                        <Badge variant="secondary" className="ml-auto">
                          {websiteQuestions.length}
                        </Badge>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-6 pt-2">
                        {/* Groups within website scope */}
                        {getGroupsForScope("website", null).map((group) => {
                          const groupQuestions = getQuestionsForGroup(group.id, "website", null);
                          if (groupQuestions.length === 0) return null;
                          return (
                            <div key={group.id} className="space-y-3 p-3 rounded-lg border bg-muted/20">
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{group.name}</span>
                                {group.description && (
                                  <span className="text-xs text-muted-foreground">- {group.description}</span>
                                )}
                              </div>
                              <div className="space-y-4">
                                {groupQuestions.map(renderQuestion)}
                              </div>
                            </div>
                          );
                        })}
                        {/* Ungrouped website questions */}
                        {getQuestionsForGroup(null, "website", null).map(renderQuestion)}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {/* Page and Section scopes (sorted) */}
              {sortedPages.map((page) => {
                const pageQs = pageQuestions.filter((q) => q.scopeId === page.id);
                const pageSections = getSortedSections(page.id);
                const sectionQsForPage = pageSections.flatMap((section) =>
                  sectionQuestions.filter((q) => q.scopeId === section.id)
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
                        <CardContent className="space-y-6 pt-2">
                          {/* Section-level questions first (sorted by sortOrder) */}
                          {pageSections.map((section) => {
                            const sectionQs = sectionQuestions.filter((q) => q.scopeId === section.id);
                            if (sectionQs.length === 0) return null;

                            return (
                              <div key={section.id} className="space-y-4">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <Layout className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {section.name}
                                  </span>
                                </div>
                                {/* Groups within section scope */}
                                {getGroupsForScope("section", section.id).map((group) => {
                                  const groupQuestions = getQuestionsForGroup(group.id, "section", section.id);
                                  if (groupQuestions.length === 0) return null;
                                  return (
                                    <div key={group.id} className="space-y-3 p-3 rounded-lg border bg-muted/20">
                                      <div className="flex items-center gap-2">
                                        <Folder className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium text-sm">{group.name}</span>
                                        {group.description && (
                                          <span className="text-xs text-muted-foreground">- {group.description}</span>
                                        )}
                                      </div>
                                      <div className="space-y-4">
                                        {groupQuestions.map(renderQuestion)}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Ungrouped section questions */}
                                {getQuestionsForGroup(null, "section", section.id).map(renderQuestion)}
                              </div>
                            );
                          })}

                          {/* Page-level groups (after sections) */}
                          {getGroupsForScope("page", page.id).map((group) => {
                            const groupQuestions = getQuestionsForGroup(group.id, "page", page.id);
                            if (groupQuestions.length === 0) return null;
                            return (
                              <div key={group.id} className="space-y-3 p-3 rounded-lg border bg-muted/20">
                                <div className="flex items-center gap-2">
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">{group.name}</span>
                                  {group.description && (
                                    <span className="text-xs text-muted-foreground">- {group.description}</span>
                                  )}
                                </div>
                                <div className="space-y-4">
                                  {groupQuestions.map(renderQuestion)}
                                </div>
                              </div>
                            );
                          })}

                          {/* Ungrouped page questions (after sections and groups) */}
                          {getQuestionsForGroup(null, "page", page.id).map(renderQuestion)}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </>
          ) : (
            <>
              {/* Legacy scope-based display */}
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
                      <CardContent className="space-y-4 pt-2">
                        {websiteQuestions.map(renderQuestion)}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {/* Page and Section Questions grouped by page (sorted) */}
              {sortedPages.map((page) => {
                const pageQs = pageQuestions.filter((q) => q.scopeId === page.id);
                const pageSections = getSortedSections(page.id);
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
                        <CardContent className="space-y-6 pt-2">
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
            </>
          )}

          {/* Complete Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleComplete}
              disabled={isSubmitting || progress < 100 || saveStatus === "saving"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Complete Questionnaire
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
