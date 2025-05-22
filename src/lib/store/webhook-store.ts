import { create } from "zustand";
import type { Webhook } from "@/types";

interface WebhookState {
  // Webhooks state
  webhooks: Webhook[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setWebhooks: (webhooks: Webhook[]) => void;
  addWebhook: (webhook: Webhook) => void;
  removeWebhook: (webhookId: string) => void;
  loadWebhooks: (channelId: string) => Promise<void>;
  clearWebhooks: () => void;
}

export const useWebhookStore = create<WebhookState>()((set, get) => ({
  webhooks: [],
  isLoading: false,
  error: null,

  setWebhooks: (webhooks) => set({ webhooks }),

  addWebhook: (webhook) =>
    set((state) => ({
      webhooks: [...state.webhooks, webhook],
    })),

  removeWebhook: (webhookId) =>
    set((state) => ({
      webhooks: state.webhooks.filter((webhook) => webhook.id !== webhookId),
    })),

  clearWebhooks: () => set({ webhooks: [], error: null }),

  loadWebhooks: async (channelId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${import.meta.env.PUBLIC_API_URL}/webhooks/${channelId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      set({ webhooks: data || [], isLoading: false });
      return data;
    } catch (err) {
      console.error("Error loading webhooks:", err);
      set({
        error: err instanceof Error ? err.message : "An unknown error occurred",
        webhooks: [],
        isLoading: false,
      });
      throw err;
    }
  },
}));
