// upload.worker.js
// This is a Web Worker that handles file uploads through Discord webhooks

let activeUploads = new Map();
let abortControllers = new Map();

// Helper functions for chunking
function createChunks(file, chunkSize = 9 * 1024 * 1024) {
  // 9MB chunks
  const chunks = [];
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    chunks.push({
      index: i,
      start,
      end,
      data: file.slice(start, end),
      totalChunks,
    });
  }

  return chunks;
}

// Main message handler
self.addEventListener("message", async (event) => {
  const { action, payload } = event.data;

  switch (action) {
    case "start-upload":
      startUpload(payload);
      break;
    case "cancel-upload":
      cancelUpload(payload.uploadId);
      break;
    default:
      self.postMessage({
        type: "error",
        payload: { message: `Unknown action: ${action}` },
      });
  }
});

// Start the upload process
async function startUpload({ file, webhooks, uploadId, metadata }) {
  if (!file || !webhooks || webhooks.length === 0) {
    self.postMessage({
      type: "error",
      payload: {
        uploadId,
        message: "Invalid upload parameters: file or webhooks missing",
      },
    });
    return;
  }

  // Create a new AbortController for this upload
  const controller = new AbortController();
  abortControllers.set(uploadId, controller);

  const chunks = createChunks(file);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    self.postMessage({
      type: "error",
      payload: {
        uploadId,
        message: "File is empty",
      },
    });
    return;
  } // Prepare upload tracking
  activeUploads.set(uploadId, {
    totalChunks,
    uploadedChunks: 0,
    startTime: Date.now(),
    filename: file.name,
    fileSize: file.size,
    fileType: file.type,
    webhookQueue: [...webhooks], // Copy webhooks to use as a queue
    failedChunks: [],
    status: "in-progress",
    chunkProgress: {}, // Track individual chunk progress
    chunkTimes: {}, // Track upload times for each chunk
    averageSpeed: 0, // Average upload speed in bytes per second
    estimatedTimeRemaining: 0, // Estimated time remaining in seconds,
    chunkData: {}, // To store attachment data for each successfully uploaded chunk
    originalMetadata: metadata, // Store the original metadata
  });

  // Notify that upload has started
  self.postMessage({
    type: "upload-started",
    payload: {
      uploadId,
      totalChunks,
      filename: file.name,
      fileSize: file.size,
    },
  });

  // Create queues
  const uploadQueue = [];
  const webhookQueue = [...webhooks];

  // Prepare chunks for upload
  for (let i = 0; i < chunks.length; i++) {
    uploadQueue.push({
      chunk: chunks[i],
      uploadId,
      metadata,
      retries: 0,
    });
  }

  // Process all chunks with controlled concurrency
  try {
    await processChunksWithConcurrency(
      uploadQueue,
      webhookQueue,
      uploadId,
      controller.signal,
      5
    );
    const upload = activeUploads.get(uploadId);
    if (upload && upload.failedChunks.length === 0) {
      // All chunks uploaded successfully
      // Convert chunk data object to a sorted array based on chunk index
      const chunksArray = Object.values(upload.chunkData || {}).sort(
        (a, b) => a.index - b.index
      );

      // Prepare the final metadata
      const fileMetadata = {
        id: uploadId,
        filename: file.name,
        originalFilename: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        duration: Date.now() - upload.startTime,
        totalChunks,
        chunks: upload.chunkData || {}, // Use the raw chunk data object for easier access by index
        chunksArray: chunksArray, // Keep the array format for display purposes
        originalMetadata: upload.originalMetadata || {},
        channelId: upload.originalMetadata?.channelId || null,
      };

      self.postMessage({
        type: "upload-complete",
        payload: {
          uploadId,
          filename: file.name,
          duration: Date.now() - upload.startTime,
          totalChunks,
          metadata: fileMetadata,
        },
      });

      activeUploads.delete(uploadId);
      abortControllers.delete(uploadId);
    } else {
      // Some chunks failed
      self.postMessage({
        type: "upload-failed",
        payload: {
          uploadId,
          failedChunks: upload ? upload.failedChunks : [],
          message: "Some chunks failed to upload",
        },
      });
    }
  } catch (error) {
    self.postMessage({
      type: "upload-failed",
      payload: {
        uploadId,
        message: error.message || "Upload failed",
      },
    });
  }
}

