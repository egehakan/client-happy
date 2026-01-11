"use client";

import { useState, useRef } from "react";
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
import { toast } from "sonner";
import { Plus, Trash, Upload, Link2, ImageIcon } from "lucide-react";

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
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
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Delete state
  const [deleteScreenshot, setDeleteScreenshot] = useState<Screenshot | null>(
    null
  );

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const sections = selectedPage?.sections || [];

  function resetForm() {
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setSelectedFile(null);
    setSelectedSectionId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleAddScreenshot(sourceType: "local" | "url") {
    if (!selectedSectionId) {
      toast.error("Please select a section");
      return;
    }

    if (sourceType === "url" && !externalUrl) {
      toast.error("Please enter an image URL");
      return;
    }

    if (sourceType === "local" && !selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsSubmitting(true);

    try {
      let filePath: string | undefined;

      // Upload file first if local
      if (sourceType === "local" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("projectId", projectId);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json();
          throw new Error(data.error || "Failed to upload file");
        }

        const uploadData = await uploadResponse.json();
        filePath = uploadData.filePath;
      }

      // Create screenshot record
      const response = await fetch("/api/screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          title: title || undefined,
          description: description || undefined,
          sourceType,
          filePath,
          externalUrl: sourceType === "url" ? externalUrl : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add screenshot");
      }

      toast.success("Screenshot added");
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

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Create pages and sections first before adding screenshots
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Screenshots</CardTitle>
            <CardDescription>
              Add screenshot examples for clients to vote on
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddingOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Screenshot
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label className="mb-2 block">Filter by Page</Label>
            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
              <SelectTrigger className="w-64">
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

          {sections.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No sections in this page</p>
              <p className="text-sm text-muted-foreground">
                Add sections first in the Pages & Sections tab
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.id}>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide border-b pb-2">
                    {section.name}
                  </h3>
                  {section.screenshots.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No screenshots in this section
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {section.screenshots.map((screenshot) => (
                        <div
                          key={screenshot.id}
                          className="group relative overflow-hidden rounded-lg border"
                        >
                          <div className="relative aspect-video bg-muted">
                            {screenshot.sourceType === "local" &&
                            screenshot.filePath ? (
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
                            <div className="flex items-start justify-between">
                              <p className="font-medium">
                                {screenshot.title || "Untitled"}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                onClick={() => setDeleteScreenshot(screenshot)}
                              >
                                <Trash className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                            {screenshot.description && (
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                {screenshot.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Screenshot Dialog */}
      <Dialog open={isAddingOpen} onOpenChange={setIsAddingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Screenshot</DialogTitle>
            <DialogDescription>
              Upload an image or paste a URL to {selectedPage?.name || "the selected page"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sections.length === 0 && (
                <p className="text-xs text-destructive">
                  No sections available. Add sections to this page first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Title (Optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Hero Section Design A"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
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
                <div className="space-y-2">
                  <Label>Image File</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleAddScreenshot("local")}
                  disabled={isSubmitting || !selectedFile || !selectedSectionId}
                >
                  {isSubmitting ? "Uploading..." : "Upload Screenshot"}
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
                <Button
                  className="w-full"
                  onClick={() => handleAddScreenshot("url")}
                  disabled={isSubmitting || !externalUrl || !selectedSectionId}
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
    </>
  );
}
