"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Question,
  type QuestionFieldType,
  type QuestionScopeType,
  type QuestionGroup,
  type GroupScopeType,
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
  Pencil,
  Trash2,
  FolderPlus,
  Folder,
  GripVertical,
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
  questionGroups: QuestionGroup[];
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

interface SortableQuestionItemProps {
  question: Question;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getFieldTypeIcon: (type: QuestionFieldType) => string;
}

function SortableQuestionItem({
  question,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  getFieldTypeIcon,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: isSelectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 ${isSelectionMode ? "cursor-pointer hover:bg-muted" : ""
        } ${isSelected ? "ring-2 ring-primary bg-primary/10" : ""}`}
      onClick={isSelectionMode ? onToggleSelect : undefined}
    >
      {isSelectionMode ? (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${question.label}`}
        />
      ) : (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{question.label}</span>
          {question.isRequired && (
            <Badge variant="destructive" className="text-xs">
              Required
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {getFieldTypeIcon(question.fieldType)}
          </Badge>
          {question.fieldType === "file" && question.maxFileCount > 1 && (
            <Badge variant="secondary" className="text-xs">
              Up to {question.maxFileCount} files
            </Badge>
          )}
          {question.description && (
            <span className="text-xs text-muted-foreground truncate">
              {question.description}
            </span>
          )}
        </div>
      </div>
      {!isSelectionMode && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDelete}
          >
            <Trash className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionDragOverlay({ question, getFieldTypeIcon }: { question: Question; getFieldTypeIcon: (type: QuestionFieldType) => string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background border shadow-lg px-3 py-2">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{question.label}</span>
          {question.isRequired && (
            <Badge variant="destructive" className="text-xs">
              Required
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="text-xs mt-1">
          {getFieldTypeIcon(question.fieldType)}
        </Badge>
      </div>
    </div>
  );
}

// Droppable container for groups
interface DroppableGroupProps {
  groupId: string;
  scopeType: GroupScopeType;
  scopeId: string | null;
  isOver: boolean;
  children: React.ReactNode;
}

function DroppableGroup({ groupId, scopeType, scopeId, isOver, children }: DroppableGroupProps) {
  const { setNodeRef } = useDroppable({
    id: `group-${groupId}`,
    data: { type: "group", groupId, scopeType, scopeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 transition-colors ${isOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

// Droppable container for ungrouped questions in a scope
interface DroppableUngroupedProps {
  scopeType: GroupScopeType;
  scopeId: string | null;
  isOver: boolean;
  children: React.ReactNode;
  hasGroups: boolean;
}

function DroppableUngrouped({ scopeType, scopeId, isOver, children, hasGroups }: DroppableUngroupedProps) {
  const { setNodeRef } = useDroppable({
    id: `ungrouped-${scopeType}-${scopeId ?? "null"}`,
    data: { type: "ungrouped", groupId: null, scopeType, scopeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[40px] rounded-lg p-2 transition-colors ${isOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

// Drag handle props type for render props pattern
interface DragHandleProps {
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: React.DOMAttributes<HTMLElement> | undefined;
}

// Sortable page item - returns drag handle props to be used in header
interface SortablePageItemProps {
  page: Page;
  children: (dragHandleProps: DragHandleProps | null) => React.ReactNode;
  isSelectionMode: boolean;
}

function SortablePageItem({ page, children, isSelectionMode }: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-page-${page.id}`, disabled: isSelectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandleProps: DragHandleProps | null = !isSelectionMode
    ? { attributes: attributes as React.HTMLAttributes<HTMLElement>, listeners }
    : null;

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}

// Sortable section item - returns drag handle props to be used in header
interface SortableSectionItemProps {
  section: Section;
  children: (dragHandleProps: DragHandleProps | null) => React.ReactNode;
  isSelectionMode: boolean;
}

function SortableSectionItem({ section, children, isSelectionMode }: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-section-${section.id}`, disabled: isSelectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandleProps: DragHandleProps | null = !isSelectionMode
    ? { attributes: attributes as React.HTMLAttributes<HTMLElement>, listeners }
    : null;

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}

// Sortable group item - returns drag handle props to be used in header
interface SortableGroupItemProps {
  group: QuestionGroup;
  children: (dragHandleProps: DragHandleProps | null) => React.ReactNode;
  isSelectionMode: boolean;
}

function SortableGroupItem({ group, children, isSelectionMode }: SortableGroupItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-group-${group.id}`, disabled: isSelectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandleProps: DragHandleProps | null = !isSelectionMode
    ? { attributes: attributes as React.HTMLAttributes<HTMLElement>, listeners }
    : null;

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}

export function QuestionnaireManager({
  projectId,
  pages: initialPages,
  questions: initialQuestions,
  questionGroups: initialQuestionGroups,
}: QuestionnaireManagerProps) {
  const router = useRouter();

  // Local state for optimistic updates
  const [localPages, setLocalPages] = useState<PageWithSections[]>(initialPages);
  const [localQuestions, setLocalQuestions] = useState<Question[]>(initialQuestions);
  const [localGroups, setLocalGroups] = useState<QuestionGroup[]>(initialQuestionGroups);

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
  const [maxFileCount, setMaxFileCount] = useState(1);

  // Delete state
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Group management state
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [addingGroupForScope, setAddingGroupForScope] = useState<{ type: GroupScopeType; id: string | null } | null>(null);
  const [editingGroup, setEditingGroup] = useState<QuestionGroup | null>(null);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<QuestionGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  // Question group assignment (for add/edit question dialogs)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Edit scope state (for changing question scope in edit dialog)
  const [editScopeType, setEditScopeType] = useState<QuestionScopeType>("website");
  const [editScopeId, setEditScopeId] = useState<string | null>(null);
  const [editSelectedPageId, setEditSelectedPageId] = useState<string>("");
  const [editGroupId, setEditGroupId] = useState<string | null>(null);

  // Batch add to group state
  const [showBatchAddToGroupDialog, setShowBatchAddToGroupDialog] = useState(false);
  const [batchAddGroupId, setBatchAddGroupId] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to get questions by scope
  const getQuestionsForScope = useCallback((scopeType: GroupScopeType, scopeId: string | null) => {
    return localQuestions.filter(q =>
      q.scopeType === scopeType &&
      (scopeId === null ? q.scopeId === null : q.scopeId === scopeId)
    );
  }, [localQuestions]);

  // Helper to get groups by scope
  const getGroupsForScope = useCallback((scopeType: GroupScopeType, scopeId: string | null) => {
    return localGroups.filter(g =>
      g.scopeType === scopeType &&
      (scopeId === null ? g.scopeId === null : g.scopeId === scopeId)
    );
  }, [localGroups]);

  // Get questions for a specific group (or ungrouped within a scope)
  const getQuestionsForGroup = useCallback((groupId: string | null, scopeType: GroupScopeType, scopeId: string | null) => {
    return localQuestions
      .filter(q =>
        q.groupId === groupId &&
        q.scopeType === scopeType &&
        (scopeId === null ? q.scopeId === null : q.scopeId === scopeId)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [localQuestions]);

  // Get all question IDs for a scope (for DndContext)
  const getQuestionIdsForScope = useCallback((scopeType: GroupScopeType, scopeId: string | null) => {
    return getQuestionsForScope(scopeType, scopeId).map(q => q.id);
  }, [getQuestionsForScope]);

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
    setSelectedGroupId(null);
    setFieldType("text");
    setLabel("");
    setDescription("");
    setPlaceholder("");
    setOptions([]);
    setNewOption("");
    setIsRequired(false);
    setMaxFileCount(1);
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

  // Multi-select functions
  function toggleQuestionSelection(questionId: string) {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  }

  function selectAllQuestions() {
    setSelectedQuestions(new Set(localQuestions.map((q) => q.id)));
  }

  function deselectAllQuestions() {
    setSelectedQuestions(new Set());
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedQuestions(new Set());
  }

  async function handleBatchDelete() {
    if (selectedQuestions.size === 0) return;

    const questionIds = Array.from(selectedQuestions);

    // Optimistic update
    const previousQuestions = localQuestions;
    setLocalQuestions(prev => prev.filter(q => !selectedQuestions.has(q.id)));

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/questions/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds }),
      });

      if (!response.ok) {
        // Revert on error
        setLocalQuestions(previousQuestions);
        const data = await response.json();
        throw new Error(data.error || "Failed to delete questions");
      }

      toast.success(`${selectedQuestions.size} question(s) deleted`);
      exitSelectionMode();
      setShowBatchDeleteDialog(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete questions"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBatchAddToGroup() {
    if (selectedQuestions.size === 0 || !batchAddGroupId) return;

    const questionIds = Array.from(selectedQuestions);

    // Optimistic update
    const previousQuestions = localQuestions;
    setLocalQuestions(prev => prev.map(q =>
      selectedQuestions.has(q.id) ? { ...q, groupId: batchAddGroupId } : q
    ));

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/questions/batch-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds, groupId: batchAddGroupId }),
      });

      if (!response.ok) {
        // Revert on error
        setLocalQuestions(previousQuestions);
        const data = await response.json();
        throw new Error(data.error || "Failed to add questions to group");
      }

      toast.success(`${selectedQuestions.size} question(s) added to group`);
      exitSelectionMode();
      setShowBatchAddToGroupDialog(false);
      setBatchAddGroupId("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add questions to group"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Edit functions
  function openEditDialog(question: Question) {
    setEditingQuestion(question);
    setFieldType(question.fieldType);
    setLabel(question.label);
    setDescription(question.description || "");
    setPlaceholder(question.placeholder || "");
    setOptions(question.options || []);
    setIsRequired(question.isRequired);
    setMaxFileCount(question.maxFileCount);
    // Set scope editing state
    setEditScopeType(question.scopeType);
    setEditScopeId(question.scopeId);
    setEditGroupId(question.groupId);
    // Set selected page for section scope
    if (question.scopeType === "section" && question.scopeId) {
      const section = localPages.flatMap(p => p.sections).find(s => s.id === question.scopeId);
      if (section) {
        setEditSelectedPageId(section.pageId);
      }
    } else if (question.scopeType === "page" && question.scopeId) {
      setEditSelectedPageId(question.scopeId);
    } else {
      setEditSelectedPageId("");
    }
    setIsEditDialogOpen(true);
  }

  function closeEditDialog() {
    setEditingQuestion(null);
    setIsEditDialogOpen(false);
    resetForm();
    // Reset edit scope state
    setEditScopeType("website");
    setEditScopeId(null);
    setEditSelectedPageId("");
    setEditGroupId(null);
  }

  async function handleEditQuestion() {
    if (!editingQuestion) return;

    if (!label.trim()) {
      toast.error("Question label is required");
      return;
    }

    if (
      (editingQuestion.fieldType === "select" || editingQuestion.fieldType === "checkbox") &&
      options.length === 0
    ) {
      toast.error("At least one option is required for select/checkbox fields");
      return;
    }

    // Validate scope selection
    if ((editScopeType === "page" || editScopeType === "section") && !editScopeId) {
      toast.error(`Please select a ${editScopeType}`);
      return;
    }

    const newScopeId = editScopeType === "website" ? null : editScopeId;

    // Optimistic update
    const previousQuestions = localQuestions;
    setLocalQuestions(prev => prev.map(q =>
      q.id === editingQuestion.id
        ? {
          ...q,
          label,
          description: description || null,
          placeholder: placeholder || null,
          options: options.length > 0 ? options : null,
          isRequired,
          maxFileCount,
          scopeType: editScopeType,
          scopeId: newScopeId,
          groupId: editGroupId,
        }
        : q
    ));

    setIsSubmitting(true);
    try {
      // First update basic fields via PATCH
      const response = await fetch(`/api/questions/${editingQuestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description: description || null,
          placeholder: placeholder || null,
          options: options.length > 0 ? options : null,
          isRequired,
          maxFileCount: editingQuestion.fieldType === "file" ? maxFileCount : 1,
        }),
      });

      if (!response.ok) {
        setLocalQuestions(previousQuestions);
        const data = await response.json();
        throw new Error(data.error || "Failed to update question");
      }

      // If scope or group changed, use reorder API to update them
      const scopeChanged = editScopeType !== editingQuestion.scopeType || newScopeId !== editingQuestion.scopeId;
      const groupChanged = editGroupId !== editingQuestion.groupId;

      if (scopeChanged || groupChanged) {
        const reorderResponse = await fetch("/api/questions/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionOrders: [{
              id: editingQuestion.id,
              sortOrder: editingQuestion.sortOrder,
              groupId: editGroupId,
              scopeType: editScopeType,
              scopeId: newScopeId,
            }],
          }),
        });

        if (!reorderResponse.ok) {
          // Still consider it a partial success
          toast.success("Question updated (scope change may have failed)");
          closeEditDialog();
          router.refresh();
          return;
        }
      }

      toast.success("Question updated");
      closeEditDialog();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update question"
      );
    } finally {
      setIsSubmitting(false);
    }
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
          groupId: selectedGroupId,
          scopeType,
          scopeId: scopeType === "website" ? null : scopeId,
          fieldType,
          label,
          description: description || undefined,
          placeholder: placeholder || undefined,
          options: options.length > 0 ? options : undefined,
          isRequired,
          maxFileCount: fieldType === "file" ? maxFileCount : 1,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create question");
      }

      const newQuestion = await response.json();
      setLocalQuestions(prev => [...prev, newQuestion]);

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

    // Optimistic update
    const previousQuestions = localQuestions;
    setLocalQuestions(prev => prev.filter(q => q.id !== deleteQuestion.id));

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/questions/${deleteQuestion.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setLocalQuestions(previousQuestions);
        throw new Error("Failed to delete");
      }

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

  // Group management functions
  function resetGroupForm() {
    setGroupName("");
    setGroupDescription("");
  }

  function openAddGroupDialog(scopeType: GroupScopeType, scopeId: string | null) {
    setAddingGroupForScope({ type: scopeType, id: scopeId });
    setIsAddingGroup(true);
  }

  async function handleAddGroup() {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (!addingGroupForScope) {
      toast.error("Scope information missing");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/question-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: groupName,
          description: groupDescription || undefined,
          scopeType: addingGroupForScope.type,
          scopeId: addingGroupForScope.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create group");
      }

      const newGroup = await response.json();
      setLocalGroups(prev => [...prev, newGroup]);

      toast.success("Group created");
      resetGroupForm();
      setIsAddingGroup(false);
      setAddingGroupForScope(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditGroupDialog(group: QuestionGroup) {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setIsEditGroupDialogOpen(true);
  }

  function closeEditGroupDialog() {
    setEditingGroup(null);
    setIsEditGroupDialogOpen(false);
    resetGroupForm();
  }

  async function handleEditGroup() {
    if (!editingGroup) return;

    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    // Optimistic update
    const previousGroups = localGroups;
    setLocalGroups(prev => prev.map(g =>
      g.id === editingGroup.id ? { ...g, name: groupName, description: groupDescription || null } : g
    ));

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/question-groups/${editingGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          description: groupDescription || null,
        }),
      });

      if (!response.ok) {
        setLocalGroups(previousGroups);
        const data = await response.json();
        throw new Error(data.error || "Failed to update group");
      }

      toast.success("Group updated");
      closeEditGroupDialog();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteGroup() {
    if (!deleteGroup) return;

    // Optimistic update - remove group and unset groupId from questions
    const previousGroups = localGroups;
    const previousQuestions = localQuestions;
    setLocalGroups(prev => prev.filter(g => g.id !== deleteGroup.id));
    setLocalQuestions(prev => prev.map(q =>
      q.groupId === deleteGroup.id ? { ...q, groupId: null } : q
    ));

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/question-groups/${deleteGroup.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setLocalGroups(previousGroups);
        setLocalQuestions(previousQuestions);
        throw new Error("Failed to delete group");
      }

      toast.success("Group deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete group");
    } finally {
      setIsSubmitting(false);
      setDeleteGroup(null);
    }
  }

  // Drag and drop handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    setOverId(over ? String(over.id) : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Handle page reordering
    if (activeIdStr.startsWith("sortable-page-")) {
      const pageId = activeIdStr.replace("sortable-page-", "");
      const overPageId = overIdStr.replace("sortable-page-", "");

      if (activeIdStr === overIdStr) return;
      if (!overIdStr.startsWith("sortable-page-")) return;

      const sortedPages = [...localPages].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = sortedPages.findIndex(p => p.id === pageId);
      const newIndex = sortedPages.findIndex(p => p.id === overPageId);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedPages = arrayMove(sortedPages, oldIndex, newIndex);
      const updates = reorderedPages.map((p, index) => ({ id: p.id, sortOrder: index }));

      // Optimistic update
      const previousPages = localPages;
      setLocalPages(reorderedPages.map((p, index) => ({ ...p, sortOrder: index })));

      try {
        const response = await fetch("/api/pages/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageOrders: updates }),
        });

        if (!response.ok) {
          setLocalPages(previousPages);
          throw new Error("Failed to reorder pages");
        }

        router.refresh();
      } catch {
        toast.error("Failed to reorder pages");
      }
      return;
    }

    // Handle section reordering
    if (activeIdStr.startsWith("sortable-section-")) {
      const sectionId = activeIdStr.replace("sortable-section-", "");

      // Try to get the target section ID - could be sortable-section-* or section-* (from collapsible key)
      let overSectionId = "";
      if (overIdStr.startsWith("sortable-section-")) {
        overSectionId = overIdStr.replace("sortable-section-", "");
      } else if (overIdStr.startsWith("section-")) {
        overSectionId = overIdStr.replace("section-", "");
      } else {
        // Check if we're over any element that belongs to a section
        // Try to find from data
        const overData = over.data?.current;
        if (overData && typeof overData === 'object' && 'sortable' in overData) {
          const sortableData = overData as { sortable?: { containerId?: string } };
          if (sortableData.sortable?.containerId) {
            const containerId = sortableData.sortable.containerId;
            if (containerId.includes("section")) {
              // Extract section ID from container
              const match = containerId.match(/section[s]?-([a-zA-Z0-9_-]+)/);
              if (match) overSectionId = match[1];
            }
          }
        }
        if (!overSectionId) return;
      }

      if (sectionId === overSectionId) return;

      // Find which page the section belongs to
      const parentPage = localPages.find(p => p.sections.some(s => s.id === sectionId));
      if (!parentPage) return;

      // Verify the target section is in the same page
      if (!parentPage.sections.some(s => s.id === overSectionId)) return;

      const sortedSections = [...parentPage.sections].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = sortedSections.findIndex(s => s.id === sectionId);
      const newIndex = sortedSections.findIndex(s => s.id === overSectionId);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedSections = arrayMove(sortedSections, oldIndex, newIndex);
      const updates = reorderedSections.map((s, index) => ({ id: s.id, sortOrder: index }));

      // Optimistic update
      const previousPages = localPages;
      setLocalPages(prev => prev.map(p =>
        p.id === parentPage.id
          ? { ...p, sections: reorderedSections.map((s, index) => ({ ...s, sortOrder: index })) }
          : p
      ));

      try {
        const response = await fetch("/api/sections/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionOrders: updates }),
        });

        if (!response.ok) {
          setLocalPages(previousPages);
          throw new Error("Failed to reorder sections");
        }

        router.refresh();
      } catch {
        toast.error("Failed to reorder sections");
      }
      return;
    }

    // Handle group reordering
    if (activeIdStr.startsWith("sortable-group-")) {
      const groupId = activeIdStr.replace("sortable-group-", "");

      // Try to get the target group ID - could be sortable-group-*, group-* (from droppable or collapsible key)
      let overGroupId = "";
      if (overIdStr.startsWith("sortable-group-")) {
        overGroupId = overIdStr.replace("sortable-group-", "");
      } else if (overIdStr.startsWith("group-")) {
        overGroupId = overIdStr.replace("group-", "");
      } else {
        // Check if we're over any element that belongs to a group
        const overData = over.data?.current;
        if (overData && typeof overData === 'object') {
          // Check for group data from DroppableGroup
          if ('groupId' in overData && overData.groupId) {
            overGroupId = overData.groupId as string;
          } else if ('sortable' in overData) {
            const sortableData = overData as { sortable?: { containerId?: string } };
            if (sortableData.sortable?.containerId) {
              const containerId = sortableData.sortable.containerId;
              if (containerId.includes("group")) {
                const match = containerId.match(/group[s]?-([a-zA-Z0-9_-]+)/);
                if (match) overGroupId = match[1];
              }
            }
          }
        }
        if (!overGroupId) return;
      }

      if (groupId === overGroupId) return;

      const activeGroup = localGroups.find(g => g.id === groupId);
      const overGroup = localGroups.find(g => g.id === overGroupId);
      if (!activeGroup || !overGroup) return;

      // Verify same scope
      if (activeGroup.scopeType !== overGroup.scopeType || activeGroup.scopeId !== overGroup.scopeId) return;

      // Get groups in the same scope
      const scopeGroups = localGroups
        .filter(g =>
          g.scopeType === activeGroup.scopeType &&
          (activeGroup.scopeId === null ? g.scopeId === null : g.scopeId === activeGroup.scopeId)
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const oldIndex = scopeGroups.findIndex(g => g.id === groupId);
      const newIndex = scopeGroups.findIndex(g => g.id === overGroupId);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedGroups = arrayMove(scopeGroups, oldIndex, newIndex);
      const updates = reorderedGroups.map((g, index) => ({ id: g.id, sortOrder: index }));

      // Optimistic update
      const previousGroups = localGroups;
      setLocalGroups(prev => {
        const otherGroups = prev.filter(g =>
          g.scopeType !== activeGroup.scopeType ||
          g.scopeId !== activeGroup.scopeId
        );
        return [...otherGroups, ...reorderedGroups.map((g, index) => ({ ...g, sortOrder: index }))];
      });

      try {
        const response = await fetch("/api/question-groups/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupOrders: updates }),
        });

        if (!response.ok) {
          setLocalGroups(previousGroups);
          throw new Error("Failed to reorder groups");
        }

        router.refresh();
      } catch {
        toast.error("Failed to reorder groups");
      }
      return;
    }

    // Handle question reordering (existing logic)
    const activeQuestion = localQuestions.find(q => q.id === active.id);
    if (!activeQuestion) return;

    // Check if dropped on a droppable container (group or ungrouped area)
    const isDroppedOnGroup = overIdStr.startsWith("group-");
    const isDroppedOnUngrouped = overIdStr.startsWith("ungrouped-");

    if (isDroppedOnGroup || isDroppedOnUngrouped) {
      // Extract target info from droppable data
      const overData = over.data?.current as { type: string; groupId: string | null; scopeType: GroupScopeType; scopeId: string | null } | undefined;

      if (overData) {
        const targetGroupId = overData.groupId;
        const targetScopeType = overData.scopeType;
        const targetScopeId = overData.scopeId;

        // Check if anything actually changed
        const groupChanged = targetGroupId !== activeQuestion.groupId;
        const scopeChanged = targetScopeType !== activeQuestion.scopeType || targetScopeId !== activeQuestion.scopeId;

        if (groupChanged || scopeChanged) {
          // Get questions in the target scope/group to determine sort order
          const targetQuestions = localQuestions
            .filter(q =>
              q.groupId === targetGroupId &&
              q.scopeType === targetScopeType &&
              (targetScopeId === null ? q.scopeId === null : q.scopeId === targetScopeId)
            );
          const newSortOrder = targetQuestions.length;

          // Optimistic update
          const previousQuestions = localQuestions;
          setLocalQuestions(prev => prev.map(q =>
            q.id === activeQuestion.id
              ? { ...q, groupId: targetGroupId, scopeType: targetScopeType, scopeId: targetScopeId, sortOrder: newSortOrder }
              : q
          ));

          // Persist to backend
          try {
            const response = await fetch("/api/questions/reorder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                questionOrders: [{
                  id: activeQuestion.id,
                  sortOrder: newSortOrder,
                  groupId: targetGroupId,
                  scopeType: targetScopeType,
                  scopeId: targetScopeId,
                }],
              }),
            });

            if (!response.ok) {
              setLocalQuestions(previousQuestions);
              throw new Error("Failed to move question");
            }

            toast.success("Question moved");
            router.refresh();
          } catch {
            toast.error("Failed to move question");
          }
          return;
        }
      }
    }

    // Regular reorder within same container (dropped on another question)
    if (active.id === over.id) return;

    const overQuestion = localQuestions.find(q => q.id === over.id);
    if (!overQuestion) return;

    // Check if same scope and group
    const sameScopeAndGroup =
      activeQuestion.scopeType === overQuestion.scopeType &&
      activeQuestion.scopeId === overQuestion.scopeId &&
      activeQuestion.groupId === overQuestion.groupId;

    if (sameScopeAndGroup) {
      // Reorder within the same group
      const groupQuestions = localQuestions
        .filter(q =>
          q.groupId === activeQuestion.groupId &&
          q.scopeType === activeQuestion.scopeType &&
          (activeQuestion.scopeId === null ? q.scopeId === null : q.scopeId === activeQuestion.scopeId)
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const oldIndex = groupQuestions.findIndex(q => q.id === active.id);
      const newIndex = groupQuestions.findIndex(q => q.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedQuestions = arrayMove(groupQuestions, oldIndex, newIndex);
      const updates = reorderedQuestions.map((q, index) => ({
        id: q.id,
        sortOrder: index,
        groupId: q.groupId,
      }));

      // Optimistic update
      const previousQuestions = localQuestions;
      setLocalQuestions(prev => {
        const otherQuestions = prev.filter(q =>
          q.groupId !== activeQuestion.groupId ||
          q.scopeType !== activeQuestion.scopeType ||
          q.scopeId !== activeQuestion.scopeId
        );
        const updated = reorderedQuestions.map((q, index) => ({ ...q, sortOrder: index }));
        return [...otherQuestions, ...updated];
      });

      try {
        const response = await fetch("/api/questions/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionOrders: updates }),
        });

        if (!response.ok) {
          setLocalQuestions(previousQuestions);
          throw new Error("Failed to reorder");
        }

        router.refresh();
      } catch {
        toast.error("Failed to reorder questions");
      }
    } else {
      // Moving to a different group (but dropped on a question in that group)
      const targetGroupId = overQuestion.groupId;
      const targetScopeType = overQuestion.scopeType;
      const targetScopeId = overQuestion.scopeId;

      // Get target group questions
      const targetQuestions = localQuestions
        .filter(q =>
          q.groupId === targetGroupId &&
          q.scopeType === targetScopeType &&
          (targetScopeId === null ? q.scopeId === null : q.scopeId === targetScopeId) &&
          q.id !== activeQuestion.id
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);

      // Find position to insert
      const overIndex = targetQuestions.findIndex(q => q.id === over.id);
      const newSortOrder = overIndex >= 0 ? overIndex : targetQuestions.length;

      // Optimistic update
      const previousQuestions = localQuestions;
      setLocalQuestions(prev => prev.map(q =>
        q.id === activeQuestion.id
          ? { ...q, groupId: targetGroupId, scopeType: targetScopeType, scopeId: targetScopeId, sortOrder: newSortOrder }
          : q
      ));

      try {
        const response = await fetch("/api/questions/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionOrders: [{
              id: activeQuestion.id,
              sortOrder: newSortOrder,
              groupId: targetGroupId,
              scopeType: targetScopeType,
              scopeId: targetScopeId,
            }],
          }),
        });

        if (!response.ok) {
          setLocalQuestions(previousQuestions);
          throw new Error("Failed to move question");
        }

        toast.success("Question moved");
        router.refresh();
      } catch {
        toast.error("Failed to move question");
      }
    }
  }

  const activeQuestion = activeId ? localQuestions.find(q => q.id === activeId) : null;

  // Get available groups for batch add (all groups in the project)
  const availableGroupsForBatch = useMemo(() => {
    return localGroups;
  }, [localGroups]);

  // Render questions content for a scope (groups + ungrouped)
  function renderScopeContent(scopeType: GroupScopeType, scopeId: string | null) {
    const scopeGroups = getGroupsForScope(scopeType, scopeId).sort((a, b) => a.sortOrder - b.sortOrder);
    const ungroupedQuestions = getQuestionsForGroup(null, scopeType, scopeId);

    return (
      <>
        {/* Groups within this scope (sortable) */}
        <SortableContext
          items={scopeGroups.map(g => `sortable-group-${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {scopeGroups.map((group) => {
            const groupQuestions = getQuestionsForGroup(group.id, scopeType, scopeId);
            const isGroupOver = overId === `group-${group.id}`;
            const groupKey = `group-${group.id}`;
            return (
              <SortableGroupItem key={group.id} group={group} isSelectionMode={isSelectionMode}>
                {(dragHandleProps) => (
                  <Collapsible
                    open={openSections.has(groupKey)}
                    onOpenChange={() => toggleSection(groupKey)}
                  >
                    <DroppableGroup
                      groupId={group.id}
                      scopeType={scopeType}
                      scopeId={scopeId}
                      isOver={isGroupOver}
                    >
                      <div className="flex items-center justify-between p-3 hover:bg-muted/30">
                        <div className="flex items-center gap-2">
                          {dragHandleProps && (
                            <div
                              {...dragHandleProps.attributes}
                              {...dragHandleProps.listeners}
                              className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted"
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <CollapsibleTrigger className="flex flex-1 items-center gap-2">
                            {openSections.has(groupKey) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{group.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {groupQuestions.length}
                            </Badge>
                          </CollapsibleTrigger>
                        </div>
                        {!isSelectionMode && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditGroupDialog(group);
                              }}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteGroup(group);
                              }}
                            >
                              <Trash className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className="border-t px-3 py-2 space-y-2 min-h-[40px]">
                          <SortableContext
                            items={groupQuestions.map(q => q.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {groupQuestions.map((question) => (
                              <SortableQuestionItem
                                key={question.id}
                                question={question}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedQuestions.has(question.id)}
                                onToggleSelect={() => toggleQuestionSelection(question.id)}
                                onEdit={() => openEditDialog(question)}
                                onDelete={() => setDeleteQuestion(question)}
                                getFieldTypeIcon={getFieldTypeIcon}
                              />
                            ))}
                            {groupQuestions.length === 0 && (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                Drop questions here
                              </div>
                            )}
                          </SortableContext>
                        </div>
                      </CollapsibleContent>
                    </DroppableGroup>
                  </Collapsible>
                )}
              </SortableGroupItem>
            );
          })}
        </SortableContext>

        {/* Ungrouped questions within this scope */}
        <DroppableUngrouped
          scopeType={scopeType}
          scopeId={scopeId}
          isOver={overId === `ungrouped-${scopeType}-${scopeId ?? "null"}`}
          hasGroups={scopeGroups.length > 0}
        >
          <SortableContext
            items={ungroupedQuestions.map(q => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {ungroupedQuestions.map((question) => (
              <SortableQuestionItem
                key={question.id}
                question={question}
                isSelectionMode={isSelectionMode}
                isSelected={selectedQuestions.has(question.id)}
                onToggleSelect={() => toggleQuestionSelection(question.id)}
                onEdit={() => openEditDialog(question)}
                onDelete={() => setDeleteQuestion(question)}
                getFieldTypeIcon={getFieldTypeIcon}
              />
            ))}
          </SortableContext>
        </DroppableUngrouped>
      </>
    );
  }

  // Render a page with its sections nested inside
  function renderPageWithSections(page: PageWithSections, pageDragHandleProps: DragHandleProps | null) {
    const pageQuestions = getQuestionsForScope("page", page.id);
    const pageGroups = getGroupsForScope("page", page.id);

    // Count all questions in this page and its sections
    const sectionQuestionCounts = page.sections.map(section =>
      getQuestionsForScope("section", section.id).length
    );
    const totalSectionQuestions = sectionQuestionCounts.reduce((a, b) => a + b, 0);
    const totalQuestions = pageQuestions.length + totalSectionQuestions;

    // Check if page or any section has content
    const sectionsWithContent = page.sections.filter(section => {
      const sectionQuestions = getQuestionsForScope("section", section.id);
      const sectionGroups = getGroupsForScope("section", section.id);
      return sectionQuestions.length > 0 || sectionGroups.length > 0;
    });

    const hasContent = pageQuestions.length > 0 || pageGroups.length > 0 || sectionsWithContent.length > 0;
    if (!hasContent) return null;

    const sectionKey = `page-${page.id}`;

    return (
      <Collapsible
        key={sectionKey}
        open={openSections.has(sectionKey)}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <div className="rounded-lg border">
          <div className="flex items-center justify-between p-4 hover:bg-muted/50">
            <div className="flex items-center gap-2">
              {pageDragHandleProps && (
                <div
                  {...pageDragHandleProps.attributes}
                  {...pageDragHandleProps.listeners}
                  className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <CollapsibleTrigger className="flex flex-1 items-center gap-3">
                {openSections.has(sectionKey) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{page.name}</span>
                <Badge variant="secondary">
                  {totalQuestions} questions
                </Badge>
              </CollapsibleTrigger>
            </div>
            {!isSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openAddGroupDialog("page", page.id);
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Group</span>
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <div className="border-t px-4 py-3 space-y-4">
              {/* Nested sections first (sorted by sortOrder, sortable) */}
              <SortableContext
                items={sectionsWithContent.map(s => `sortable-section-${s.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {sectionsWithContent
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((section) => {
                    const sectionQuestions = getQuestionsForScope("section", section.id);
                    const nestedSectionKey = `section-${section.id}`;

                    return (
                      <SortableSectionItem key={section.id} section={section} isSelectionMode={isSelectionMode}>
                        {(sectionDragHandleProps) => (
                          <Collapsible
                            open={openSections.has(nestedSectionKey)}
                            onOpenChange={() => toggleSection(nestedSectionKey)}
                          >
                            <div className="rounded-lg border bg-muted/20">
                              <div className="flex items-center justify-between p-3 hover:bg-muted/30">
                                <div className="flex items-center gap-2">
                                  {sectionDragHandleProps && (
                                    <div
                                      {...sectionDragHandleProps.attributes}
                                      {...sectionDragHandleProps.listeners}
                                      className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-muted"
                                    >
                                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                  <CollapsibleTrigger className="flex flex-1 items-center gap-2">
                                    {openSections.has(nestedSectionKey) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                    <Layout className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{section.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {sectionQuestions.length}
                                    </Badge>
                                  </CollapsibleTrigger>
                                </div>
                                {!isSelectionMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAddGroupDialog("section", section.id);
                                    }}
                                  >
                                    <FolderPlus className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <CollapsibleContent>
                                <div className="border-t px-3 py-2 space-y-3">
                                  {renderScopeContent("section", section.id)}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )}
                      </SortableSectionItem>
                    );
                  })}
              </SortableContext>

              {/* Page-level questions and groups after sections */}
              {(pageQuestions.length > 0 || pageGroups.length > 0) && (
                <div className="space-y-4">
                  {renderScopeContent("page", page.id)}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  // Render website scope section
  function renderWebsiteScope() {
    const scopeQuestions = getQuestionsForScope("website", null);
    const scopeGroups = getGroupsForScope("website", null);

    if (scopeQuestions.length === 0 && scopeGroups.length === 0) {
      return null;
    }

    const sectionKey = "website";

    return (
      <Collapsible
        key={sectionKey}
        open={openSections.has(sectionKey)}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <div className="rounded-lg border">
          <div className="flex items-center justify-between p-4 hover:bg-muted/50">
            <CollapsibleTrigger className="flex flex-1 items-center gap-3">
              {openSections.has(sectionKey) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Website</span>
              <Badge variant="secondary">
                {scopeQuestions.length} questions
              </Badge>
            </CollapsibleTrigger>
            {!isSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openAddGroupDialog("website", null);
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Group</span>
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <div className="border-t px-4 py-3 space-y-4">
              {renderScopeContent("website", null)}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="gap-2 flex flex-col">
              <CardTitle>Questionnaire</CardTitle>
              <CardDescription>
                Create questions to gather information from clients
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {localQuestions.length > 0 && (
                <>
                  {isSelectionMode ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exitSelectionMode}
                      >
                        Cancel
                      </Button>
                      {selectedQuestions.size > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={deselectAllQuestions}
                        >
                          Deselect All
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllQuestions}
                        >
                          Select All
                        </Button>
                      )}
                      {selectedQuestions.size > 0 && (
                        <>
                          {availableGroupsForBatch.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowBatchAddToGroupDialog(true)}
                            >
                              <FolderPlus className="mr-2 h-4 w-4" />
                              Add to Group
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowBatchDeleteDialog(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete ({selectedQuestions.size})
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSelectionMode(true)}
                    >
                      Select
                    </Button>
                  )}
                </>
              )}
              {!isSelectionMode && (
                <Dialog open={isAddingQuestion} onOpenChange={setIsAddingQuestion}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto">
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
                            setSelectedGroupId(null);
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
                              setSelectedGroupId(null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a page" />
                            </SelectTrigger>
                            <SelectContent>
                              {localPages.map((page) => (
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
                          <Select value={scopeId} onValueChange={(value) => {
                            setScopeId(value);
                            setSelectedGroupId(null);
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a section" />
                            </SelectTrigger>
                            <SelectContent>
                              {localPages
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

                      {/* Group Selection - filtered by selected scope */}
                      {(() => {
                        const availableGroups = localGroups.filter(g =>
                          g.scopeType === scopeType &&
                          (scopeType === "website"
                            ? g.scopeId === null
                            : g.scopeId === scopeId)
                        );
                        if (availableGroups.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <Label>Group (Optional)</Label>
                            <Select
                              value={selectedGroupId || "none"}
                              onValueChange={(value) => setSelectedGroupId(value === "none" ? null : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a group" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Group</SelectItem>
                                {availableGroups.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}

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

                      {/* Max File Count (for file type) */}
                      {fieldType === "file" && (
                        <div className="space-y-2">
                          <Label>Maximum Files</Label>
                          <Select
                            value={String(maxFileCount)}
                            onValueChange={(value) => setMaxFileCount(Number(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n === 1 ? "1 file" : `Up to ${n} files`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            How many files can the client upload for this question
                          </p>
                        </div>
                      )}

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
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {localQuestions.length === 0 && localGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No questions yet</p>
              <p className="text-sm text-muted-foreground">
                Add questions to gather information from clients
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-4">
                {/* Website scope */}
                {renderWebsiteScope()}

                {/* Pages with their nested sections (sortable) */}
                <SortableContext
                  items={localPages.map(p => `sortable-page-${p.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {localPages.sort((a, b) => a.sortOrder - b.sortOrder).map((page) => (
                    <SortablePageItem key={page.id} page={page} isSelectionMode={isSelectionMode}>
                      {(dragHandleProps) => renderPageWithSections(page, dragHandleProps)}
                    </SortablePageItem>
                  ))}
                </SortableContext>
              </div>

              <DragOverlay>
                {activeQuestion && (
                  <QuestionDragOverlay question={activeQuestion} getFieldTypeIcon={getFieldTypeIcon} />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add Group Dialog */}
      <Dialog open={isAddingGroup} onOpenChange={(open) => {
        if (!open) {
          resetGroupForm();
          setAddingGroupForScope(null);
        }
        setIsAddingGroup(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Group</DialogTitle>
            <DialogDescription>
              Create a group to organize questions within{" "}
              {addingGroupForScope?.type === "website"
                ? "the website scope"
                : addingGroupForScope?.type === "page"
                  ? "this page"
                  : "this section"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Brand Preferences"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Brief description of this group"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetGroupForm();
                  setIsAddingGroup(false);
                  setAddingGroupForScope(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddGroup} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
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

      {/* Batch Delete Dialog */}
      <AlertDialog
        open={showBatchDeleteDialog}
        onOpenChange={setShowBatchDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedQuestions.size} Question(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedQuestions.size} selected question(s)
              and all their responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : `Delete ${selectedQuestions.size} Question(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Add to Group Dialog */}
      <Dialog open={showBatchAddToGroupDialog} onOpenChange={setShowBatchAddToGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Group</DialogTitle>
            <DialogDescription>
              Select a group to add {selectedQuestions.size} selected question(s) to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Group</Label>
              <Select value={batchAddGroupId} onValueChange={setBatchAddGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroupsForBatch.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <span>{group.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({group.scopeType === "website" ? "Website" : group.scopeType === "page" ? "Page" : "Section"})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBatchAddToGroupDialog(false);
                  setBatchAddGroupId("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleBatchAddToGroup} disabled={isSubmitting || !batchAddGroupId}>
                {isSubmitting ? "Adding..." : "Add to Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question details
            </DialogDescription>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4 pt-4">
              {/* Scope Selection (editable) */}
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={editScopeType}
                  onValueChange={(value: QuestionScopeType) => {
                    setEditScopeType(value);
                    setEditScopeId(null);
                    setEditSelectedPageId("");
                    setEditGroupId(null);
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
              {(editScopeType === "page" || editScopeType === "section") && (
                <div className="space-y-2">
                  <Label>Page</Label>
                  <Select
                    value={editScopeType === "page" ? (editScopeId || "") : editSelectedPageId}
                    onValueChange={(value) => {
                      if (editScopeType === "page") {
                        setEditScopeId(value);
                      } else {
                        setEditSelectedPageId(value);
                        setEditScopeId(null);
                      }
                      setEditGroupId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a page" />
                    </SelectTrigger>
                    <SelectContent>
                      {localPages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Section Selection (for section scope) */}
              {editScopeType === "section" && editSelectedPageId && (
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={editScopeId || ""}
                    onValueChange={(value) => {
                      setEditScopeId(value);
                      setEditGroupId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {localPages
                        .find((p) => p.id === editSelectedPageId)
                        ?.sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Group Selection */}
              {(() => {
                const targetScopeId = editScopeType === "website" ? null : editScopeId;
                const availableGroups = localGroups.filter(g =>
                  g.scopeType === editScopeType &&
                  (targetScopeId === null ? g.scopeId === null : g.scopeId === targetScopeId)
                );
                return (
                  <div className="space-y-2">
                    <Label>Group (Optional)</Label>
                    <Select
                      value={editGroupId || "none"}
                      onValueChange={(value) => setEditGroupId(value === "none" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Group</SelectItem>
                        {availableGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}

              {/* Field Type info (read-only) */}
              <div className="space-y-2">
                <Label>Field Type</Label>
                <div className="p-2 rounded-md bg-muted">
                  <span className="text-sm">
                    {FIELD_TYPES.find((t) => t.value === editingQuestion.fieldType)?.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">(Cannot be changed)</span>
                </div>
              </div>

              {/* Max File Count (for file type) */}
              {editingQuestion.fieldType === "file" && (
                <div className="space-y-2">
                  <Label>Maximum Files</Label>
                  <Select
                    value={String(maxFileCount)}
                    onValueChange={(value) => setMaxFileCount(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 ? "1 file" : `Up to ${n} files`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
              {(editingQuestion.fieldType === "text" ||
                editingQuestion.fieldType === "textarea" ||
                editingQuestion.fieldType === "url") && (
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
              {(editingQuestion.fieldType === "select" ||
                editingQuestion.fieldType === "checkbox") && (
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
                  id="editIsRequired"
                  checked={isRequired}
                  onCheckedChange={(checked) => setIsRequired(checked === true)}
                />
                <Label htmlFor="editIsRequired" className="cursor-pointer">
                  Required field
                </Label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button onClick={handleEditQuestion} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupDialogOpen} onOpenChange={(open) => !open && closeEditGroupDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update the group details
            </DialogDescription>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Group Name *</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Brand Preferences"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Brief description of this group"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeEditGroupDialog}>
                  Cancel
                </Button>
                <Button onClick={handleEditGroup} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <AlertDialog
        open={deleteGroup !== null}
        onOpenChange={() => setDeleteGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the group &quot;{deleteGroup?.name}&quot;. Questions in this
              group will become ungrouped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
