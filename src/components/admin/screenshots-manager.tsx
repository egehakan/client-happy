"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type Page, type Section, type Screenshot } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash, Upload, Link2, ImageIcon, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileWithMetadata {
  file: File;
  preview: string;
  title: string;
  description: string;
}

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
  screenshots?: Screenshot[]; // Page-level screenshots
}

interface ScreenshotsManagerProps {
  projectId: string;
  pages: PageWithSections[];
}

export function ScreenshotsManager({
  projectId,
  pages,
}: ScreenshotsManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPageId, setSelectedPageId] = useState<string>(
    pages[0]?.id || ""
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>("__page__");
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Form state for multiple files
  const [selectedFiles, setSelectedFiles] = useState<FileWithMetadata[]>([]);
  const [externalUrl, setExternalUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlDescription, setUrlDescription] = useState("");

  // Delete state
  const [deleteScreenshot, setDeleteScreenshot] = useState<Screenshot | null>(
    null
  );

  // Multi-select state
  const [selectedScreenshots, setSelectedScreenshots] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Edit state
  const [editingScreenshot, setEditingScreenshot] = useState<Screenshot | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const MAX_FILES = 10;

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const sections = selectedPage?.sections || [];
  const pageScreenshots = selectedPage?.screenshots || [];

  function resetForm() {
    // Clean up preview URLs to prevent memory leaks
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    setExternalUrl("");
    setUrlTitle("");
    setUrlDescription("");
    setSelectedSectionId("__page__");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      toast.error("Please select image files only");
      return;
    }

    setSelectedFiles((prev) => {
      const newFiles = imageFiles.slice(0, MAX_FILES - prev.length);
      if (imageFiles.length > newFiles.length) {
        toast.warning(`Maximum ${MAX_FILES} images allowed. Some files were not added.`);
      }

      return [
        ...prev,
        ...newFiles.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
          title: "",
          description: "",
        })),
      ];
    });
  }, [selectedFiles.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const { files } = e.target;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateFileMetadata(
    index: number,
    field: "title" | "description",
    value: string
  ) {
    setSelectedFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  }

  async function handleAddScreenshot(sourceType: "local" | "url") {
    if (sourceType === "url" && !externalUrl) {
      toast.error("Please enter an image URL");
      return;
    }

    if (sourceType === "local" && selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsSubmitting(true);

    try {
      const isPageLevel = selectedSectionId === "__page__";

      if (sourceType === "local") {
        // Use bulk upload endpoint
        const formData = new FormData();

        // Add metadata
        const metadata = {
          projectId,
          sectionId: isPageLevel ? null : selectedSectionId,
          pageId: isPageLevel ? selectedPageId : null,
          screenshots: selectedFiles.map((f) => ({
            title: f.title || undefined,
            description: f.description || undefined,
          })),
        };
        formData.append("metadata", JSON.stringify(metadata));

        // Add files
        selectedFiles.forEach((fileData, index) => {
          formData.append(`file_${index}`, fileData.file);
        });

        const response = await fetch("/api/screenshots/bulk", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to upload screenshots");
        }

        if (data.successCount > 0) {
          toast.success(data.message);
        } else {
          toast.error("Failed to upload screenshots");
        }
      } else {
        // URL upload (single)
        const response = await fetch("/api/screenshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: isPageLevel ? null : selectedSectionId,
            pageId: isPageLevel ? selectedPageId : null,
            title: urlTitle || undefined,
            description: urlDescription || undefined,
            sourceType: "url",
            externalUrl,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to add screenshot");
        }

        toast.success("Screenshot added");
      }

      resetForm();
      setIsAddingOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add screenshot"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteScreenshot) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/screenshots/${deleteScreenshot.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Screenshot deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete screenshot");
    } finally {
      setIsSubmitting(false);
      setDeleteScreenshot(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedScreenshots.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/screenshots/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedScreenshots) }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to delete");

      toast.success(data.message);
      setSelectedScreenshots(new Set());
      setIsSelectMode(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete screenshots");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function toggleScreenshotSelection(id: string) {
    setSelectedScreenshots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllScreenshots() {
    const allIds = [
      ...pageScreenshots.map((s) => s.id),
      ...sections.flatMap((s) => s.screenshots.map((sc) => sc.id)),
    ];
    setSelectedScreenshots(new Set(allIds));
  }

  function deselectAllScreenshots() {
    setSelectedScreenshots(new Set());
  }

  function openEditModal(screenshot: Screenshot) {
    setEditingScreenshot(screenshot);
    setEditTitle(screenshot.title || "");
    setEditDescription(screenshot.description || "");
  }

  async function handleEditSave() {
    if (!editingScreenshot) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/screenshots/${editingScreenshot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle || null,
          description: editDescription || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Screenshot updated");
      setEditingScreenshot(null);
      router.refresh();
    } catch {
      toast.error("Failed to update screenshot");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderScreenshotGrid(screenshots: Screenshot[]) {
    if (screenshots.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No screenshots in this section
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {screenshots.map((screenshot) => {
          const isSelected = selectedScreenshots.has(screenshot.id);
          return (
            <div
              key={screenshot.id}
              className={cn(
                "group relative overflow-hidden rounded-lg border transition-colors",
                isSelected && "border-primary ring-2 ring-primary"
              )}
            >
              {/* Selection checkbox */}
              {isSelectMode && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleScreenshotSelection(screenshot.id)}
                    className="h-5 w-5 bg-background"
                  />
                </div>
              )}

              <div
                className={cn(
                  "relative aspect-video bg-muted",
                  isSelectMode && "cursor-pointer"
                )}
                onClick={isSelectMode ? () => toggleScreenshotSelection(screenshot.id) : undefined}
              >
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
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium truncate flex-1">
                    {screenshot.title || "Untitled"}
                  </p>
                  {!isSelectMode && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditModal(screenshot)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteScreenshot(screenshot)}
                      >
                        <Trash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
                {screenshot.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {screenshot.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Create pages first before adding screenshots
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
          <CardDescription>
            Add screenshot examples for clients to vote on
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Label className="mb-2 block">Page</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select page" />
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
            <div className="flex gap-2 flex-wrap">
              {isSelectMode ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsSelectMode(false);
                      setSelectedScreenshots(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectedScreenshots.size > 0 ? deselectAllScreenshots : selectAllScreenshots}
                  >
                    {selectedScreenshots.size > 0 ? "Deselect All" : "Select All"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={selectedScreenshots.size === 0 || isBulkDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isBulkDeleting ? "Deleting..." : `Delete (${selectedScreenshots.size})`}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSelectMode(true)}
                  >
                    Select
                  </Button>
                  <Button size="sm" onClick={() => setIsAddingOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Screenshot
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* Page-level screenshots */}
            {pageScreenshots.length > 0 && (
              <div>
                <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Page Screenshots (No Section)
                </h3>
                {renderScreenshotGrid(pageScreenshots)}
              </div>
            )}

            {/* Section screenshots */}
            {sections.length === 0 && pageScreenshots.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No screenshots yet</p>
                <p className="text-sm text-muted-foreground">
                  Add screenshots directly to this page or create sections first
                </p>
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.id}>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide border-b pb-2">
                    {section.name}
                  </h3>
                  {renderScreenshotGrid(section.screenshots)}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card >

      {/* Add Screenshot Dialog */}
      <Dialog open={isAddingOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsAddingOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Add Screenshots</DialogTitle>
            <DialogDescription>
              Upload up to {MAX_FILES} images or paste a URL to {selectedPage?.name || "the selected page"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-2">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__page__">
                    Page (no section)
                  </SelectItem>
                  {sections.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Sections
                      </div>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="url">
                  <Link2 className="mr-2 h-4 w-4" />
                  URL
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  className={cn(
                    "relative rounded-lg border-2 border-dashed p-6 transition-colors",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    selectedFiles.length >= MAX_FILES && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={selectedFiles.length >= MAX_FILES}
                  />
                  <div className="text-center">
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">
                      Drag & drop images here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to select files (max {MAX_FILES} images)
                    </p>
                    {selectedFiles.length > 0 && (
                      <p className="mt-2 text-xs text-primary">
                        {selectedFiles.length} of {MAX_FILES} images selected
                      </p>
                    )}
                  </div>
                </div>

                {/* File Previews with individual metadata */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-4">
                      {selectedFiles.map((fileData, index) => (
                        <div
                          key={`${fileData.file.name}-${index}`}
                          className="flex gap-4 p-3 rounded-lg border bg-muted/30"
                        >
                          {/* Preview */}
                          <div className="relative h-24 w-24 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fileData.preview}
                              alt={`Preview ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Metadata inputs */}
                          <div className="flex-1 space-y-2 min-w-0">
                            <Input
                              placeholder="Title (optional)"
                              value={fileData.title}
                              onChange={(e) =>
                                updateFileMetadata(index, "title", e.target.value)
                              }
                              className="h-8 text-sm"
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={fileData.description}
                              onChange={(e) =>
                                updateFileMetadata(index, "description", e.target.value)
                              }
                              rows={2}
                              className="text-sm resize-none"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => handleAddScreenshot("local")}
                  disabled={isSubmitting || selectedFiles.length === 0}
                >
                  {isSubmitting
                    ? "Uploading..."
                    : `Upload ${selectedFiles.length} Screenshot${selectedFiles.length !== 1 ? "s" : ""}`}
                </Button>
              </TabsContent>
              <TabsContent value="url" className="space-y-4">
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title (Optional)</Label>
                  <Input
                    value={urlTitle}
                    onChange={(e) => setUrlTitle(e.target.value)}
                    placeholder="e.g., Hero Section Design A"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={urlDescription}
                    onChange={(e) => setUrlDescription(e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleAddScreenshot("url")}
                  disabled={isSubmitting || !externalUrl}
                >
                  {isSubmitting ? "Adding..." : "Add Screenshot"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteScreenshot !== null}
        onOpenChange={() => setDeleteScreenshot(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this screenshot and all its votes.
              This action cannot be undone.
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

      {/* Edit Screenshot Dialog */}
      <Dialog
        open={editingScreenshot !== null}
        onOpenChange={(open) => {
          if (!open) setEditingScreenshot(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Screenshot</DialogTitle>
            <DialogDescription>
              Update the title and description for this screenshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {editingScreenshot && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {editingScreenshot.sourceType === "local" && editingScreenshot.filePath ? (
                  <Image
                    src={editingScreenshot.filePath}
                    alt={editingScreenshot.title || "Screenshot"}
                    fill
                    className="object-cover"
                  />
                ) : editingScreenshot.externalUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editingScreenshot.externalUrl}
                    alt={editingScreenshot.title || "Screenshot"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Screenshot title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Screenshot description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingScreenshot(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