// Upload a single chunk directly to a Discord webhook
async function uploadChunk(uploadItem, webhook, signal) {
  const { chunk, uploadId } = uploadItem;

  return new Promise((resolve, reject) => {
    // Create a form with the file chunk
    const formData = new FormData();

    // Create a file from the chunk data with a unique name
    const chunkFile = new File([chunk.data], self.crypto.randomUUID(), {
      type: "application/octet-stream",
    });

    formData.append("file", chunkFile);

    // The webhook URL to use
    const webhookUrl = typeof webhook === "string" ? webhook : webhook.url;

    // Create a timestamp for upload speed calculation
    const startTime = Date.now();

    // Use XMLHttpRequest for better progress tracking
    const xhr = new XMLHttpRequest();

    // Setup abort controller integration
    if (signal) {
      const abortHandler = () => {
        xhr.abort();
        reject(new Error("Upload aborted"));
      };
      signal.addEventListener("abort", abortHandler);
      xhr.onloadend = () => {
        signal.removeEventListener("abort", abortHandler);
      };
    }

    // Track upload progress
    let lastTime = startTime;
    let lastLoaded = 0;
    let speed = 0; // bytes per second

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastTime;

        // Calculate upload speed every 500ms
        if (timeDiff > 500) {
          const loadedDiff = event.loaded - lastLoaded;
          speed = (loadedDiff / timeDiff) * 1000; // bytes per second

          lastTime = currentTime;
          lastLoaded = event.loaded;

          // Update the active upload with progress information
          const upload = activeUploads.get(uploadId);
          if (upload) {
            upload.chunkProgress = {
              ...(upload.chunkProgress || {}),
              [chunk.index]: {
                loaded: event.loaded,
                total: event.total,
                percent: Math.round((event.loaded / event.total) * 100),
                speed: speed,
              },
            };
          }
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error occurred during upload"));
    };

    xhr.onabort = () => {
      reject(new Error("Upload aborted"));
    };
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            // Record the total upload time for this chunk
            const upload = activeUploads.get(uploadId);
            if (upload) {
              upload.chunkTimes = {
                ...(upload.chunkTimes || {}),
                [chunk.index]: Date.now() - startTime,
              };

              // Store attachment data from the response
              if (response.attachments && response.attachments.length > 0) {
                const attachment = response.attachments[0];
                upload.chunkData = {
                  ...(upload.chunkData || {}),
                  [chunk.index]: {
                    id: attachment.id,
                    url: attachment.url,
                    proxy_url: attachment.proxy_url,
                    filename: attachment.filename,
                    size: attachment.size,
                    content_type: attachment.content_type,
                    width: attachment.width,
                    height: attachment.height,
                    ephemeral: attachment.ephemeral,
                    duration_secs: attachment.duration_secs,
                    waveform: attachment.waveform,
                    index: chunk.index,
                  },
                };
              }
            }
            resolve(response);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Webhook upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.open("POST", webhookUrl);
    xhr.send(formData);
  });
}

// Cancel an active upload
function cancelUpload(uploadId) {
  const controller = abortControllers.get(uploadId);
  if (controller) {
    controller.abort();

    self.postMessage({
      type: "upload-cancelled",
      payload: { uploadId },
    });

    // Clean up
    abortControllers.delete(uploadId);
    activeUploads.delete(uploadId);
  }
}

