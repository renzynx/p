import { useState, useRef, useEffect } from "react";
import { useChannelStore, useWebhookStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Progress } from "../ui/progress";
import {
  formatSpeed,
  formatTimeRemaining,
  formatSize,
  generateRandomString,
} from "@/lib/utils";

// Track active uploads
interface UploadProgress {
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  uploadSpeed?: number; // in bytes per second
  estimatedTimeRemaining?: number; // in seconds
  currentChunk?: number;
}

interface UploadInfo {
  id: string;
  filename: string;
  fileSize: number;
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";
  progress: UploadProgress;
  error?: string;
  startTime?: number;
  endTime?: number;
  metadata?: any; // File metadata with chunk information
  metadataSaved?: boolean; // Indicator for metadata save status
}

// Props for the Upload component
interface UploadProps {
  onUploadComplete?: (metadata: any) => void;
  onUploadError?: (error: string, uploadId: string) => void;
  onUploadStart?: (uploadId: string, filename: string) => void;
}

export const Upload = ({
  onUploadComplete,
  onUploadError,
  onUploadStart,
}: UploadProps = {}) => {
  const { selectedChannel } = useChannelStore();
  const {
    webhooks,
    isLoading: isLoadingWebhooks,
    error: webhooksError,
    loadWebhooks,
  } = useWebhookStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<UploadInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  console.log(selectedChannel);

  // Initialize the worker
  useEffect(() => {
    if (typeof window !== "undefined" && !workerRef.current) {
      workerRef.current = new Worker("/upload.worker.js");
      setupWorkerListeners();
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Load webhooks when channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadWebhooks(selectedChannel.id);
    }
  }, [selectedChannel, loadWebhooks]);

  // Set up worker message listeners
  const setupWorkerListeners = () => {
    if (!workerRef.current) return;

    workerRef.current.addEventListener("message", (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case "upload-started":
          handleUploadStarted(payload);
          break;
        case "upload-progress":
          handleUploadProgress(payload);
          break;
        case "upload-complete":
          handleUploadComplete(payload);
          break;
        case "upload-failed":
          handleUploadFailed(payload);
          break;
        case "upload-cancelled":
          handleUploadCancelled(payload);
          break;
        case "error":
          toast.error(`Worker error: ${payload.message}`);
          break;
      }
    });
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // Handle upload start
  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    if (!webhooks.length) {
      toast.error("No webhooks available for upload");
      return;
    }

    if (!workerRef.current) {
      toast.error("Upload worker not initialized");
      return;
    }

    setIsUploading(true);

    try {
      // Generate a unique upload ID
      const uploadId = generateRandomString(32);

      // Create a new upload record
      const newUpload: UploadInfo = {
        id: uploadId,
        filename: file.name,
        fileSize: file.size,
        status: "pending",
        progress: {
          progress: 0,
          uploadedChunks: 0,
          totalChunks: 0,
        },
        metadataSaved: false,
      };

      // Add to uploads list
      setUploads((prev) => [...prev, newUpload]);

      // Create metadata
      const metadata = {
        originalFilename: file.name,
        fileType: file.type,
        fileSize: file.size,
        channelId: selectedChannel?.id,
        uploadDate: new Date().toISOString(),
        uuid: uploadId,
      };

      // Prepare webhooks for the worker (only send what's needed)
      const webhooksForWorker = webhooks.map((webhook) => ({
        id: webhook.id,
        url:
          webhook.url ||
          `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`,
      }));

      // Start the upload
      workerRef.current.postMessage({
        action: "start-upload",
        payload: {
          file,
          webhooks: webhooksForWorker,
          uploadId,
          metadata,
        },
      });

      toast.info(`Starting upload for ${file.name}`);
    } catch (err) {
      toast.error(
        `Upload error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsUploading(false);
    }
  };

  // Cancel an upload
  const cancelUpload = (uploadId: string) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      action: "cancel-upload",
      payload: { uploadId },
    });
  };

  // Delete a specific upload
  const deleteUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
    toast.info("Upload removed");
  };

  // Save file metadata to the backend
  const saveFileMetadata = async (metadata: any, uploadId: string) => {
    try {
      // Transform metadata to match the API expected format
      const chunksForBackend = Object.values(metadata.chunks).map(
        (chunk: any) => {
          const url = new URL(chunk.url);
          const ex = url.searchParams.get("ex");

          return {
            chunk_number: chunk.index,
            url: chunk.url,
            url_expiry: parseInt(ex ?? "", 16) * 1000,
          };
        }
      );

      const fileData = {
        name: metadata.originalFilename,
        size: metadata.fileSize,
        type: metadata.fileType,
        total_chunks: metadata.totalChunks,
        chunks: chunksForBackend,
      };

      // Send to the backend API
      const response = await fetch(
        `${import.meta.env.PUBLIC_API_URL}/files/store`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fileData),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to store file metadata: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("File metadata stored successfully:", data);

      // Update metadataSaved status
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId ? { ...upload, metadataSaved: true } : upload
        )
      );
    } catch (error) {
      console.error("Error storing file metadata:", error);
      toast.error(
        `Failed to store file metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Worker event handlers
  const handleUploadStarted = (payload: any) => {
    const { uploadId, totalChunks, filename } = payload;

    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              status: "uploading",
              startTime: Date.now(),
              progress: {
                ...upload.progress,
                totalChunks,
              },
            }
          : upload
      )
    );
    // Call onUploadStart callback if provided
    if (onUploadStart) {
      onUploadStart(uploadId, filename);
    }
  };

  const handleUploadProgress = (payload: any) => {
    const {
      uploadId,
      progress,
      uploadedChunks,
      totalChunks,
      uploadSpeed,
      estimatedTimeRemaining,
      currentChunk,
    } = payload;

    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              progress: {
                progress,
                uploadedChunks,
                totalChunks,
                uploadSpeed,
                estimatedTimeRemaining,
                currentChunk,
              },
            }
          : upload
      )
    );
  };

  const handleUploadComplete = (payload: any) => {
    const { uploadId, metadata } = payload;

    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              status: "completed",
              endTime: Date.now(),
              metadata: metadata, // Store the file metadata with chunks info
              progress: {
                ...upload.progress,
                progress: 100,
                uploadedChunks: upload.progress.totalChunks,
              },
            }
          : upload
      )
    );

    toast.success(
      `Upload of ${
        uploads.find((u) => u.id === uploadId)?.filename || "file"
      } completed`
    );

    // Save the file and chunks data to the backend
    saveFileMetadata(metadata, uploadId);

    // Call the onUploadComplete callback if provided
    if (onUploadComplete && metadata) {
      onUploadComplete(metadata);
    }

    setIsUploading(false);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadFailed = (payload: any) => {
    const { uploadId, message } = payload;

    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              status: "error",
              error: message,
            }
          : upload
      )
    );

    toast.error(`Upload failed: ${message}`);

    // Call the onUploadError callback if provided
    if (onUploadError) {
      onUploadError(message, uploadId);
    }
    setIsUploading(false);
  };

  const handleUploadCancelled = (payload: any) => {
    const { uploadId } = payload;

    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              status: "cancelled",
            }
          : upload
      )
    );

    toast.info("Upload cancelled");
    setIsUploading(false);
  };

  // Clear completed uploads
  const clearCompletedUploads = () => {
    setUploads((prev) =>
      prev.filter((upload) => upload.status !== "completed")
    );
    toast.info("Completed uploads cleared");
  };

  // Render a progress bar for each upload
  const renderUploadProgress = (upload: UploadInfo) => {
    return (
      <div className="mb-2 p-2 border rounded">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium">{upload.filename}</div>
            <div className="text-sm text-gray-500">
              {formatSize(upload.fileSize)}
            </div>
          </div>
          {upload.status === "uploading" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelUpload(upload.id)}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteUpload(upload.id)}
          >
            Delete
          </Button>
        </div>

        <div className="mt-2">
          <Progress
            value={upload.progress.progress}
            className="h-2"
            indicatorClassName={
              upload.status === "error"
                ? "bg-red-500"
                : upload.status === "completed"
                ? "bg-green-500"
                : undefined
            }
          />
        </div>

        <div className="flex justify-between text-xs mt-1">
          <div>
            {upload.status === "completed"
              ? "Completed"
              : upload.status === "error"
              ? "Error"
              : `${upload.progress.uploadedChunks || 0}/${
                  upload.progress.totalChunks || 0
                } chunks`}
          </div>
          <div>
            {upload.status === "uploading" && upload.progress.uploadSpeed && (
              <span>
                {formatSpeed(upload.progress.uploadSpeed)} •{" "}
                {upload.progress.estimatedTimeRemaining &&
                  formatTimeRemaining(upload.progress.estimatedTimeRemaining)}
              </span>
            )}
            {upload.status === "completed" &&
              upload.startTime &&
              upload.endTime && (
                <span>
                  Took{" "}
                  {formatTimeRemaining(
                    (upload.endTime - upload.startTime) / 1000
                  )}
                </span>
              )}
          </div>
        </div>

        {/* Add a small indicator when metadata is being saved */}
        {upload.status === "completed" && (
          <div className="text-xs text-right mt-1 italic">
            {upload.metadataSaved ? "✓ Metadata saved" : "Saving metadata..."}
          </div>
        )}
      </div>
    );
  };

  if (!selectedChannel) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Please select a channel to upload files
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>File Upload</CardTitle>
        <CardDescription>
          Upload files to Discord via webhooks in channel #
          {selectedChannel.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingWebhooks ? (
          <div className="text-center py-4">Loading webhooks...</div>
        ) : webhooksError ? (
          <div className="text-center text-red-500 py-4">
            Error loading webhooks: {webhooksError}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-4">
            No webhooks found for this channel. Please create at least one
            webhook first.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid w-full gap-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
            {file && (
              <div className="mt-2">
                <strong>Selected File:</strong> {file.name} (
                {(file.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            )}{" "}
            {uploads.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Upload Progress</h3>
                  {uploads.some((upload) => upload.status === "completed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearCompletedUploads}
                    >
                      Clear Completed
                    </Button>
                  )}
                </div>
                {uploads.map(renderUploadProgress)}
              </div>
            )}
          </div>
        )}
      </CardContent>{" "}
      <CardFooter>
        {" "}
        <Button
          onClick={handleUpload}
          disabled={!file || isUploading || webhooks.length === 0}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={clearCompletedUploads}
            disabled={uploads.every((upload) => upload.status !== "completed")}
            variant="secondary"
          >
            Clear Completed
          </Button>
          {uploads.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setUploads([]);
                toast.info("All uploads cleared");
              }}
              disabled={isUploading}
            >
              Clear All
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
