import { useState, useCallback, useRef } from "react";
import { useChannelStore } from "@/lib/store/channel-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Webhook } from "@/types";

interface WebhookCreateDialogProps {
  onWebhookCreated?: (webhook: Webhook) => void;
}

export function WebhookCreateDialog({
  onWebhookCreated,
}: WebhookCreateDialogProps) {
  const { selectedChannel } = useChannelStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [isUrlProcessing, setIsUrlProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Function to convert image to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Keep the full data URI format (data:image/type;base64,)
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Handle file upload
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Check file size (Discord has an 8MB limit, but let's be conservative)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }

      // Check if it's an image
      if (!file.type.startsWith("image/")) {
        toast.error("Selected file is not an image");
        return;
      }

      try {
        const base64Data = await fileToBase64(file);
        setAvatarBase64(base64Data);
        setAvatarUrl(""); // Clear URL when a file is selected
        toast.success("Image selected successfully");
      } catch (error) {
        console.error("Error converting file to base64:", error);
        toast.error("Failed to process the image");
      }
    },
    [fileToBase64]
  );

  // Handle URL input and convert to base64
  const processImageUrl = useCallback(async () => {
    if (!avatarUrl.trim()) return;

    setIsUrlProcessing(true);
    try {
      // Fetch the image
      const response = await fetch(avatarUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch image from URL");
      }

      const blob = await response.blob();

      // Check file size
      if (blob.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }

      // Check if it's an image
      if (!blob.type.startsWith("image/")) {
        toast.error("URL does not point to a valid image");
        return;
      }

      const base64Data = await fileToBase64(
        new File([blob], "avatar.png", { type: blob.type })
      );
      setAvatarBase64(base64Data);
      toast.success("Image URL processed successfully");
    } catch (error) {
      console.error("Error processing image URL:", error);
      toast.error("Failed to process image URL");
    } finally {
      setIsUrlProcessing(false);
    }
  }, [avatarUrl, fileToBase64]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChannel) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.PUBLIC_API_URL}/webhooks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            channel_id: selectedChannel.id,
            name: name.trim() || undefined,
            avatar: avatarBase64 || undefined, // Send the base64 data directly
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create webhook");
      }

      const createdWebhook = await response.json();

      toast.success("Webhook created successfully");
      setIsOpen(false);

      // Use callback or fall back to page reload
      if (onWebhookCreated) {
        onWebhookCreated(createdWebhook);
      } else {
        // Fallback to page reload
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating webhook:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create webhook"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form when closing
      setName("");
      setAvatarUrl("");
      setAvatarBase64(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Webhook</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Create a new webhook for channel #{selectedChannel?.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Webhook name"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use a random name
            </p>
          </div>

          <div className="grid gap-4">
            <Label>Avatar</Label>
            {/* File upload */}
            <div className="grid gap-2">
              <Label htmlFor="avatar-file" className="text-sm">
                Upload Image
              </Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Select an image file up to 5MB
              </p>
            </div>
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
            {/* URL input */}
            <div className="grid gap-2">
              <Label htmlFor="avatar-url">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="avatar-url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  type="url"
                  disabled={isUrlProcessing}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={processImageUrl}
                  disabled={!avatarUrl || isUrlProcessing}
                >
                  {isUrlProcessing ? "Processing..." : "Process"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL to an image and click Process
              </p>
            </div>
            {/* Preview */}
            {avatarBase64 && (
              <div className="mt-2 flex justify-center">
                <div className="relative">
                  <img
                    src={avatarBase64}
                    alt="Avatar preview"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => {
                      setAvatarBase64(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
