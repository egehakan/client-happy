"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Question,
  type QuestionFieldType,
  type QuestionScopeType,
  type Page,
  type Section,
  type Screenshot,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash,
  Globe,
  FileText,
  Layout,
  X,
} from "lucide-react";

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
}

interface QuestionnaireManagerProps {
  projectId: string;
  pages: PageWithSections[];
  questions: Question[];
}

const FIELD_TYPES: { value: QuestionFieldType; label: string }[] = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Dropdown Select" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "file", label: "File Upload" },
  { value: "date", label: "Date Picker" },
  { value: "color", label: "Color Picker" },
  { value: "url", label: "URL Input" },
];

export function QuestionnaireManager({
  projectId,
  pages,
  questions,
}: QuestionnaireManagerProps) {
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["website"])
  );
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [scopeType, setScopeType] = useState<QuestionScopeType>("website");
  const [scopeId, setScopeId] = useState<string>("");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [fieldType, setFieldType] = useState<QuestionFieldType>("text");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  // Delete state
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);

  // Group questions by scope
  const websiteQuestions = questions.filter((q) => q.scopeType === "website");
  const pageQuestions = questions.filter((q) => q.scopeType === "page");
  const sectionQuestions = questions.filter((q) => q.scopeType === "section");

  function toggleSection(sectionId: string) {
    const newOpen = new Set(openSections);
    if (newOpen.has(sectionId)) {
      newOpen.delete(sectionId);
    } else {
      newOpen.add(sectionId);
    }
    setOpenSections(newOpen);
  }

  function resetForm() {
    setScopeType("website");
    setScopeId("");
    setSelectedPageId("");
    setFieldType("text");
    setLabel("");
    setDescription("");
    setPlaceholder("");
    setOptions([]);
    setNewOption("");
    setIsRequired(false);
  }

  function addOption() {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  async function handleAddQuestion() {
    if (!label.trim()) {
      toast.error("Question label is required");
      return;
    }

    if (
      (fieldType === "select" || fieldType === "checkbox") &&
      options.length === 0
    ) {
      toast.error("At least one option is required for select/checkbox fields");
      return;
    }

    if ((scopeType === "page" || scopeType === "section") && !scopeId) {
      toast.error(`Please select a ${scopeType}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scopeType,
          scopeId: scopeType === "website" ? null : scopeId,
          fieldType,
          label,
          description: description || undefined,
          placeholder: placeholder || undefined,
          options: options.length > 0 ? options : undefined,
          isRequired,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create question");
      }

      toast.success("Question added");
      resetForm();
      setIsAddingQuestion(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add question"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteQuestion) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/questions/${deleteQuestion.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Question deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete question");
    } finally {
      setIsSubmitting(false);
      setDeleteQuestion(null);
    }
  }

  function getFieldTypeIcon(type: QuestionFieldType) {
    return FIELD_TYPES.find((t) => t.value === type)?.label || type;
  }

  function renderQuestionItem(question: Question) {
    return (
      <div
        key={question.id}
        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{question.label}</span>
            {question.isRequired && (
              <Badge variant="destructive" className="text-xs">
                Required
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {getFieldTypeIcon(question.fieldType)}
            </Badge>
            {question.description && (
              <span className="text-xs text-muted-foreground truncate">
                {question.description}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => setDeleteQuestion(question)}
        >
          <Trash className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Questionnaire</CardTitle>
            <CardDescription>
              Create questions to gather information from clients
            </CardDescription>
          </div>
          <Dialog open={isAddingQuestion} onOpenChange={setIsAddingQuestion}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Question</DialogTitle>
                <DialogDescription>
                  Create a question for clients to answer
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Scope Selection */}
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select
                    value={scopeType}
                    onValueChange={(value: QuestionScopeType) => {
                      setScopeType(value);
                      setScopeId("");
                      setSelectedPageId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Entire Website
                        </div>
                      </SelectItem>
                      <SelectItem value="page">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Specific Page
                        </div>
                      </SelectItem>
                      <SelectItem value="section">
                        <div className="flex items-center gap-2">
                          <Layout className="h-4 w-4" />
                          Specific Section
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Selection (for page or section scope) */}
                {(scopeType === "page" || scopeType === "section") && (
                  <div className="space-y-2">
                    <Label>Page</Label>
                    <Select
                      value={scopeType === "page" ? scopeId : selectedPageId}
                      onValueChange={(value) => {
                        if (scopeType === "page") {
                          setScopeId(value);
                        } else {
                          setSelectedPageId(value);
                          setScopeId("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a page" />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>
                            {page.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Section Selection (for section scope) */}
                {scopeType === "section" && selectedPageId && (
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select value={scopeId} onValueChange={setScopeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {pages
                          .find((p) => p.id === selectedPageId)
                          ?.sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Field Type */}
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={fieldType}
                    onValueChange={(value: QuestionFieldType) =>
                      setFieldType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Label */}
                <div className="space-y-2">
                  <Label>Question Label *</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., What colors do you prefer?"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional context or instructions"
                    rows={2}
                  />
                </div>

                {/* Placeholder (for text inputs) */}
                {(fieldType === "text" ||
                  fieldType === "textarea" ||
                  fieldType === "url") && (
                  <div className="space-y-2">
                    <Label>Placeholder (Optional)</Label>
                    <Input
                      value={placeholder}
                      onChange={(e) => setPlaceholder(e.target.value)}
                      placeholder="e.g., Enter your answer..."
                    />
                  </div>
                )}

                {/* Options (for select/checkbox) */}
                {(fieldType === "select" || fieldType === "checkbox") && (
                  <div className="space-y-2">
                    <Label>Options *</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        placeholder="Add an option"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addOption();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addOption}
                      >
                        Add
                      </Button>
                    </div>
                    {options.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {options.map((option, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="gap-1"
                          >
                            {option}
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Required */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRequired"
                    checked={isRequired}
                    onCheckedChange={(checked) =>
                      setIsRequired(checked === true)
                    }
                  />
                  <Label htmlFor="isRequired" className="cursor-pointer">
                    Required field
                  </Label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsAddingQuestion(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddQuestion} disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Question"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No questions yet</p>
              <p className="text-sm text-muted-foreground">
                Add questions to gather information from clients
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Website-level questions */}
              <Collapsible
                open={openSections.has("website")}
                onOpenChange={() => toggleSection("website")}
              >
                <div className="rounded-lg border">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <CollapsibleTrigger className="flex flex-1 items-center gap-3">
                      {openSections.has("website") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Website</span>
                      <Badge variant="secondary">
                        {websiteQuestions.length} questions
                      </Badge>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 space-y-2">
                      {websiteQuestions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No website-level questions
                        </p>
                      ) : (
                        websiteQuestions.map(renderQuestionItem)
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Page-level questions */}
              {pages.map((page) => {
                const pageQs = pageQuestions.filter(
                  (q) => q.scopeId === page.id
                );
                const pageSectionQs = page.sections.map((section) => ({
                  section,
                  questions: sectionQuestions.filter(
                    (q) => q.scopeId === section.id
                  ),
                }));
                const totalQs =
                  pageQs.length +
                  pageSectionQs.reduce((sum, s) => sum + s.questions.length, 0);

                if (totalQs === 0) return null;

                return (
                  <Collapsible
                    key={page.id}
                    open={openSections.has(page.id)}
                    onOpenChange={() => toggleSection(page.id)}
                  >
                    <div className="rounded-lg border">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <CollapsibleTrigger className="flex flex-1 items-center gap-3">
                          {openSections.has(page.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{page.name}</span>
                          <Badge variant="secondary">{totalQs} questions</Badge>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 space-y-4">
                          {/* Page questions */}
                          {pageQs.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Page Questions
                              </p>
                              {pageQs.map(renderQuestionItem)}
                            </div>
                          )}

                          {/* Section questions */}
                          {pageSectionQs.map(({ section, questions: sectionQs }) =>
                            sectionQs.length > 0 ? (
                              <div key={section.id} className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                  <Layout className="h-3 w-3" />
                                  {section.name}
                                </p>
                                {sectionQs.map(renderQuestionItem)}
                              </div>
                            ) : null
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteQuestion !== null}
        onOpenChange={() => setDeleteQuestion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteQuestion?.label}&quot;
              and all its responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
