import { useState } from "react";
import { useChannelStore } from "@/lib/store/channel-store";
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
import type { Webhook } from "@/types";
import { toast } from "sonner";

interface WebhookDeleteDialogProps {
  webhook: Webhook;
  onDelete?: (webhookId: string) => void;
}

export function WebhookDeleteDialog({
  webhook,
  onDelete,
}: WebhookDeleteDialogProps) {
  const { selectedChannel } = useChannelStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    if (!selectedChannel || !webhook) return;

    setIsLoading(true);

    try {
      // Use the endpoint that also clears the cache
      const response = await fetch(
        `${import.meta.env.PUBLIC_API_URL}/webhooks/${webhook.id}/channel/${
          selectedChannel.id
        }`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete webhook");
      }
      toast.success("Webhook deleted successfully");
      setIsOpen(false);

      // Call the onDelete callback if provided, otherwise fallback to page reload
      if (onDelete) {
        onDelete(webhook.id);
      } else {
        // Fallback to page reload if no callback provided
        window.location.reload();
      }
    } catch (error) {
      console.error("Error deleting webhook:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete webhook"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the webhook "{webhook.name}"? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
