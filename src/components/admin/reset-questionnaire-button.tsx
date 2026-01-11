"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

interface ResetQuestionnaireButtonProps {
  projectId: string;
  projectName: string;
  responseCount: number;
}

export function ResetQuestionnaireButton({
  projectId,
  projectName,
  responseCount,
}: ResetQuestionnaireButtonProps) {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/questionnaire`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to reset questionnaire responses");

      const data = await response.json();
      const filesMessage = data.deletedFilesCount > 0
        ? ` and ${data.deletedFilesCount} uploaded file${data.deletedFilesCount !== 1 ? "s" : ""}`
        : "";
      toast.success(`Reset ${data.deletedCount} response${data.deletedCount !== 1 ? "s" : ""}${filesMessage} for ${projectName}`);
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to reset questionnaire responses");
    } finally {
      setIsResetting(false);
    }
  }

  if (responseCount === 0) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Responses
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset All Questionnaire Responses?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all questionnaire responses for &quot;{projectName}&quot;,
            including any uploaded files. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isResetting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isResetting ? "Resetting..." : "Reset All Responses"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
