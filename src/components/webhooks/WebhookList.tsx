import { useState, useEffect } from "react";
import { useChannelStore } from "@/lib/store/channel-store";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import type { Webhook } from "@/types";
import { WebhookSkeleton } from "./WebhookSkeleton";
import { WebhookCreateDialog } from "./WebhookCreateDialog";
import { WebhookDeleteDialog } from "./WebhookDeleteDialog";

export const WebhookList = () => {
  // Get channel state from store
  const { selectedChannel } = useChannelStore();
  // Manage webhooks state locally to avoid store issues
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Function to handle webhook deletion from the list
  const handleWebhookDelete = (webhookId: string) => {
    setWebhooks((currentWebhooks) =>
      currentWebhooks.filter((webhook) => webhook.id !== webhookId)
    );
  };

  // Function to handle adding a newly created webhook to the list
  const handleWebhookCreated = (webhook: Webhook) => {
    setWebhooks((currentWebhooks) => [...currentWebhooks, webhook]);
  };

  // Reset state when channel changes
  useEffect(() => {
    setWebhooks([]);
    setError(null);

    if (!selectedChannel) return;

    const fetchWebhooks = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `${import.meta.env.PUBLIC_API_URL}/webhooks/${selectedChannel.id}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        setWebhooks(data || []);
      } catch (err) {
        console.error("Error fetching webhooks:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setWebhooks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebhooks();
  }, [selectedChannel?.id]); // Only depend on the ID to prevent unnecessary re-renders

  if (!selectedChannel) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Please select a channel to view webhooks
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show skeleton when loading
  if (isLoading) {
    return <WebhookSkeleton />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Manage webhooks for channel {selectedChannel.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center text-red-500 py-4">
            Error loading webhooks: {error}
          </div>
        ) : (
          <Table>
            <TableCaption>List of webhooks for selected channel</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Webhook</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    No webhooks found for this channel
                  </TableCell>
                </TableRow>
              ) : (
                webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <img
                        src={
                          webhook.avatar
                            ? `https://cdn.discordapp.com/avatars/${webhook.id}/${webhook.avatar}.png`
                            : "https://cdn.discordapp.com/embed/avatars/0.png"
                        }
                        alt="Webhook Avatar"
                        className="h-8 w-8 rounded-full"
                      />
                    </TableCell>
                    <TableCell>{webhook.name}</TableCell>
                    <TableCell>{webhook.id}</TableCell>
                    <TableCell>
                      <WebhookDeleteDialog
                        webhook={webhook}
                        onDelete={handleWebhookDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {webhooks.length !== 15 && (
        <CardFooter className="flex justify-end">
          <WebhookCreateDialog onWebhookCreated={handleWebhookCreated} />
        </CardFooter>
      )}
    </Card>
  );
};
