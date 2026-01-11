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

interface ResetVotesButtonProps {
  projectId: string;
  projectName: string;
  voteCount: number;
}

export function ResetVotesButton({
  projectId,
  projectName,
  voteCount,
}: ResetVotesButtonProps) {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/votes`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to reset votes");

      const data = await response.json();
      toast.success(`Reset ${data.deletedCount} votes for ${projectName}`);
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to reset votes");
    } finally {
      setIsResetting(false);
    }
  }

  if (voteCount === 0) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Votes
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset All Votes?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all {voteCount} vote
            {voteCount !== 1 ? "s" : ""} for &quot;{projectName}&quot;. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isResetting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isResetting ? "Resetting..." : "Reset All Votes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
