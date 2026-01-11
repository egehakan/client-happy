"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Page, type Section, type Screenshot } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Pencil,
  Image,
} from "lucide-react";

interface SectionWithScreenshots extends Section {
  screenshots: Screenshot[];
}

interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
}

interface PagesManagerProps {
  projectId: string;
  pages: PageWithSections[];
}

export function PagesManager({ projectId, pages }: PagesManagerProps) {
  const router = useRouter();
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Section state
  const [addingSectionForPage, setAddingSectionForPage] = useState<
    string | null
  >(null);
  const [newSectionName, setNewSectionName] = useState("");

  // Delete state
  const [deleteItem, setDeleteItem] = useState<{
    type: "page" | "section";
    id: string;
    name: string;
  } | null>(null);

  function togglePage(pageId: string) {
    const newOpen = new Set(openPages);
    if (newOpen.has(pageId)) {
      newOpen.delete(pageId);
    } else {
      newOpen.add(pageId);
    }
    setOpenPages(newOpen);
  }

  async function handleAddPage() {
    if (!newPageName.trim()) {
      toast.error("Page name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: newPageName }),
      });

      if (!response.ok) throw new Error("Failed to create page");

      toast.success("Page added");
      setNewPageName("");
      setIsAddingPage(false);
      router.refresh();
    } catch {
      toast.error("Failed to add page");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddSection(pageId: string) {
    if (!newSectionName.trim()) {
      toast.error("Section name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, name: newSectionName }),
      });

      if (!response.ok) throw new Error("Failed to create section");

      toast.success("Section added");
      setNewSectionName("");
      setAddingSectionForPage(null);
      router.refresh();
    } catch {
      toast.error("Failed to add section");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;

    setIsSubmitting(true);
    try {
      const endpoint =
        deleteItem.type === "page"
          ? `/api/pages/${deleteItem.id}`
          : `/api/sections/${deleteItem.id}`;

      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success(`${deleteItem.type === "page" ? "Page" : "Section"} deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setIsSubmitting(false);
      setDeleteItem(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="gap-2 flex flex-col">
            <CardTitle>Pages & Sections</CardTitle>
            <CardDescription>
              Organize your project into pages and sections
            </CardDescription>
          </div>
          <Dialog open={isAddingPage} onOpenChange={setIsAddingPage}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Page
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Page</DialogTitle>
                <DialogDescription>
                  Create a new page to organize your screenshots
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="pageName">Page Name</Label>
                  <Input
                    id="pageName"
                    value={newPageName}
                    onChange={(e) => setNewPageName(e.target.value)}
                    placeholder="e.g., Homepage, Dashboard, Settings"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingPage(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddPage} disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Page"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No pages yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first page to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => (
                <Collapsible
                  key={page.id}
                  open={openPages.has(page.id)}
                  onOpenChange={() => togglePage(page.id)}
                >
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                      <CollapsibleTrigger className="flex flex-1 items-center gap-3">
                        {openPages.has(page.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{page.name}</span>
                        <Badge variant="secondary">
                          {page.sections.length} sections
                        </Badge>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setDeleteItem({
                            type: "page",
                            id: page.id,
                            name: page.name,
                          });
                        }}
                      >
                        <Trash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t px-4 py-3">
                        <div className="space-y-2">
                          {page.sections.map((section) => (
                            <div
                              key={section.id}
                              className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{section.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  <Image className="mr-1 h-3 w-3" />
                                  {section.screenshots.length}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  setDeleteItem({
                                    type: "section",
                                    id: section.id,
                                    name: section.name,
                                  })
                                }
                              >
                                <Trash className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        {addingSectionForPage === page.id ? (
                          <div className="mt-3 flex gap-2">
                            <Input
                              value={newSectionName}
                              onChange={(e) =>
                                setNewSectionName(e.target.value)
                              }
                              placeholder="Section name..."
                              className="h-8"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddSection(page.id)}
                              disabled={isSubmitting}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddingSectionForPage(null);
                                setNewSectionName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => setAddingSectionForPage(page.id)}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Add Section
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteItem !== null}
        onOpenChange={() => setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteItem?.type === "page" ? "Page" : "Section"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteItem?.name}&quot; and all
              its contents. This action cannot be undone.
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