// Process chunks with controlled concurrency
async function processChunksWithConcurrency(
  uploadQueue,
  webhookQueue,
  uploadId,
  signal,
  maxConcurrent = 5
) {
  const activePromises = [];
  // Function to upload a single chunk and manage the webhook queue
  async function processChunk(item, webhookUrl) {
    try {
      const result = await uploadChunk(item, webhookUrl, signal);

      // Update progress
      const upload = activeUploads.get(uploadId);
      if (upload) {
        upload.uploadedChunks++;

        // Calculate overall progress
        const progress = Math.floor(
          (upload.uploadedChunks / upload.totalChunks) * 100
        );

        // Calculate average upload speed across all completed chunks
        let totalUploadSpeed = 0;
        let completedChunks = 0;

        if (upload.chunkTimes) {
          const chunkSizes = {}; // Map of chunk index to size
          for (let i = 0; i < upload.totalChunks; i++) {
            if (upload.chunkTimes[i]) {
              const chunkTime = upload.chunkTimes[i];
              const chunkSize =
                item.chunk.totalChunks === i + 1
                  ? upload.fileSize % (9 * 1024 * 1024) // Last chunk may be smaller
                  : 9 * 1024 * 1024; // Default chunk size

              chunkSizes[i] = chunkSize;
              const chunkSpeed = chunkSize / (chunkTime / 1000); // bytes per second
              totalUploadSpeed += chunkSpeed;
              completedChunks++;
            }
          }
        }

        // If we have completed chunks, calculate average speed
        const averageUploadSpeed =
          completedChunks > 0 ? totalUploadSpeed / completedChunks : 0;

        // Calculate estimated time remaining based on average speed
        const remainingChunks = upload.totalChunks - upload.uploadedChunks;
        const remainingBytes = remainingChunks * 9 * 1024 * 1024; // Approximate
        const estimatedTimeRemaining =
          averageUploadSpeed > 0
            ? remainingBytes / averageUploadSpeed // in seconds
            : 0;

        // Notify progress
        self.postMessage({
          type: "upload-progress",
          payload: {
            uploadId,
            progress,
            uploadedChunks: upload.uploadedChunks,
            totalChunks: upload.totalChunks,
            uploadSpeed: averageUploadSpeed, // bytes per second
            estimatedTimeRemaining, // seconds
            currentChunk: item.chunk.index,
          },
        });
      }

      return { success: true, webhookUrl };
    } catch (error) {
      console.error(
        `Error uploading chunk ${item.chunk.index}:`,
        error.message
      );

      // Retry logic
      if (item.retries < 3) {
        item.retries++;
        uploadQueue.push(item); // Put back in queue for retry
      } else {
        // Max retries reached, mark as failed
        const upload = activeUploads.get(uploadId);
        if (upload) {
          upload.failedChunks.push(item.chunk.index);
        }
      }

      return { success: false, webhookUrl };
    }
  }

  // Main processing loop
  while (uploadQueue.length > 0 && !signal.aborted) {
    // Fill the active promises array up to maxConcurrent
    while (
      activePromises.length < maxConcurrent &&
      uploadQueue.length > 0 &&
      webhookQueue.length > 0
    ) {
      const item = uploadQueue.shift();
      const webhookUrl = webhookQueue.shift();

      if (item && webhookUrl) {
        const promise = processChunk(item, webhookUrl).then((result) => {
          // Return the webhook to the queue when done
          webhookQueue.push(result.webhookUrl);
          return result;
        });

        activePromises.push(promise);
      }
    }

    // If we have active promises, wait for one to complete
    if (activePromises.length > 0) {
      const results = await Promise.race(
        activePromises.map((promise, index) =>
          promise.then((result) => ({ result, index }))
        )
      );

      // Remove the completed promise
      if (results && typeof results.index === "number") {
        activePromises.splice(results.index, 1);
      }
    } else if (webhookQueue.length === 0 && uploadQueue.length > 0) {
      // If we have items to upload but no webhooks available, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      // No more items to process
      break;
    }

    // Check for abort signal
    if (signal.aborted) {
      break;
    }
  }

  // Wait for any remaining active promises to complete
  if (activePromises.length > 0) {
    await Promise.all(activePromises);
  }
}
